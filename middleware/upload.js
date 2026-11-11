
import multer from "multer";

const storage = multer.memoryStorage();

const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
];

const fileFilter = (req, file, cb) => {
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(
            new multer.MulterError(
                "LIMIT_UNEXPECTED_FILE",
                file.fieldname
            )
        );
    }

    cb(null, true);
};

export const upload = multer({
    storage,

    limits: {
        fileSize: 25 * 1024 * 1024,
        files: 5,
        fields: 5,
        parts: 10,
        fieldNameSize: 100,
    },

    fileFilter,
});
