declare module "youtube-transcript-plus";

import { UploadApiResponse } from "cloudinary";

interface CloudinaryUploadResult extends UploadApiResponse {
  secure_url: string;
  public_id: string;
}
