import fs from "fs";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import { createWorker, Worker } from "tesseract.js";
import axios from "axios";
import * as cheerio from "cheerio";
import { YoutubeTranscript } from "youtube-transcript-plus";
import { TranscriptItem } from "./types";

const pdf = (pdfParse as any).default || pdfParse;

// Spinning up a fresh Tesseract worker (loading the WASM runtime + language
// data) per image takes several seconds, so we keep one warm worker around
// for the life of the process instead of one-shot `Tesseract.recognize`.
// tesseract.js queues concurrent recognize() calls on a worker internally,
// so this is safe under concurrent requests, just not parallel across them.
let ocrWorkerPromise: Promise<Worker> | null = null;

const getOcrWorker = (): Promise<Worker> => {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = createWorker("eng");
  }
  return ocrWorkerPromise;
};

process.on("SIGTERM", async () => {
  if (ocrWorkerPromise) {
    (await ocrWorkerPromise).terminate().catch(() => {});
  }
});

const extractArticleText = async (url: string): Promise<string> => {
  const response = await axios.get(url, {
    timeout: 15000,
    maxContentLength: 10 * 1024 * 1024,
    headers: {
      // Some sites block requests with no browser-like User-Agent.
      "User-Agent":
        "Mozilla/5.0 (compatible; SecondBrainBot/1.0; +https://github.com)",
    },
    responseType: "text",
  });

  const $ = cheerio.load(response.data);
  $("script, style, nav, header, footer, aside, noscript, iframe, svg").remove();

  const container = $("article").length ? $("article") : $("body");
  const text = container
    .text()
    .replace(/\s+/g, " ")
    .trim();

  return text;
};

export const extractContent = async (
  file: Express.Multer.File | string | Buffer,
  type: string,
): Promise<string> => {
  if (type === "youtube" && typeof file === "string") {
    try {
      const youtubeRegex =
        /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
      if (!youtubeRegex.test(file)) {
        throw new Error("Invalid YouTube URL format");
      }

      const transcript = await YoutubeTranscript.fetchTranscript(file);

      if (!transcript || transcript.length === 0) {
        return "";
      }

      return transcript.map((t: TranscriptItem) => t.text).join(" ");
    } catch (error: any) {
      console.error("YouTube transcript extraction failed:", error);
      return "";
    }
  }

  if (type === "article" && typeof file === "string") {
    try {
      return await extractArticleText(file);
    } catch (error) {
      console.error("Article extraction failed:", error);
      return "";
    }
  }

  if (Buffer.isBuffer(file)) {
    if (type === "pdf" || type === "doc") {
      // Handle both PDF and converted Office documents (which are now PDFs)
      try {
        const data: any = await pdf(file);
        return data.text || "";
      } catch (e) {
        console.error("PDF Buffer Extraction Error:", e);
        return "";
      }
    }
  }

  if (
    typeof file === "object" &&
    !Buffer.isBuffer(file) &&
    (file as any).path
  ) {
    const filePath = (file as any).path;

    if (type === "pdf") {
      const dataBuffer = fs.readFileSync(filePath);
      try {
        const data: any = await pdf(dataBuffer);
        console.log("PDF Metadata:", {
          numpages: data.numpages,
          info: data.info,
          textLength: data.text?.length,
        });
        return data.text || "";
      } catch (e) {
        console.error("PDF Extraction Error:", e);
        return "";
      }
    }

    if (type === "doc") {
      // Office files are converted to PDF before upload
      // So we need to extract from the PDF, not the original file
      // The file at this point might be the converted PDF
      const dataBuffer = fs.readFileSync(filePath);

      // Try PDF extraction first (for converted files)
      try {
        const data: any = await pdf(dataBuffer);
        console.log("Converted Office Document Metadata:", {
          numpages: data.numpages,
          textLength: data.text?.length,
        });
        return data.text || "";
      } catch (pdfError) {
        // Fallback to mammoth for non-converted .docx files
        try {
          const result = await mammoth.extractRawText({ path: filePath });
          return result.value;
        } catch (err) {
          console.warn("Document extraction failed:", err);
          return "";
        }
      }
    }

    if (type === "image") {
      const worker = await getOcrWorker();
      const {
        data: { text },
      } = await worker.recognize(filePath);
      return text;
    }
  }
  return "";
};
