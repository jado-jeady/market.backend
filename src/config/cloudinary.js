import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import streamifier from "streamifier";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});
/**
 * Upload a file buffer to Cloudinary via a readable stream.
 * Returns the full Cloudinary upload result ({ secure_url, public_id, ... })
 */
export const uploadToCloudinary = (buffer, folder = "damage_reports") => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [
          { width: 1200, quality: "auto", fetch_format: "auto" },
        ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      },
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

/**
 * Multer uses memoryStorage so buffers are available in req.files.
 * Accept up to 2 files: field names "image_1" and "image_2"
 */
export const uploadDamageImages = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per file
}).fields([
  { name: "image_1", maxCount: 1 },
  { name: "image_2", maxCount: 1 },
]);

export default cloudinary;
