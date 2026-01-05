"use client";

import React, { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
import { useAuth } from "@/context/AuthContext";

interface QRScannerProps {
  eventId: string;
  eventTitle: string;
  onScanSuccess?: (result: any) => void;
  onClose?: () => void;
}

interface ScanResult {
  name: string;
  email: string;
  registrationId: string;
  status: 'marked_present' | 'already_present';
  markedAt?: string;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  eventId,
  eventTitle,
  onScanSuccess,
  onClose,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const { session, userData } = useAuth();

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.destroy();
      }
    };
  }, []);

  const checkCameraPermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (err) {
      console.error("Camera permission denied:", err);
      setHasPermission(false);
      setError("Camera access is required to scan QR codes. Please allow camera access and try again.");
      return false;
    }
  };

  const startScanning = async () => {
    if (!videoRef.current) return;

    const hasCamera = await checkCameraPermission();
    if (!hasCamera) return;

    try {
      setIsScanning(true);
      setError(null);
      setScanResult(null);

      // Initialize QR scanner
      scannerRef.current = new QrScanner(
        videoRef.current,
        async (result) => {
          if (result?.data) {
            await handleQRScan(result.data);
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment', // Use back camera on mobile
        }
      );

      await scannerRef.current.start();
    } catch (err: any) {
      console.error("Error starting scanner:", err);
      setError("Failed to start camera. Please try again.");
      setIsScanning(false);
    }
  };

  const stopScanning = () => {
    if (scannerRef.current) {
      scannerRef.current.stop();
      scannerRef.current.destroy();
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const handleQRScan = async (qrData: string) => {
    if (!session?.access_token) return;

    try {
      // Stop scanning temporarily to process the result
      if (scannerRef.current) {
        scannerRef.current.stop();
      }

      const response = await fetch(
        `http://localhost:8000/api/events/${eventId}/scan-qr`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            qrCodeData: qrData,
            scannedBy: userData?.email,
            scannerInfo: {
              userAgent: navigator.userAgent,
              timestamp: new Date().toISOString(),
            },
          }),
        }
      );

      const result = await response.json();

      if (response.ok) {
        // Success - show result
        setScanResult(result.participant);
        setError(null);
        
        if (onScanSuccess) {
          onScanSuccess(result);
        }

        // Auto-resume scanning after 3 seconds
        setTimeout(() => {
          if (scannerRef.current && isScanning) {
            scannerRef.current.start();
          }
        }, 3000);
      } else {
        // Error - show error message
        setError(result.error || "Failed to process QR code");
        setScanResult(null);

        // Resume scanning after showing error
        setTimeout(() => {
          if (scannerRef.current && isScanning) {
            scannerRef.current.start();
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error("Error processing QR scan:", err);
      setError("Network error. Please try again.");
      setScanResult(null);

      // Resume scanning after error
      setTimeout(() => {
        if (scannerRef.current && isScanning) {
          scannerRef.current.start();
        }
      }, 2000);
    }
  };

  const clearResult = () => {
    setScanResult(null);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#063168] text-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">QR Scanner</h3>
            <button
              onClick={() => {
                stopScanning();
                onClose?.();
              }}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <p className="text-sm text-blue-100 mt-1">{eventTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isScanning ? (
            <div className="text-center">
              <div className="mb-4">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 16h4m-4-4h4m-4-4v1m0 0h-1m1-1V8a5 5 0 00-10 0v.01M8 7a3 3 0 016 0v.01M12 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <h4 className="text-lg font-semibold text-gray-800 mb-2">QR Code Scanner</h4>
                <p className="text-gray-600 mb-4">
                  Scan participant QR codes to mark attendance instantly
                </p>
              </div>

              {hasPermission === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-700 text-sm">
                    Camera permission is required to scan QR codes. Please allow camera access and try again.
                  </p>
                </div>
              )}

              <button
                onClick={startScanning}
                className="px-6 py-3 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors flex items-center gap-2 mx-auto"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                Start Scanning
              </button>
            </div>
          ) : (
            <div>
              {/* Camera View */}
              <div className="relative mb-4">
                <video
                  ref={videoRef}
                  className="w-full rounded-lg bg-black"
                  style={{ aspectRatio: '1/1' }}
                />
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute inset-4 border-2 border-white rounded-lg opacity-50"></div>
                </div>
              </div>

              {/* Scan Status */}
              <div className="text-center mb-4">
                <p className="text-gray-600 text-sm">
                  Position QR code within the frame
                </p>
              </div>

              {/* Controls */}
              <div className="flex gap-3">
                <button
                  onClick={clearResult}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                >
                  Clear
                </button>
                <button
                  onClick={stopScanning}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Stop
                </button>
              </div>
            </div>
          )}

          {/* Scan Result */}
          {scanResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-green-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-semibold text-green-800">
                  {scanResult.status === 'marked_present' ? 'Attendance Marked!' : 'Already Present'}
                </span>
              </div>
              <div className="text-sm text-green-700">
                <p><strong>Name:</strong> {scanResult.name}</p>
                <p><strong>Email:</strong> {scanResult.email}</p>
                {scanResult.markedAt && (
                  <p><strong>Time:</strong> {new Date(scanResult.markedAt).toLocaleString()}</p>
                )}
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="font-semibold text-red-800">Scan Error</span>
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};