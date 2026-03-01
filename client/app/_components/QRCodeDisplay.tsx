"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000").replace(/\/api\/?$/, "");

interface QRCodeDisplayProps {
  registrationId: string;
  eventTitle: string;
  participantName: string;
  onClose?: () => void;
}

export const QRCodeDisplay: React.FC<QRCodeDisplayProps> = ({
  registrationId,
  eventTitle,
  participantName,
  onClose,
}) => {
  const [qrImage, setQrImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  useEffect(() => {
    fetchQRCode();
  }, [registrationId]);

  const fetchQRCode = async () => {
    if (!session?.access_token) return;

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `${API_URL}/api/registrations/${registrationId}/qr-code`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch QR code");
      }

      const data = await response.json();
      setQrImage(data.qrCodeImage);
    } catch (err: any) {
      setError(err.message || "Failed to load QR code");
      console.error("Error fetching QR code:", err);
    } finally {
      setLoading(false);
    }
  };

  const downloadQRCode = () => {
    if (!qrImage) return;

    const link = document.createElement("a");
    link.href = qrImage;
    link.download = `qr-ticket-${eventTitle.replace(/[^a-zA-Z0-9]/g, "-")}-${registrationId}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#154CB3] mx-auto mb-4"></div>
            <p className="text-gray-600">Generating QR Code...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
          <div className="text-center">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error Loading QR Code</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <div className="space-x-3">
              <button
                onClick={fetchQRCode}
                className="px-4 py-2 bg-[#154CB3] text-white rounded hover:bg-[#063168] transition-colors"
              >
                Retry
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#063168] text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold">Event Ticket</h3>
            {onClose && (
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-1">{eventTitle}</h4>
            <p className="text-gray-600">{participantName}</p>
          </div>

          {/* QR Code */}
          {qrImage && (
            <div className="mb-6">
              <div className="bg-white p-4 border-2 border-gray-200 rounded-lg inline-block">
                <img
                  src={qrImage}
                  alt="QR Code Ticket"
                  className="w-48 h-48 mx-auto"
                />
              </div>
              <p className="text-sm text-gray-500 mt-3">
                Show this QR code at the event entrance for attendance
              </p>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6 text-left">
            <h5 className="font-semibold text-yellow-800 mb-2">Instructions:</h5>
            <ul className="text-sm text-yellow-700 space-y-1">
              <li>• Save this QR code to your device</li>
              <li>• Present it at the event entrance</li>
              <li>• Make sure the code is clearly visible</li>
              <li>• QR code expires 24 hours after generation</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={downloadQRCode}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
              >
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

