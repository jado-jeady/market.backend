import multer from "multer";

const storage = multer.memoryStorage(); // keep file in memory buffer
export const upload = multer({ storage });
