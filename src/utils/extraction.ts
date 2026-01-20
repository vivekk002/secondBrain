import fs from "fs";
import * as pdfParse from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import { YoutubeTranscript } from "youtube-transcript-plus";
import { TranscriptItem } from "./types";

const pdf = (pdfParse as any).default || pdfParse;

export const extractContent = async (
  file: Express.Multer.File | string | Buffer,
  type: string,
): Promise<string> => {
  if (type === "youtube" && typeof file === "string") {
    const transcript = await YoutubeTranscript.fetchTranscript(file);
    return transcript.map((t: TranscriptItem) => t.text).join(" ");
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
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng");
      return text;
    }
  }
  return "";
};
