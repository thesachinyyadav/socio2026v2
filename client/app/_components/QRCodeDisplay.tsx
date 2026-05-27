"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { downloadGatedPass } from "@/lib/gatedPass";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

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
  const [pdfLoading, setPdfLoading] = useState(false);
  const { session, userData } = useAuth();

  const isOutsider = userData?.organization_type === "outsider";

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
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      if (!response.ok) throw new Error("Failed to fetch QR code");
      const data = await response.json();
      setQrImage(data.qrCodeImage);
    } catch (err: any) {
      setError(err.message || "Failed to load QR code");
    } finally {
      setLoading(false);
    }
  };

  const downloadAsPDF = async () => {
    if (!qrImage || pdfLoading) return;
    setPdfLoading(true);
    try {
      await downloadGatedPass({
        qrImage,
        eventTitle,
        participantName,
        registrationId,
        isOutsider,
      });
    } catch (err) {
      console.error("PDF generation failed:", err);
    } finally {
      setPdfLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#154CB3] mx-auto mb-3" />
          <p className="text-sm text-gray-500">Generating QR code…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-2xl p-8 w-full max-w-sm text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={fetchQRCode} className="px-4 py-2 bg-[#154CB3] text-white text-sm rounded-lg hover:bg-[#063168] transition-colors">
              Retry
            </button>
            {onClose && (
              <button onClick={onClose} className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors">
                Close
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[90dvh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-slate-100">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Your QR Ticket</p>
            <h3 className="text-sm font-bold text-slate-800 truncate">{eventTitle}</h3>
            <p className="text-xs text-slate-500 truncate">{participantName}</p>
          </div>
          {onClose && (
            <button onClick={onClose} className="ml-3 shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* QR Code */}
        <div className="px-5 py-6 text-center">
          {qrImage && (
            <div className="inline-block p-3 border-2 border-slate-200 rounded-xl bg-white">
              <img
                src={qrImage}
                alt="QR Code"
                className="w-full max-w-[200px] h-auto block mx-auto"
              />
            </div>
          )}
          <div className="mt-4 space-y-1">
            <p className="text-sm text-slate-600">Scan to get your attendance marked at the event.</p>
            {isOutsider && (
              <p className="text-sm text-slate-600">Show this at the campus gate for entry.</p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-5 flex gap-3">
          <button
            onClick={downloadAsPDF}
            disabled={pdfLoading}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-xl hover:bg-[#063168] disabled:opacity-60 transition-colors"
          >
            {pdfLoading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Download Pass
              </>
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-200 transition-colors">
              Close
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
