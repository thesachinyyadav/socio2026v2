import QRCode from 'qrcode';
import crypto from 'crypto';

// Get QR secret with proper fallback - SECURITY: Warn if using default
const getQRSecret = () => {
  const secret = process.env.QR_SECRET;
  if (!secret) {
    console.warn('⚠️  SECURITY WARNING: QR_SECRET not set, using fallback. Set QR_SECRET in production!');
    return 'socio-qr-fallback-secret-2026';
  }
  return secret;
};

/**
 * Generate QR code data for a registration
 * @param {string} registrationId - The registration ID
 * @param {string} eventId - The event ID
 * @param {string} participantEmail - The participant's email
 * @returns {Object} QR code payload with security hash
 */
export function generateQRCodeData(registrationId, eventId, participantEmail) {
  const timestamp = Date.now();
  const expiryTime = timestamp + (24 * 60 * 60 * 1000); // 24 hours from now
  
  // Create a hash for security verification
  // SECURITY FIX: Proper operator precedence with parentheses
  const dataToHash = `${registrationId}:${eventId}:${participantEmail}:${timestamp}`;
  const secret = getQRSecret();
  const hash = crypto.createHash('sha256').update(dataToHash + secret).digest('hex');
  
  return {
    registrationId,
    eventId,
    participantEmail,
    timestamp,
    expiryTime,
    hash
  };
}

/**
 * Generate QR code image as base64 data URL
 * @param {Object} qrData - The QR code data payload
 * @returns {Promise<string>} Base64 data URL of QR code image
 */
export async function generateQRCodeImage(qrData) {
  try {
    const qrString = JSON.stringify(qrData);
    const qrCodeOptions = {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 1,
      color: {
        dark: '#154CB3', // Brand blue
        light: '#FFFFFF'
      },
      width: 256
    };
    
    const dataUrl = await QRCode.toDataURL(qrString, qrCodeOptions);
    return dataUrl;
  } catch (error) {
    throw new Error('Failed to generate QR code image: ' + error.message);
  }
}

/**
 * Verify QR code data integrity and validity
 * @param {Object} qrData - The QR code data payload
 * @returns {Object} Validation result with status and message
 */
export function verifyQRCodeData(qrData) {
  try {
    const { registrationId, eventId, participantEmail, timestamp, expiryTime, hash } = qrData;
    
    // Check required fields
    if (!registrationId || !eventId || !participantEmail || !timestamp || !hash) {
      return { valid: false, message: 'Invalid QR code data: missing required fields' };
    }
    
    // Check expiry
    if (Date.now() > expiryTime) {
      return { valid: false, message: 'QR code has expired' };
    }
    
    // Verify hash - SECURITY FIX: Use proper secret handling
    const dataToHash = `${registrationId}:${eventId}:${participantEmail}:${timestamp}`;
    const secret = getQRSecret();
    const expectedHash = crypto.createHash('sha256').update(dataToHash + secret).digest('hex');
    
    if (hash !== expectedHash) {
      return { valid: false, message: 'Invalid QR code: security verification failed' };
    }
    
    return { valid: true, message: 'QR code is valid' };
  } catch (error) {
    return { valid: false, message: 'Invalid QR code format' };
  }
}

/**
 * Parse QR code string data
 * @param {string} qrString - The QR code string
 * @returns {Object} Parsed QR data or null if invalid
 */
export function parseQRCodeData(qrString) {
  try {
    return JSON.parse(qrString);
  } catch (error) {
    return null;
  }
}