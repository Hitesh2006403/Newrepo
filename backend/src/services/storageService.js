const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ApiError = require('../utils/ApiError');
const ERROR_CODES = require('../constants/errorCodes');

const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Validates real file signature (magic bytes) to prevent extension spoofing.
 *
 * @param {Buffer} buffer - In-memory file buffer
 * @param {string} mimetype - Declared MIME type
 * @returns {boolean} True if magic bytes match declared image format
 */
const validateMagicBytes = (buffer, mimetype) => {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length < 12) {
    return false;
  }

  // 1. JPEG: FF D8 FF
  if (mimetype === 'image/jpeg' || mimetype === 'image/jpg') {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }

  // 2. PNG: 89 50 4E 47 0D 0A 1A 0A
  if (mimetype === 'image/png') {
    return (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    );
  }

  // 3. WebP: RIFF (bytes 0-3) and WEBP (bytes 8-11)
  if (mimetype === 'image/webp') {
    const riff = buffer.subarray(0, 4).toString('ascii');
    const webp = buffer.subarray(8, 12).toString('ascii');
    return riff === 'RIFF' && webp === 'WEBP';
  }

  return false;
};

/**
 * Storage Adapter Interface.
 * Defaults to Local Disk Storage (backend/uploads/).
 * Easily replaceable by a Cloudinary or S3 adapter without changing application logic.
 */
class LocalStorageAdapter {
  constructor(uploadsDir = UPLOADS_DIR) {
    this.uploadsDir = uploadsDir;
  }

  /**
   * Saves a file buffer after magic byte validation with a random UUID filename.
   * Path traversal resistant: ignores client originalname path components.
   *
   * @param {Object} file - File object from Multer memoryStorage ({ buffer, originalname, mimetype })
   * @returns {Promise<string>} Public relative URL of the saved file
   */
  async saveFile({ buffer, originalname, mimetype }) {
    if (!validateMagicBytes(buffer, mimetype)) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Invalid file content signature. File magic bytes do not match declared image format.'
      );
    }

    const extensionMap = {
      'image/jpeg': '.jpg',
      'image/jpg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
    };
    const extension = extensionMap[mimetype] || '.jpg';

    // Random cryptographically secure filename
    const safeRandomFilename = `${crypto.randomUUID()}${extension}`;
    const targetPath = path.join(this.uploadsDir, safeRandomFilename);

    await fs.promises.writeFile(targetPath, buffer);

    return `/uploads/${safeRandomFilename}`;
  }

  /**
   * Deletes a file by its URL.
   *
   * @param {string} fileUrl - Public URL of the file
   * @returns {Promise<void>}
   */
  async deleteFile(fileUrl) {
    if (!fileUrl) return;
    const filename = path.basename(fileUrl);
    const targetPath = path.join(this.uploadsDir, filename);
    if (fs.existsSync(targetPath)) {
      await fs.promises.unlink(targetPath).catch(() => {});
    }
  }

  getUploadsDirectory() {
    return this.uploadsDir;
  }
}

const storageService = new LocalStorageAdapter();

module.exports = {
  storageService,
  validateMagicBytes,
  LocalStorageAdapter,
};
