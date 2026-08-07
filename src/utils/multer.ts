import multer from "multer";
import os from "os";
export const uploadToMulter = multer({
    storage: multer.diskStorage({
        destination: os.tmpdir(),
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
            cb(null, file.fieldname + "-" + uniqueSuffix + "-" + file.originalname);
        },
    }),
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith("image/")) {
            const error: any = new Error(
                "Only image files are allowed for profile pictures",
            );
            error.statusCode = 400;
            return cb(error);
        }
        cb(null, true);
    },
});
