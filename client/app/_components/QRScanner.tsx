"use client";

import React, { useState, useRef, useEffect } from "react";
import QrScanner from "qr-scanner";
import { useAuth } from "@/context/AuthContext";
import { 
  AlertTriangle, 
  Camera, 
  CheckCircle2, 
  QrCode, 
  X, 
  Volume2, 
  VolumeX, 
  Usb, 
  Keyboard, 
  ShieldAlert,
  Check
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

interface QRScannerProps {
  eventId: string;
  eventTitle: string;
  onScanSuccess?: (result: any) => void;
  onClose?: () => void;
  embedded?: boolean;
  disableClose?: boolean;
}

interface ScanResult {
  name: string;
  email: string;
  registrationId: string;
  status: 'marked_present' | 'already_present';
  markedAt?: string;
}

interface ScanHistoryItem {
  id: string;
  name: string;
  email: string;
  registrationId: string;
  status: 'success' | 'duplicate' | 'error';
  message: string;
  timestamp: Date;
}

export const QRScanner: React.FC<QRScannerProps> = ({
  eventId,
  eventTitle,
  onScanSuccess,
  onClose,
  embedded = false,
  disableClose = false,
}) => {
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const { session, userData } = useAuth();

  // Check if camera device is available on mount without triggering permission prompt
  useEffect(() => {
    QrScanner.hasCamera()
      .then(hasCam => {
        if (!hasCam) {
          setHasPermission(false);
          setError("No camera detected on this device.");
        }
      })
      .catch(err => {
        console.warn("Camera availability check failed:", err);
      });
  }, []);

  // Global timing-based keydown interceptor for HID physical scanner devices
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Ignore if user is typing in standard input/textarea fields
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
      ) {
        return;
      }

      const now = Date.now();
      
      // Reset buffer if manual typing is detected (>100ms inter-character delay)
      if (buffer.length > 0 && now - lastKeyTime > 100) {
        buffer = "";
      }
      
      lastKeyTime = now;

      if (e.key === "Enter") {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          e.preventDefault();
          handleQRScan(trimmed);
          buffer = "";
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [session?.access_token, isScanning]);

  // Camera stream mounting and scanner initialization lifecycle
  useEffect(() => {
    let activeScanner: QrScanner | null = null;

    if (isScanning && videoRef.current) {
      setError(null);
      setScanResult(null);

      activeScanner = new QrScanner(
        videoRef.current,
        async (result) => {
          const data = typeof result === "string" ? result : result?.data;
          if (data) {
            await handleQRScan(data);
          }
        },
        {
          highlightScanRegion: true,
          highlightCodeOutline: true,
          preferredCamera: 'environment',
        }
      );

      activeScanner.start()
        .then(() => {
          setHasPermission(true);
        })
        .catch((err) => {
          console.error("Error starting camera stream:", err);
          setHasPermission(false);
          setError("Camera access is required to scan QR codes. Please allow camera access in browser settings and try again.");
          setIsScanning(false);
        });

      scannerRef.current = activeScanner;
    }

    return () => {
      if (activeScanner) {
        activeScanner.stop();
        activeScanner.destroy();
      }
      if (scannerRef.current === activeScanner) {
        scannerRef.current = null;
      }
    };
  }, [isScanning]);

  // Audio synthesizer beep player
  const playBeep = (type: 'success' | 'duplicate' | 'error') => {
    if (!soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'success') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
        
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
        gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.1);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.2);
      } else if (type === 'duplicate') {
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
      }
    } catch (e) {
      console.error("Audio chime play failed", e);
    }
  };

  const addRecentScan = (name: string, email: string, regId: string, status: 'success' | 'duplicate' | 'error', message: string) => {
    const newItem: ScanHistoryItem = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      email,
      registrationId: regId,
      status,
      message,
      timestamp: new Date()
    };
    setRecentScans(prev => [newItem, ...prev].slice(0, 5));
  };

  const startScanning = async () => {
    setError(null);
    setScanResult(null);
    setIsScanning(true);
  };

  const stopScanning = () => {
    setIsScanning(false);
  };

  const handleQRScan = async (qrData: string) => {
    if (!session?.access_token) return;

    try {
      // Pause camera scanning temporarily to process
      if (scannerRef.current) {
        scannerRef.current.stop();
      }

      const response = await fetch(
        `${API_URL}/api/events/${eventId}/scan-qr`,
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
        setScanResult(result.participant);
        setError(null);
        
        const status = result.participant.status === 'already_present' ? 'duplicate' : 'success';
        const message = status === 'duplicate' ? 'Already checked in' : 'Attendance marked';
        
        playBeep(status);
        addRecentScan(
          result.participant.name || 'Attendee',
          result.participant.email || '',
          result.participant.registrationId || qrData,
          status,
          message
        );

        if (onScanSuccess) {
          onScanSuccess(result);
        }

        // Auto-resume camera scanning after 3 seconds
        setTimeout(() => {
          if (scannerRef.current && isScanning) {
            scannerRef.current.start().catch(err => console.error("Auto-resume failed:", err));
          }
        }, 3000);
      } else {
        const errorMsg = result.error || "Failed to process QR code";
        setError(errorMsg);
        setScanResult(null);

        playBeep('error');
        addRecentScan(
          'Scan Failure',
          '',
          qrData,
          'error',
          errorMsg
        );

        setTimeout(() => {
          if (scannerRef.current && isScanning) {
            scannerRef.current.start().catch(err => console.error("Error-resume failed:", err));
          }
        }, 2000);
      }
    } catch (err: any) {
      console.error("Error processing QR scan:", err);
      const networkErrorMsg = "Network error. Please try again.";
      setError(networkErrorMsg);
      setScanResult(null);

      playBeep('error');
      addRecentScan(
        'Scan Failure',
        '',
        qrData,
        'error',
        networkErrorMsg
      );

      setTimeout(() => {
        if (scannerRef.current && isScanning) {
          scannerRef.current.start().catch(e => console.error("Catch-resume failed:", e));
        }
      }, 2000);
    }
  };

  const clearResult = () => {
    setScanResult(null);
    setError(null);
  };

  const containerClassName = embedded
    ? "w-full flex justify-center"
    : "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";
  const panelClassName = embedded
    ? "bg-white rounded-lg shadow-sm border border-slate-200 max-w-md w-full overflow-hidden"
    : "bg-white rounded-lg shadow-xl max-w-md w-full mx-4 overflow-hidden";

  return (
    <div className={containerClassName}>
      <div className={panelClassName}>
        {/* Header */}
        <div className="bg-gradient-to-r from-[#154CB3] to-[#063168] text-white p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold">QR Scanner</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className="text-blue-100 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/10"
                title={soundEnabled ? "Mute beep sounds" : "Unmute beep sounds"}
              >
                {soundEnabled ? <Volume2 className="w-5.5 h-5.5" /> : <VolumeX className="w-5.5 h-5.5" />}
              </button>
              {!disableClose && onClose && (
                <button
                  onClick={() => {
                    stopScanning();
                    onClose?.();
                  }}
                  className="text-white hover:text-gray-200 transition-colors p-1.5 rounded-lg hover:bg-white/10"
                  aria-label="Close scanner"
                >
                  <X className="w-6 h-6" />
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-blue-100 mt-1">{eventTitle}</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {!isScanning ? (
            <div className="text-center">
              <div className="mb-4">
                <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-semibold text-gray-800 mb-2">QR Code Scanner</h4>
                <p className="text-gray-600 text-sm mb-4">
                  Scan participant QR codes to mark attendance instantly.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 rounded-full text-xs font-semibold text-[#154CB3] mb-4">
                  <Usb className="w-3.5 h-3.5" />
                  External USB scanner supported
                </div>
              </div>

              {hasPermission === false && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
                  <p className="text-red-700 text-sm">
                    Camera permission is required to scan QR codes. Please allow camera access in your browser settings and try again.
                  </p>
                </div>
              )}

              <button
                onClick={startScanning}
                className="px-6 py-3 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors flex items-center gap-2 mx-auto"
              >
                <Camera className="w-5 h-5" />
                Start Camera Scanner
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
              <div className="text-center mb-4 flex flex-col items-center gap-1">
                <p className="text-gray-600 text-sm font-semibold">
                  Position QR code within the frame
                </p>
                <p className="text-xs text-gray-400">
                  (Or scan directly with your USB scanner device)
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
                  Stop Camera
                </button>
              </div>
            </div>
          )}

          {/* Current Scan Result */}
          {scanResult && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center mb-2">
                <CheckCircle2 className="w-5 h-5 text-green-600 mr-2" />
                <span className="font-semibold text-green-800">
                  {scanResult.status === 'marked_present' ? 'Attendance Marked!' : 'Already Scanned'}
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

          {/* Current Scan Error Display */}
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <span className="font-semibold text-red-800">Scan Error</span>
              </div>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Recent Scans Session Log */}
          {recentScans.length > 0 && (
            <div className="mt-6 border-t border-slate-100 pt-4">
              <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <span>Recent Scans</span>
                <span className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full text-[9px] font-bold">
                  {recentScans.length}
                </span>
              </h5>
              <div className="space-y-2 max-h-[160px] overflow-y-auto pr-1">
                {recentScans.map((scan) => (
                  <div
                    key={scan.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                      scan.status === 'success'
                        ? 'bg-emerald-50/40 border-emerald-100 text-emerald-800'
                        : scan.status === 'duplicate'
                        ? 'bg-amber-50/40 border-amber-100 text-amber-800'
                        : 'bg-red-50/40 border-red-100 text-red-800'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <span className="truncate">{scan.name}</span>
                        <span className="text-[10px] font-normal opacity-70">({scan.registrationId})</span>
                      </div>
                      <div className="text-[10px] opacity-75 truncate mt-0.5">{scan.message}</div>
                    </div>
                    <div className="text-[10px] opacity-60 font-semibold shrink-0 ml-2 font-mono">
                      {scan.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
