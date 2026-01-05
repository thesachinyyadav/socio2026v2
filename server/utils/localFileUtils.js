import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_BASE_DIR = path.join(__dirname, "..", "uploads");

// Ensure upload directories exist
const createDirectories = async () => {
  const dirs = [
    path.join(UPLOAD_BASE_DIR, "event-images"),
    path.join(UPLOAD_BASE_DIR, "event-banners"),
    path.join(UPLOAD_BASE_DIR, "event-pdfs"),
    path.join(UPLOAD_BASE_DIR, "fest-images"),
  ];

  for (const dir of dirs) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      // Directory might already exist, ignore error
    }
  }
};

export const getPathFromStorageUrl = (url, bucketName) => {
  if (!url || !bucketName) {
    return null;
  }
  try {
    // For local file URLs, extract filename from the path
    const urlParts = url.split('/');
    const filename = urlParts[urlParts.length - 1];
    return filename;
  } catch (error) {
    return null;
  }
};

export async function uploadFileToLocal(file, bucketName, eventIdForPath) {
  if (!file) return null;

  await createDirectories();

  const fileExtension = path.extname(file.originalname);
  const fileName = `${eventIdForPath}_${uuidv4()}${fileExtension}`;
  const bucketDir = path.join(UPLOAD_BASE_DIR, bucketName);
  const filePath = path.join(bucketDir, fileName);

  try {
    await fs.writeFile(filePath, file.buffer);
    
    // Return local URL (for development, you might want to serve these files statically)
    const publicUrl = `/uploads/${bucketName}/${fileName}`;
    
    return { publicUrl, path: fileName };
  } catch (error) {
    console.error(`Failed to upload ${file.fieldname} to ${bucketName}:`, error);
    throw new Error(`Failed to upload ${file.fieldname} to ${bucketName}: ${error.message}`);
  }
}

export async function deleteFileFromLocal(filePath, bucketName) {
  if (!filePath || !bucketName) return;

  try {
    const fullPath = path.join(UPLOAD_BASE_DIR, bucketName, filePath);
    await fs.unlink(fullPath);
  } catch (error) {
    console.warn(`Failed to delete file ${filePath} from ${bucketName}:`, error.message);
  }
}