import fs from "fs";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import { YoutubeTranscript } from "youtube-transcript-plus";
import * as xlsx from "xlsx";
import { TranscriptItem } from "./types";

export const extractContent = async (
  file: Express.Multer.File | string | Buffer,
  type: string,
): Promise<string> => {
  if (type === "youtube" && typeof file === "string") {
    const transcript = await YoutubeTranscript.fetchTranscript(file);
    return transcript.map((t: TranscriptItem) => t.text).join(" ");
  }

  if (Buffer.isBuffer(file)) {
    if (type === "pdf") {
      try {
        const parser = new PDFParse({ data: file });
        const data: any = await parser.getText();
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
      const parser = new PDFParse({ data: dataBuffer });
      try {
        const data: any = await parser.getText();
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

    if (type === "docx" || type === "doc") {
      try {
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
      } catch (err) {
        console.warn("Mammoth extraction failed (likely binary .doc):", err);
        return "";
      }
    }

    if (type === "image") {
      const {
        data: { text },
      } = await Tesseract.recognize(filePath, "eng");
      return text;
    }

    if (type === "spreadsheets") {
      try {
        const workbook = xlsx.readFile(filePath);
        let text = "";
        workbook.SheetNames.forEach((sheetName) => {
          const sheet = workbook.Sheets[sheetName];
          // Use CSV format for better structure that AI can understand
          const sheetContent = xlsx.utils.sheet_to_csv(sheet);
          if (sheetContent.trim()) {
            text += `Sheet: ${sheetName}\n${sheetContent}\n\n`;
          }
        });
        return text;
      } catch (err) {
        console.error("Spreadsheet extraction error:", err);
        return "";
      }
    }
  }
  return "";
};
