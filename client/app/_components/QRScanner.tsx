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
  const [scannerMode, setScannerMode] = useState<'camera' | 'hardware'>('camera');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [hardwareInputValue, setHardwareInputValue] = useState("");
  const [recentScans, setRecentScans] = useState<ScanHistoryItem[]>([]);
  const [hardwareInputFocused, setHardwareInputFocused] = useState(false);

  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScanner | null>(null);
  const hardwareInputRef = useRef<HTMLInputElement>(null);
  const { session, userData } = useAuth();

  useEffect(() => {
    return () => {
      // Cleanup scanner on unmount
      if (scannerRef.current) {
        scannerRef.current.destroy();
      }
    };
  }, []);

  // Sync mode changes to starting/stopping camera
  useEffect(() => {
    if (scannerMode === 'hardware') {
      stopScanning();
    } else {
      // Auto-start camera if permissions are active or can be requested
      startScanning().catch(err => console.log("Camera auto-start deferred:", err));
    }
  }, [scannerMode]);

  // Periodically keep input focused when in hardware mode
  useEffect(() => {
    if (scannerMode !== 'hardware') return;

    const interval = setInterval(() => {
      if (document.activeElement !== hardwareInputRef.current) {
        hardwareInputRef.current?.focus();
      }
    }, 1000);

    hardwareInputRef.current?.focus();

    return () => clearInterval(interval);
  }, [scannerMode]);

  // Global timing-based keydown interceptor for fast USB scanner outputs
  useEffect(() => {
    if (scannerMode !== 'hardware') return;

    let buffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Skip if focused on standard fields except our hardware scanner input field
      if (
        target && 
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && 
        target.id !== 'hardware-scanner-input-field'
      ) {
        return;
      }

      const now = Date.now();
      
      // Reset buffer if manual typing is detected (>50ms inter-character delay)
      if (buffer.length > 0 && now - lastKeyTime > 50) {
        buffer = "";
      }
      
      lastKeyTime = now;

      if (e.key === "Enter") {
        const trimmed = buffer.trim();
        if (trimmed.length > 0) {
          e.preventDefault();
          handleQRScan(trimmed);
          buffer = "";
          setHardwareInputValue("");
        }
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => {
      window.removeEventListener("keydown", handleGlobalKeyDown);
    };
  }, [scannerMode, session?.access_token]);

  // Audio synthesizer chime generator
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
        // High pitch pleasant double beep
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
        // Low warning beep
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      } else {
        // Low buzzer for error
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
          const data = typeof result === "string" ? result : result?.data;
          if (data) {
            await handleQRScan(data);
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
      // Pause camera scanning temporarily to process
      if (scannerRef.current && scannerMode === 'camera') {
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
        if (scannerMode === 'camera') {
          setTimeout(() => {
            if (scannerRef.current && isScanning) {
              scannerRef.current.start().catch(err => console.error("Auto-resume failed:", err));
            }
          }, 3000);
        }
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

        if (scannerMode === 'camera') {
          setTimeout(() => {
            if (scannerRef.current && isScanning) {
              scannerRef.current.start().catch(err => console.error("Error-resume failed:", err));
            }
          }, 2000);
        }
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

      if (scannerMode === 'camera') {
        setTimeout(() => {
          if (scannerRef.current && isScanning) {
            scannerRef.current.start().catch(e => console.error("Catch-resume failed:", e));
          }
        }, 2000);
      }
    }
  };

  const handleHardwareInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const value = hardwareInputValue.trim();
      if (value) {
        handleQRScan(value);
        setHardwareInputValue("");
      }
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

        {/* Mode Selector Tabs */}
        <div className="flex bg-slate-100 p-1 border-b border-slate-200">
          <button
            onClick={() => setScannerMode('camera')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              scannerMode === 'camera'
                ? 'bg-white text-[#154CB3] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Camera className="w-4 h-4" />
            Camera Scanner
          </button>
          <button
            onClick={() => setScannerMode('hardware')}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all ${
              scannerMode === 'hardware'
                ? 'bg-white text-[#154CB3] shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Usb className="w-4 h-4" />
            Hardware Scanner
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {scannerMode === 'camera' ? (
            /* CAMERA SCANNER VIEW */
            !isScanning ? (
              <div className="text-center">
                <div className="mb-4">
                  <QrCode className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-semibold text-gray-800 mb-2">QR Code Scanner</h4>
                  <p className="text-gray-600 text-sm mb-4">
                    Scan participant QR codes to mark attendance instantly
                  </p>
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
            )
          ) : (
            /* HARDWARE SCANNER VIEW */
            <div 
              onClick={() => hardwareInputRef.current?.focus()}
              className="cursor-pointer border border-dashed border-slate-200 rounded-xl p-6 bg-slate-50 flex flex-col items-center justify-center relative overflow-hidden transition-all hover:bg-slate-100 min-h-[260px]"
            >
              {/* Dotted matrix pattern */}
              <div className="absolute inset-0 pointer-events-none opacity-20" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '16px 16px' }} />
              
              <div className="relative z-10 text-center flex flex-col items-center">
                <div className="relative mb-4 flex items-center justify-center">
                  {/* Glowing Pulse Rings */}
                  <div className="absolute w-20 h-20 bg-blue-100 rounded-full animate-pulse-soft opacity-60" />
                  <div className="absolute w-28 h-28 bg-blue-50 rounded-full animate-pulse-soft opacity-30" />
                  
                  <div className="w-16 h-16 bg-gradient-to-tr from-[#154CB3] to-[#3b82f6] rounded-full flex items-center justify-center shadow-lg text-white">
                    <Usb className="w-8 h-8 animate-bounce-soft" />
                  </div>
                </div>

                <h4 className="text-base font-bold text-slate-800 mb-1">
                  Hardware Scanner Active
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mb-4">
                  Connect your USB/Bluetooth scanner gun and scan a QR code. Click anywhere on this card to refocus.
                </p>

                {/* Status Indicator Pill */}
                <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold shadow-sm transition-all border ${
                  hardwareInputFocused
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                    : 'bg-amber-50 border-amber-200 text-amber-700 animate-pulse'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${hardwareInputFocused ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                  {hardwareInputFocused ? 'Ready for scan input' : 'Click to focus scanner'}
                </div>

                {/* Input field for keyboard emulation fallback */}
                <div className="mt-4 w-full max-w-[240px]">
                  <input
                    ref={hardwareInputRef}
                    id="hardware-scanner-input-field"
                    type="text"
                    placeholder="Scan or type registration ID..."
                    value={hardwareInputValue}
                    onChange={(e) => setHardwareInputValue(e.target.value)}
                    onKeyDown={handleHardwareInputKeyDown}
                    onFocus={() => setHardwareInputFocused(true)}
                    onBlur={() => setHardwareInputFocused(false)}
                    className="w-full text-center text-sm font-semibold tracking-wider uppercase px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-slate-400"
                  />
                </div>
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

