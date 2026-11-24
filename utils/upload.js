// Image upload: Cloudinary when configured, otherwise local disk (public/uploads).
const path = require("path");
const fs = require("fs/promises");
const crypto = require("crypto");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const config = require("../config");
const ExpressError = require("./ExpressError");

const ALLOWED = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif" };
const UPLOAD_DIR = path.join(__dirname, "..", "public", "uploads");

if (config.cloudinary.enabled) {
    cloudinary.config({
        cloud_name: config.cloudinary.cloudName,
        api_key: config.cloudinary.apiKey,
        api_secret: config.cloudinary.apiSecret,
        secure: true,
    });
}

const parser = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
        if (ALLOWED[file.mimetype]) return cb(null, true);
        cb(new ExpressError(400, "Only JPG, PNG, WebP or GIF images are allowed."));
    },
});

// Express middleware: parses an optional single "image" file field.
const parseImage = (req, res, next) =>
    parser.single("image")(req, res, (err) => {
        if (!err) return next();
        if (err.code === "LIMIT_FILE_SIZE") return next(new ExpressError(400, "Image must be 5 MB or smaller."));
        next(err);
    });

function uploadToCloudinary(buffer) {
    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: "wanderlust", resource_type: "image" },
            (err, result) => (err ? reject(err) : resolve(result))
        );
        stream.end(buffer);
    });
}

// Saves an uploaded file and returns { url, filename }.
async function saveImage(file) {
    if (config.cloudinary.enabled) {
        const result = await uploadToCloudinary(file.buffer);
        return { url: result.secure_url, filename: result.public_id };
    }
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    const filename = `${crypto.randomBytes(12).toString("hex")}${ALLOWED[file.mimetype]}`;
    await fs.writeFile(path.join(UPLOAD_DIR, filename), file.buffer);
    return { url: `/uploads/${filename}`, filename };
}

// Best-effort removal of an image we stored earlier.
async function removeImage(image) {
    if (!image || !image.filename) return;
    try {
        if (config.cloudinary.enabled) await cloudinary.uploader.destroy(image.filename);
        else if (image.url && image.url.startsWith("/uploads/")) {
            await fs.unlink(path.join(UPLOAD_DIR, path.basename(image.filename)));
        }
    } catch {
        /* ignore */
    }
}

module.exports = { parseImage, saveImage, removeImage };
