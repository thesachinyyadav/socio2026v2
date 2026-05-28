"use client";

import React, { useState, useRef, useEffect } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { useAuth } from "@/context/AuthContext";
import { 
  AlertTriangle, 
  Camera, 
  CheckCircle2, 
  QrCode, 
  X, 
  Volume2, 
  VolumeX, 
  Check,
  ChevronRight,
  User,
  Mail,
  Calendar,
  Clock,
  ShieldCheck
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

  // Scanning starts automatically on mount to immediately request permission
  const [isScanning, setIsScanning] = useState(true);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);

  // Viewport flashing state: "idle" | "success" | "duplicate" | "error"
  const [viewportStatus, setViewportStatus] = useState<"idle" | "success" | "duplicate" | "error">("idle");
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clicked participant detail drawer state
  const [selectedRow, setSelectedRow] = useState<any | null>(null);

  const [page, setPage] = useState(1);
  const ITEMS_PER_PAGE = 5;

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);
  const { session, userData } = useAuth();

  // Flash viewport borders on scan outcome
  const triggerViewportFlash = (status: "success" | "duplicate" | "error") => {
    setViewportStatus(status);
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(() => {
      setViewportStatus("idle");
    }, 1500);
  };

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    };
  }, []);

  // Global timing-based keydown interceptor for HID physical scanner devices
  useEffect(() => {
    let buffer = "";
    let lastKeyTime = Date.now();

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
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

  // Camera stream mounting and scanner initialization lifecycle using html5-qrcode
  // Resolves the race condition by retrying initialization if DOM node isn't mounted yet
  useEffect(() => {
    let html5QrCode: Html5Qrcode | null = null;
    let isMounted = true;

    if (isScanning) {
      const initScanner = () => {
        const targetElement = document.getElementById("qr-reader");
        if (!targetElement) {
          // Retry initialization if DOM hasn't rendered the container yet
          const retryTimer = setTimeout(() => {
            if (isMounted && isScanning) {
              initScanner();
            }
          }, 80);
          return () => clearTimeout(retryTimer);
        }

        setError(null);
        setScanResult(null);

        html5QrCode = new Html5Qrcode("qr-reader");
        html5QrCode.start(
          { facingMode: "environment" },
          {
            fps: 15,
            qrbox: (width, height) => {
              const size = Math.min(width, height) * 0.65;
              return { width: size, height: size };
            }
          },
          async (qrCodeMessage) => {
            if (qrCodeMessage) {
              await handleQRScan(qrCodeMessage);
            }
          },
          () => {
            // Parse failures are normal on frames without QRs
          }
        )
        .then(() => {
          if (isMounted) setHasPermission(true);
        })
        .catch((err) => {
          console.error("Error starting camera stream:", err);
          if (isMounted) {
            setHasPermission(false);
            const errorMsg = err?.message || String(err) || "Unknown error";
            setError(`Camera error: ${errorMsg}. Please ensure camera access is allowed in your browser.`);
            setIsScanning(false);
          }
        });

        scannerRef.current = html5QrCode;
      };

      initScanner();
    }

    return () => {
      isMounted = false;
      if (html5QrCode) {
        if (html5QrCode.isScanning) {
          html5QrCode.stop()
            .then(() => {
              html5QrCode?.clear();
            })
            .catch(e => console.error("Error stopping html5-qrcode:", e));
        }
      }
      scannerRef.current = null;
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
    setRecentScans(prev => [newItem, ...prev]);
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
    if (!session?.access_token || isProcessingRef.current) return;

    try {
      isProcessingRef.current = true;
      setError(null);

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
        
        const status = result.participant.status === 'already_present' ? 'duplicate' : 'success';
        const message = status === 'duplicate' ? 'Already checked in' : 'Attendance marked';
        
        playBeep(status);
        triggerViewportFlash(status);
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

        // Highly responsive 1.5s debounce lock (reduced from 3.0s)
        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1500);
      } else {
        const errorMsg = result.error || "Failed to process QR code";
        setError(errorMsg);
        setScanResult(null);

        playBeep('error');
        triggerViewportFlash('error');
        addRecentScan(
          'Scan Failure',
          '',
          qrData,
          'error',
          errorMsg
        );

        setTimeout(() => {
          isProcessingRef.current = false;
        }, 1500);
      }
    } catch (err: any) {
      console.error("Error processing QR scan:", err);
      const networkErrorMsg = "Network error. Please try again.";
      setError(networkErrorMsg);
      setScanResult(null);

      playBeep('error');
      triggerViewportFlash('error');
      addRecentScan(
        'Scan Failure',
        '',
        qrData,
        'error',
        networkErrorMsg
      );

      setTimeout(() => {
        isProcessingRef.current = false;
      }, 1500);
    }
  };

  const clearResult = () => {
    setScanResult(null);
    setError(null);
  };

  // Pagination calculations based on local session scans
  const totalPages = Math.ceil(recentScans.length / ITEMS_PER_PAGE) || 1;
  const paginatedScans = recentScans.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const handlePrevPage = () => {
    if (page > 1) setPage(page - 1);
  };

  const handleNextPage = () => {
    if (page < totalPages) setPage(page + 1);
  };

  const containerClassName = embedded
    ? "w-full max-w-7xl mx-auto"
    : "fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto";

  return (
    <div className={containerClassName}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start w-full">
        
        {/* Left Column: QR Scanner View Card */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[460px]">
          {/* Header (Hidden in embedded mode to avoid stacked navy headers) */}
          {!embedded && (
            <div className="bg-gradient-to-r from-[#011F7B] to-[#0d34a8] text-white p-5 flex items-center justify-between shadow-sm">
              <div>
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <QrCode className="w-5.5 h-5.5 text-[#FFBA09] animate-pulse" />
                  Live Camera Scanner
                </h3>
                <p className="text-xs text-blue-100/80 mt-1">{eventTitle}</p>
              </div>
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
          )}

          {/* Scanner View Area */}
          <div className="p-6 flex-1 flex flex-col justify-center">
            
            {/* The QR reader container is persistently in the DOM to avoid race conditions */}
            <div className={`flex flex-col items-center w-full ${isScanning ? "block" : "hidden"}`}>
              <div className={`scan-viewport scan-viewport-${viewportStatus} max-w-sm w-full mx-auto`}>
                <div id="qr-reader" className="w-full h-full" style={{ aspectRatio: '1/1' }} />
                
                {/* Visual Viewfinder Guides */}
                <div className="scan-frame">
                  <div className="scan-corner scan-corner-tl" />
                  <div className="scan-corner scan-corner-tr" />
                  <div className="scan-corner scan-corner-bl" />
                  <div className="scan-corner scan-corner-br" />
                  <div className="scan-line" />
                </div>
              </div>

              <div className="text-center mt-5 mb-5">
                <p className="text-slate-600 text-sm font-semibold flex items-center justify-center">
                  Align attendee QR code inside the frame
                </p>
              </div>

              <div className="flex gap-3 w-full max-w-sm">
                <button
                  onClick={clearResult}
                  className="flex-1 py-2.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors active:scale-98 text-xs"
                >
                  Clear Status
                </button>
                <button
                  onClick={stopScanning}
                  className="flex-1 py-2.5 px-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl transition-colors active:scale-98 shadow-sm flex items-center justify-center gap-1 text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                  Stop Camera
                </button>
                <button
                  onClick={() => setSoundEnabled(!soundEnabled)}
                  className="py-2.5 px-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors active:scale-98 flex items-center justify-center"
                  title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
                >
                  {soundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>

            {/* Stopped state view */}
            {!isScanning && (
              <div className="text-center py-10 flex flex-col items-center">
                <div className="relative mb-6">
                  {/* Dotted grid preview frame placeholder */}
                  <div className="w-[180px] h-[180px] bg-slate-50 border border-slate-100 rounded-3xl flex items-center justify-center relative shadow-inner">
                    <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(#CBD5E1 1.2px, transparent 1.2px)', backgroundSize: '16px 16px', opacity: 0.3 }} />
                    <div className="absolute inset-0 p-3">
                      <div className="absolute top-3 left-3 w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-[#FFBA09] rounded-tl-lg" />
                      <div className="absolute top-3 right-3 w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-[#FFBA09] rounded-tr-lg" />
                      <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-[#FFBA09] rounded-bl-lg" />
                      <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-[#FFBA09] rounded-br-lg" />
                    </div>
                    <QrCode className="w-12 h-12 text-slate-300" />
                  </div>
                </div>
                
                <h4 className="text-lg font-bold text-slate-800 mb-2">Camera Stopped</h4>
                <p className="text-slate-500 text-sm max-w-sm mb-6">
                  Verify attendees instantly. Start the camera feed or scan tickets using a connected physical hardware scanner.
                </p>

                {hasPermission === false && (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 max-w-md">
                    <p className="text-red-700 text-xs text-left leading-relaxed">
                      <strong>Camera Permission Blocked:</strong> Please allow camera access in your browser preferences and try again.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 items-center">
                  <button
                    onClick={startScanning}
                    className="px-6 py-3 bg-[#011F7B] hover:bg-[#1E3FAB] text-white rounded-xl font-semibold transition-all shadow-md flex items-center gap-2 transform active:scale-95 text-sm"
                  >
                    <Camera className="w-4.5 h-4.5" />
                    Start Camera Feed
                  </button>
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="p-3 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-colors active:scale-98 flex items-center justify-center"
                    title={soundEnabled ? "Mute sounds" : "Unmute sounds"}
                  >
                    {soundEnabled ? <Volume2 className="w-4.5 h-4.5" /> : <VolumeX className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>
            )}

            {/* Current Scan Result feedback popup under camera */}
            {scanResult && (
              <div className="mt-6 p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 animate-fade-in">
                <div className="w-9 h-9 bg-emerald-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                  <CheckCircle2 className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-emerald-900 text-sm">
                    {scanResult.status === 'marked_present' ? 'Attendance Checked In!' : 'Already Checked In'}
                  </h5>
                  <div className="text-xs text-emerald-800 mt-1.5 space-y-1">
                    <p><strong>Name:</strong> {scanResult.name}</p>
                    <p><strong>Email:</strong> {scanResult.email}</p>
                    <p><strong>Registration ID:</strong> {scanResult.registrationId}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Current Scan Error Display */}
            {error && (
              <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-3 animate-fade-in">
                <div className="w-9 h-9 bg-rose-500 rounded-full flex items-center justify-center text-white shrink-0 shadow-sm mt-0.5">
                  <AlertTriangle className="w-5.5 h-5.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h5 className="font-bold text-rose-900 text-sm">Scan Reference Error</h5>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Local session-level scans list */}
        <div className="lg:col-span-6 bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden flex flex-col min-h-[460px]">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div>
              <h3 className="font-bold text-slate-800 text-sm tracking-wider uppercase m-0">Recent Scans</h3>
              <p className="text-xs text-slate-500 mt-1">Scans in the current session. Click any record to view details.</p>
            </div>
            <button
              onClick={() => setRecentScans([])}
              className="px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-red-200"
              title="Clear session scans log"
            >
              Clear Logs
            </button>
          </div>

          <div className="p-6 flex-1 flex flex-col justify-between">
            <div className="space-y-3">
              {recentScans.length === 0 ? (
                <div className="text-center py-20 text-slate-400">
                  <div className="w-12 h-12 bg-slate-50 text-slate-300 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-slate-100 shadow-inner">
                    <Check className="w-6 h-6 animate-pulse" />
                  </div>
                  <p className="text-sm font-bold text-slate-700">No Scans Recorded Yet</p>
                  <p className="text-xs max-w-xs mx-auto mt-1 leading-relaxed">
                    Attendee scan history will show up here automatically when verification succeeds.
                  </p>
                </div>
              ) : (
                paginatedScans.map((item) => {
                  const getInitials = (name: string) => {
                    return (name || "A")
                      .split(" ")
                      .slice(0, 2)
                      .map((w) => w[0])
                      .join("")
                      .toUpperCase();
                  };
                  
                  const displayName = item.name || "Attendee";
                  const displayId = item.registrationId;
                  const timeStr = item.timestamp
                    ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : "TBD";

                  // Colors and badges based on status
                  let rowIconClass = "scan-row-success";
                  let badgeText = "Verified";
                  let badgeClass = "scan-row-badge";

                  if (item.status === 'duplicate') {
                    rowIconClass = "scan-row-duplicate";
                    badgeText = "Recheck";
                    badgeClass = "scan-row-badge scan-row-badge-duplicate";
                  } else if (item.status === 'error') {
                    rowIconClass = "scan-row-error";
                    badgeText = "Error";
                    badgeClass = "scan-row-badge scan-row-badge-error";
                  }

                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        // Adapt the structure to open the Participant details sheet
                        setSelectedRow({
                          registration_type: "individual", // fallback to individual
                          individual_name: displayName,
                          individual_register_number: displayId,
                          individual_email: item.email || "No Email",
                          marked_at: item.timestamp.toISOString(),
                        });
                      }}
                      className="scan-row"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        {/* Status colored icon/avatar */}
                        <div className={`scan-row-icon ${rowIconClass}`}>
                          <span className="text-[13px] font-black">
                            {getInitials(displayName)}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-slate-800 text-[14px] truncate">{displayName}</p>
                          <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                            {displayId ? `${displayId}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3.5 shrink-0 ml-2">
                        <div className="scan-row-right">
                          <span className={badgeClass}>
                            {badgeText}
                          </span>
                          <span className="scan-row-time mt-1">
                            {timeStr}
                          </span>
                        </div>
                        <ChevronRight className="w-4.5 h-4.5 text-slate-300" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Pagination Controls */}
            {recentScans.length > 0 && (
              <div className="border-t border-slate-100 pt-5 mt-5 flex items-center justify-between text-xs">
                <span className="text-slate-500 font-semibold">
                  Showing {(page - 1) * ITEMS_PER_PAGE + 1} - {Math.min(page * ITEMS_PER_PAGE, recentScans.length)} of {recentScans.length}
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={handlePrevPage}
                    disabled={page === 1}
                    className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-30 disabled:grayscale cursor-pointer"
                  >
                    Previous
                  </button>
                  <button
                    onClick={handleNextPage}
                    disabled={page === totalPages}
                    className="px-3.5 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl transition-colors disabled:opacity-30 disabled:grayscale cursor-pointer"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── Slide-up Participant Detail Modal Sheet ── */}
      {selectedRow && (
        <div 
          className="participant-sheet-overlay" 
          onClick={() => setSelectedRow(null)}
        >
          <div 
            className="participant-sheet" 
            onClick={e => e.stopPropagation()}
          >
            <div className="participant-sheet-header">
              <div>
                <h3 className="participant-sheet-title">
                  {selectedRow.registration_type === "individual"
                    ? (selectedRow.individual_name || "Individual Attendee")
                    : (selectedRow.team_name || selectedRow.team_leader_name || "Team Attendee")}
                </h3>
                <p className="participant-sheet-subtitle flex items-center gap-1.5 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  <span>
                    Reg ID: {selectedRow.registration_type === "individual"
                      ? selectedRow.individual_register_number
                      : selectedRow.team_leader_register_number || "No Registration ID"}
                  </span>
                </p>
              </div>
              <button 
                className="participant-sheet-close border-none" 
                onClick={() => setSelectedRow(null)} 
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="participant-sheet-grid mt-4">
              <div className="participant-sheet-field">
                <span className="participant-sheet-label">Verification Status</span>
                <div className="participant-sheet-badge success mt-1">
                  <CheckCircle2 className="w-4.5 h-4.5" />
                  <span>Verified • Checked In</span>
                </div>
              </div>
              
              <div className="participant-sheet-field">
                <span className="participant-sheet-label">Checked In Time</span>
                <span className="participant-sheet-value font-bold text-slate-900 mt-1 flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-[#011F7B]" />
                  {selectedRow.marked_at
                    ? new Date(selectedRow.marked_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                    : "TBD"}
                </span>
              </div>

              <div className="participant-sheet-field col-span-2">
                <span className="participant-sheet-label">Email Address</span>
                <span className="participant-sheet-value font-semibold text-slate-700 mt-1 flex items-center gap-1.5">
                  <Mail className="w-4 h-4 text-[#011F7B]" />
                  {selectedRow.registration_type === "individual"
                    ? selectedRow.individual_email
                    : selectedRow.team_leader_email || "No Email"}
                </span>
              </div>

              <div className="participant-sheet-field col-span-2">
                <span className="participant-sheet-label">Event Assignment</span>
                <span className="participant-sheet-value font-bold text-[#011F7B] mt-1 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {eventTitle}
                </span>
              </div>
              
              <div className="participant-sheet-field">
                <span className="participant-sheet-label">Checked In Date</span>
                <span className="participant-sheet-value font-bold text-slate-950 mt-1 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#011F7B]" />
                  {selectedRow.marked_at
                    ? new Date(selectedRow.marked_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
                    : "TBD"}
                </span>
              </div>

              <div className="participant-sheet-field">
                <span className="participant-sheet-label">Ticket Type</span>
                <span className="participant-sheet-value font-bold text-slate-950 mt-1 capitalize">
                  {selectedRow.registration_type} Ticket
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
