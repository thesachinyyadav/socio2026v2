import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { multerUpload } from '../utils/multerConfig.js';
import { uploadFileToSupabase } from '../utils/fileUtils.js';
import path from 'path';

const router = express.Router();

// Upload fest image
router.post('/upload/fest-image', authenticateUser, multerUpload.single('file'), async (req, res) => {
  try {
    console.log("=== UPLOAD FEST IMAGE ===");
    console.log("File received:", req.file ? `${req.file.fieldname} (${req.file.size} bytes, ${req.file.mimetype})` : "NO FILE");
    console.log("User:", req.userId);
    console.log("Body keys:", Object.keys(req.body));

    // Validate file exists
    if (!req.file) {
      console.error("❌ No file in request");
      return res.status(400).json({ 
        error: 'No file uploaded',
        message: 'Please select an image to upload'
      });
    }

    // Validate file type
    const validImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!validImageTypes.includes(req.file.mimetype)) {
      console.error(`❌ Invalid file type: ${req.file.mimetype}`);
      return res.status(400).json({ 
        error: 'Invalid file type',
        message: `File type ${req.file.mimetype} not supported. Use JPEG, PNG, WebP, or GIF.`
      });
    }

    // Validate file size (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (req.file.size > maxSize) {
      console.error(`❌ File too large: ${req.file.size} bytes`);
      return res.status(400).json({ 
        error: 'File too large',
        message: 'File size must be less than 5MB'
      });
    }

    console.log("✅ File validation passed");
    console.log("Attempting upload to Supabase/Local storage...");
    
    const result = await uploadFileToSupabase(req.file, 'fest-images', 'fest');
    
    console.log("Upload result:", result);

    if (!result) {
      throw new Error("Upload returned no result");
    }

    if (!result.publicUrl) {
      throw new Error("Upload returned no public URL");
    }

    const url = result.publicUrl;

    console.log("✅ Upload successful:", url);
    return res.status(201).json({
      success: true,
      url,
      fileName: result.path,
      message: 'Image uploaded successfully'
    });
  } catch (error) {
    console.error('❌ Error uploading fest image:', error.message);
    console.error('Full error:', error);
    
    // Determine appropriate status code
    let statusCode = 500;
    let errorMessage = error.message;
    
    if (error.message.includes('ENOENT')) {
      statusCode = 500;
      errorMessage = 'Storage directory not found. Server misconfiguration.';
    } else if (error.message.includes('permission')) {
      statusCode = 403;
      errorMessage = 'Permission denied. Cannot write to storage.';
    } else if (error.message.includes('not found')) {
      statusCode = 404;
      errorMessage = 'Storage bucket not found.';
    }
    
    return res.status(statusCode).json({ 
      success: false,
      error: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Add additional upload routes as needed

export default router;