import { v2 as cloudinary } from "cloudinary";
import ConvertAPI from "convertapi";
import fs from "fs";
import path from "path";

// Initialize ConvertAPI (will be configured with API key from env)
const getConvertAPI = () => {
  const apiSecret = process.env.CONVERTAPI_SECRET;
  if (!apiSecret || apiSecret === "your_api_key_here") {
    throw new Error(
      "CONVERTAPI_SECRET is not configured. Please add your ConvertAPI secret key to the .env file.",
    );
  }
  return new ConvertAPI(apiSecret);
};

/**
 * Convert Office files (docx, xlsx, pptx) to PDF using ConvertAPI
 */
const convertOfficeToPdf = async (
  filePath: string,
  originalFilename: string,
): Promise<string> => {
  try {
    const convertapi = getConvertAPI();
    const fileExtension = path.extname(originalFilename).toLowerCase().slice(1);

    // Determine the source format
    let sourceFormat = fileExtension;
    if (fileExtension === "docx") sourceFormat = "docx";
    else if (fileExtension === "xlsx") sourceFormat = "xlsx";
    else if (fileExtension === "pptx") sourceFormat = "pptx";
    else if (fileExtension === "doc") sourceFormat = "doc";
    else if (fileExtension === "xls") sourceFormat = "xls";
    else if (fileExtension === "ppt") sourceFormat = "ppt";

    console.log(`Converting ${sourceFormat} to PDF using ConvertAPI...`);
    console.log(`Source file: ${filePath}`);

    // Convert the file - ConvertAPI: convert(toFormat, params, fromFormat)
    const result = await convertapi.convert(
      "pdf",
      {
        File: filePath,
      },
      sourceFormat,
    );

    console.log(`Conversion completed. Files received: ${result.files.length}`);

    // Save the converted PDF to the same directory as the original file
    const outputDir = path.dirname(filePath);
    await result.saveFiles(outputDir);

    // ConvertAPI saves the file with its own naming
    const savedFile = result.files[0];
    const actualPdfPath = path.join(outputDir, savedFile.fileName);

    console.log(`Conversion successful. PDF saved at: ${actualPdfPath}`);

    // Verify the file exists
    if (!fs.existsSync(actualPdfPath)) {
      throw new Error(`Converted PDF file not found at ${actualPdfPath}`);
    }

    return actualPdfPath;
  } catch (error: any) {
    console.error("ConvertAPI conversion error:", error);
    console.error("Error stack:", error.stack);

    // Provide helpful error messages
    if (error.message?.includes("401") || error.message?.includes("403")) {
      throw new Error(
        "ConvertAPI authentication failed. Please check your API key.",
      );
    } else if (error.message?.includes("timeout")) {
      throw new Error(
        "File conversion timed out. The file might be too large or complex.",
      );
    } else if (error.message?.includes("unsupported")) {
      throw new Error(
        "File format is not supported for conversion. Please try a different file.",
      );
    } else {
      throw new Error(
        `Failed to convert Office file to PDF: ${error.message || "Unknown error"}`,
      );
    }
  }
};

export const imageUpload = async (file: Express.Multer.File, type: string) => {
  let folderName = "secondBrain/others";
  let fileToUpload = file.path;
  let convertedPdfPath: string | null = null;
  let resourceType: "image" | "raw" | "video" | "auto" = "auto";

  if (type === "pdf") folderName = "secondBrain/pdfs";
  if (type === "image") folderName = "secondBrain/images";

  // For Office documents, convert to PDF first
  if (type === "doc") {
    folderName = "secondBrain/pdfs"; // Upload to pdfs folder since we're converting to PDF
    try {
      console.log(
        `Office file detected: ${file.originalname}. Converting to PDF...`,
      );
      convertedPdfPath = await convertOfficeToPdf(file.path, file.originalname);
      fileToUpload = convertedPdfPath;
      resourceType = "image"; // PDFs should be uploaded as 'image' type in Cloudinary
      console.log(`Using converted PDF for upload: ${fileToUpload}`);
    } catch (error: any) {
      console.error("Office to PDF conversion failed:", error);
      console.error("Error details:", error.message);

      // Clean up the original file
      if (fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }

      throw new Error(
        `Failed to convert Office document: ${error.message || "Conversion service error"}`,
      );
    }
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    console.log(`Uploading to Cloudinary: ${fileToUpload}`);
    console.log(`Folder: ${folderName}, Resource type: ${resourceType}`);

    const uploadResult = await cloudinary.uploader.upload(fileToUpload, {
      folder: folderName,
      resource_type: resourceType,
      timeout: 60000, // 60 second timeout for large files
    });

    console.log(`Upload successful. URL: ${uploadResult.secure_url}`);
    return uploadResult;
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    throw error; // Re-throw the error so it can be handled by the caller
  } finally {
    // Clean up the converted PDF file if it exists (only after upload completes)
    // NOTE: We don't delete the original file here because contentRoutes.ts
    // needs it for text extraction and will handle cleanup itself
    if (convertedPdfPath && fs.existsSync(convertedPdfPath)) {
      try {
        fs.unlinkSync(convertedPdfPath);
        console.log("Cleaned up converted PDF file");
      } catch (cleanupError) {
        console.error("Error cleaning up converted PDF:", cleanupError);
      }
    }
  }
};

export const deleteFromCloudinary = async (publicId: string) => {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    let result = await cloudinary.uploader.destroy(publicId);

    if (result.result === "not found") {
      result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "raw",
      });
    }

    if (result.result === "not found") {
      result = await cloudinary.uploader.destroy(publicId, {
        resource_type: "video",
      });
    }

    return result;
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    return null;
  }
};
