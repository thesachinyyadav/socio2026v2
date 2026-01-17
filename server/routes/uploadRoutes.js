import express from 'express';
import { authenticateUser } from '../middleware/authMiddleware.js';
import { multerUpload } from '../utils/multerConfig.js';
import { uploadFileToSupabase } from '../utils/fileUtils.js';
import path from 'path';

const router = express.Router();

// Upload fest image
router.post('/upload/fest-image', authenticateUser, multerUpload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const result = await uploadFileToSupabase(req.file, 'fest-images', 'fest');
    
    // Get the public URL from the result
    const url = result.publicUrl;

    return res.status(200).json({
      url,
      fileName: result.path // The path is returned in the result object
    });
  } catch (error) {
    console.error('Error uploading fest image:', error);
    return res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Add additional upload routes as needed

export default router;