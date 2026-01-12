import path from "path";
import fs from "fs/promises";
import { v4 as uuidv4 } from "uuid";
import { fileURLToPath } from 'url';
import { supabase } from "../config/database.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPLOAD_BASE_DIR = path.join(__dirname, "..", "uploads");
const storageMode = (process.env.FILE_STORAGE_MODE || "supabase").toLowerCase();
const useLocalStorage = storageMode === "local";

// Ensure upload directories exist (local storage only)
const createDirectories = async () => {
  if (!useLocalStorage) {
    return;
  }

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

// Local storage implementation (used only when FILE_STORAGE_MODE=local)
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

  if (useLocalStorage) {
    try {
      const fullPath = path.join(UPLOAD_BASE_DIR, bucketName, filePath);
      await fs.unlink(fullPath);
    } catch (error) {
      console.warn(`Failed to delete file ${filePath} from ${bucketName}:`, error.message);
    }
    return;
  }

  try {
    const { error } = await supabase.storage.from(bucketName).remove([filePath]);
    if (error) {
      console.warn(`Failed to delete file ${filePath} from ${bucketName}:`, error.message);
    }
  } catch (error) {
    console.warn(`Failed to delete file ${filePath} from ${bucketName}:`, error.message);
  }
}

export async function uploadFileToSupabase(file, bucketName, eventIdForPath) {
  if (!file) return null;

  if (useLocalStorage) {
    return uploadFileToLocal(file, bucketName, eventIdForPath);
  }

  const fileExtension = path.extname(file.originalname) || "";
  const safePrefix = eventIdForPath ? `${eventIdForPath}_` : "asset_";
  const fileName = `${safePrefix}${uuidv4()}${fileExtension}`;

  const { error: uploadError } = await supabase.storage
    .from(bucketName)
    .upload(fileName, file.buffer, {
      contentType: file.mimetype,
      cacheControl: "3600",
      upsert: false
    });

  if (uploadError) {
    throw new Error(`Supabase upload failed: ${uploadError.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(fileName);

  const publicUrl = publicUrlData?.publicUrl;
  if (!publicUrl) {
    throw new Error("Unable to generate public URL for uploaded file");
  }

  return { publicUrl, path: fileName };
}
