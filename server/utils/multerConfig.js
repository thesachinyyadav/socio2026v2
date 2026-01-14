import multer from "multer";

const multerStorage = multer.memoryStorage();

export const multerUpload = multer({
  storage: multerStorage,
  fileFilter: (req, file, cb) => {
    // Allow both general "file" (fest uploads) and specific image/banner fields
    const isImageField =
      file.fieldname === "imageFile" ||
      file.fieldname === "bannerFile" ||
      file.fieldname === "file";

    if (isImageField) {
      if (
        file.mimetype === "image/jpeg" ||
        file.mimetype === "image/png" ||
        file.mimetype === "image/webp" ||
        file.mimetype === "image/gif"
      ) {
        cb(null, true);
      } else {
        cb(
          new Error(
            "Invalid file type for image/banner. Only JPEG, PNG, WEBP, GIF allowed."
          ),
          false
        );
      }
      return;
    }

    if (file.fieldname === "pdfFile") {
      if (file.mimetype === "application/pdf") {
        cb(null, true);
      } else {
        cb(new Error("Invalid file type for PDF. Only PDF allowed."), false);
      }
      return;
    }

    cb(new Error("Invalid file field."), false);
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});
