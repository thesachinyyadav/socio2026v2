import { uploadFileToSupabase } from './utils/fileUtils.js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Create a mock file object (buffer)
const mockFile = {
    buffer: Buffer.from('test image content'),
    originalname: 'test_auto_generated.jpg',
    mimetype: 'image/jpeg',
    fieldname: 'eventImage' // Simulate the field name
};

async function testUpload() {
    console.log("🚀 Starting upload test...");
    try {
        console.log("Attempting to upload to 'event-images' bucket...");
        const result = await uploadFileToSupabase(mockFile, 'event-images', 'test-event-id');
        console.log("✅ Upload SUCCESS!");
        console.log("Result:", result);
    } catch (error) {
        console.error("❌ Upload FAILED:");
        console.error(error);
    }
}

testUpload();
