import { v2 as cloudinary } from "cloudinary";

export const imageUpload = async (file: Express.Multer.File, type: string) => {
  let folderName = "secondBrain/others";
  if (type === "pdf") folderName = "secondBrain/pdfs";
  if (type === "image") folderName = "secondBrain/images";
  if (type === "spreadsheets") folderName = "secondBrain/spreadsheets";
  if (type === "doc") folderName = "secondBrain/docs";

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  try {
    const uploadResult = await cloudinary.uploader.upload(file.path, {
      folder: folderName,
      resource_type: "auto",
      timeout: 60000, // 60 second timeout for large files
    });

    return uploadResult;
  } catch (error: any) {
    console.error("Cloudinary upload error:", error);
    throw error; // Re-throw the error so it can be handled by the caller
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
