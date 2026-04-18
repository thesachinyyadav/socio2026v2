"use client";

import { useAuth } from "@/context/AuthContext";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

const ALLOWED_DOMAIN = "christuniversity.in";

/**
 * Minimal Ping-Pong (Keep-Up) mini game
 * - NEW: Mouse alignment (follow the cursor anywhere on the page), with smooth easing.
 * - Move with mouse, touch, or arrow keys. Keep the ball up.
 */
function PingPongMini() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const W = 340;
  const H = 200;
  const R = 8;
  const PADDLE_H = 10;

  const stateRef = useRef({
    x: W * 0.5,
    y: H * 0.35,
    vx: 2.0,
    vy: 2.2,
    paddleX: W * 0.5 - 45,
    paddleW: 90,
    // smooth target for mouse-alignment mode
    targetPX: W * 0.5 - 45,
    running: false,
    score: 0,
    best: 0,
  });

  const [ui, setUi] = useState({
    running: false,
    score: 0,
    best: 0,
    gameOver: false,
  });

  // Mouse alignment toggle (default ON)
  const [alignToMouse, setAlignToMouse] = useState(true);
  const alignRef = useRef(alignToMouse);
  useEffect(() => {
    alignRef.current = alignToMouse;
  }, [alignToMouse]);

  useEffect(() => {
    // Load best score
    const stored = Number.parseInt(localStorage.getItem("pong_best") || "0", 10);
    if (!Number.isNaN(stored)) {
      stateRef.current.best = stored;
      setUi((u) => ({ ...u, best: stored }));
    }

    const onKey = (e: KeyboardEvent) => {
      const s = stateRef.current;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        toggleRun();
      } else if (e.key === "ArrowLeft") {
        s.paddleX = Math.max(0, s.paddleX - 18);
        s.targetPX = s.paddleX;
      } else if (e.key === "ArrowRight") {
        s.paddleX = Math.min(W - s.paddleW, s.paddleX + 18);
        s.targetPX = s.paddleX;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Global mouse alignment: follow cursor anywhere, mapped into canvas space
  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!alignRef.current) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const s = stateRef.current;
      const clamped = Math.max(0, Math.min(W - s.paddleW, mx - s.paddleW / 2));
      s.targetPX = clamped;
    };
    if (alignToMouse) {
      window.addEventListener("mousemove", move, { passive: true });
      return () => window.removeEventListener("mousemove", move);
    }
  }, [alignToMouse]);

  const reset = () => {
    const s = stateRef.current;
    s.x = W * 0.5;
    s.y = H * 0.35;
    s.vx = Math.random() > 0.5 ? 2.0 : -2.0;
    s.vy = 2.2;
    s.paddleW = 90;
    s.paddleX = W * 0.5 - s.paddleW / 2;
    s.targetPX = s.paddleX;
    s.score = 0;
    s.running = false;
    setUi({ running: false, score: 0, best: s.best, gameOver: false });
  };

  const start = () => {
    const s = stateRef.current;
    s.running = true;
    setUi((u) => ({ ...u, running: true, gameOver: false }));
    loop();
  };

  const toggleRun = () => {
    const s = stateRef.current;
    if (ui.gameOver) {
      reset();
      start();
      return;
    }
    s.running = !s.running;
    setUi((u) => ({ ...u, running: s.running }));
    if (s.running) loop();
    else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const onCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Still support direct control when inside canvas
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const s = stateRef.current;
    const clamped = Math.max(0, Math.min(W - s.paddleW, mx - s.paddleW / 2));
    if (alignRef.current) {
      s.targetPX = clamped;
    } else {
      s.paddleX = clamped;
      s.targetPX = clamped;
    }
  };

  const onTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const t = e.touches[0];
    const mx = t.clientX - rect.left;
    const s = stateRef.current;
    const clamped = Math.max(0, Math.min(W - s.paddleW, mx - s.paddleW / 2));
    if (alignRef.current) {
      s.targetPX = clamped;
    } else {
      s.paddleX = clamped;
      s.targetPX = clamped;
    }
  };

  const loop = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const s = stateRef.current;

    // Smoothly align paddle to target if enabled
    if (alignRef.current) {
      const ease = 0.35; // smoothing factor
      s.paddleX += (s.targetPX - s.paddleX) * ease;
      // clamp
      if (s.paddleX < 0) s.paddleX = 0;
      if (s.paddleX > W - s.paddleW) s.paddleX = W - s.paddleW;
    }

    // Physics
    s.x += s.vx;
    s.y += s.vy;

    // Walls
    if (s.x < R) {
      s.x = R;
      s.vx = Math.abs(s.vx);
    }
    if (s.x > W - R) {
      s.x = W - R;
      s.vx = -Math.abs(s.vx);
    }
    if (s.y < R) {
      s.y = R;
      s.vy = Math.abs(s.vy);
    }

    // Paddle collision
    const paddleY = H - PADDLE_H - 6;
    if (
      s.y + R >= paddleY &&
      s.y + R <= paddleY + Math.abs(s.vy) + 2 &&
      s.x >= s.paddleX &&
      s.x <= s.paddleX + s.paddleW
    ) {
      s.y = paddleY - R;
      s.vy = -Math.max(2.0, Math.abs(s.vy) * 1.04); // bounce upward, gentle speed-up

      // Add a bit of horizontal change based on where it hit
      const hitPos = (s.x - (s.paddleX + s.paddleW / 2)) / (s.paddleW / 2);
      s.vx += hitPos * 0.4;

      s.score += 1;
      if (s.score % 4 === 0 && s.paddleW > 60) {
        s.paddleW -= 6; // small difficulty curve, still forgiving
        // keep target within bounds after width change
        s.targetPX = Math.max(0, Math.min(W - s.paddleW, s.targetPX));
      }
    }

    // Missed
    if (s.y - R > H) {
      s.running = false;
      const best = Math.max(s.best, s.score);
      s.best = best;
      localStorage.setItem("pong_best", String(best));
      setUi({ running: false, score: s.score, best, gameOver: true });
    }

    // Render
    ctx.clearRect(0, 0, W, H);

    // Background
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#f8fbff");
    g.addColorStop(1, "#ffffff");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Top HUD
    ctx.fillStyle = "#374151";
    ctx.font = "bold 12px ui-sans-serif, system-ui";
    ctx.fillText(`Score: ${s.score}`, 10, 18);
    ctx.fillText(`Best: ${s.best}`, W - 70, 18);

    // Paddle
    ctx.fillStyle = "#154CB3";
    ctx.fillRect(s.paddleX, paddleY, s.paddleW, PADDLE_H);
    ctx.fillStyle = "#7898e6";
    ctx.fillRect(s.paddleX, paddleY + PADDLE_H - 2, s.paddleW, 2);

    // Ball
    ctx.beginPath();
    ctx.arc(s.x, s.y, R, 0, Math.PI * 2);
    ctx.fillStyle = "#0F2E7A";
    ctx.shadowColor = "rgba(15,46,122,0.25)";
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;

    if (s.running) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      // Overlays
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#111827";
      ctx.textAlign = "center";
      ctx.font = "bold 14px ui-sans-serif, system-ui";
      ctx.fillText(
        ui.gameOver ? `Nice try! Final: ${s.score}` : "Paused",
        W / 2,
        H / 2 - 6
      );
      ctx.font = "12px ui-sans-serif, system-ui";
      ctx.fillStyle = "#4B5563";
      ctx.fillText(
        ui.gameOver ? "Press Start to play again" : "Press Start to resume",
        W / 2,
        H / 2 + 14
      );
      ctx.textAlign = "left";
    }
  };

  useEffect(() => {
    reset();
    // initial static render background
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, W, H);
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          Keep the ball up. Mouse, touch, or arrow keys.
        </p>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1 text-xs text-gray-600 select-none">
            <input
              type="checkbox"
              checked={alignToMouse}
              onChange={(e) => setAlignToMouse(e.target.checked)}
              className="h-4 w-4 accent-[#154CB3]"
            />
            Mouse align
          </label>
          {!ui.running ? (
            <button
              onClick={() => (ui.gameOver ? (reset(), start()) : start())}
              className="px-3 py-1.5 rounded-full text-white bg-[#154CB3] hover:bg-[#154cb3df] text-sm transition"
            >
              {ui.gameOver ? "Play again" : ui.score > 0 ? "Resume" : "Start"}
            </button>
          ) : (
            <button
              onClick={toggleRun}
              className="px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:bg-gray-50 text-sm transition"
            >
              Pause
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white shadow-inner p-3">
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          onMouseMove={onCanvasMouseMove}
          onTouchMove={onTouchMove}
          className="mx-auto block rounded-lg border border-gray-200 bg-white select-none touch-none"
        />
      </div>
    </div>
  );
}

function ErrorContent() {
  const { signInWithGoogle, isLoading } = useAuth();
  const searchParams = useSearchParams();
  const errorReason = searchParams.get("error");

  const heading = useMemo(() => {
    switch (errorReason) {
      case "invalid_domain":
        return "Sign‑in Limited";
      case "not_authorized":
        return "Access Denied";
      default:
        return "We Hit a Snag";
    }
  }, [errorReason]);

  const primary = useMemo(() => {
    switch (errorReason) {
      case "invalid_domain":
        return `Please sign in with your official ${ALLOWED_DOMAIN} email.`;
      case "not_authorized":
        return "You don’t have permission to access the management dashboard.";
      default:
        return "We couldn’t complete sign‑in right now.";
    }
  }, [errorReason]);

  const empathy = useMemo(() => {
    switch (errorReason) {
      case "invalid_domain":
        return "It’s not you — it’s us. Sorry for the mix‑up.";
      case "not_authorized":
        return "It’s not your problem — it’s ours. Sorry for the inconvenience.";
      default:
        return "It’s on us, not you. Sorry for the error — we’re fixing it.";
    }
  }, [errorReason]);

  const helper = useMemo(() => {
    switch (errorReason) {
      case "invalid_domain":
        return "Use your Christ University email to continue.";
      case "not_authorized":
        return "If this seems wrong, please contact the platform administrator.";
      default:
        return "You can try again now, or take a quick break below.";
    }
  }, [errorReason]);

  const showTryAgain = errorReason !== "not_authorized";

  const handleLoginAgain = async () => {
    await signInWithGoogle();
  };

  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-b from-[#F7FAFF] to-white">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 border border-gray-200 shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-xl bg-[#FEE2E2] ring-1 ring-red-200">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-7 w-7 text-[#DC2626]"
            aria-hidden="true"
          >
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 0 0 0-2 1 1 0 0 0 0 2Z"
              clipRule="evenodd"
            />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-[#0F2E7A] mb-1">{heading}</h1>
        <p className="text-gray-800">{primary}</p>
        <p className="text-gray-600 text-sm">{empathy}</p>
        <p className="text-gray-500 text-sm mb-6">{helper}</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {showTryAgain && (
            <button
              onClick={handleLoginAgain}
              disabled={isLoading}
              className="flex-1 cursor-pointer font-semibold px-6 py-3 border-2 border-[#154CB3] text-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-colors rounded-full disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Try Again"}
            </button>
          )}
          <a href="/Discover" className="flex-1">
            <button className="w-full cursor-pointer font-semibold px-6 py-3 border-2 border-transparent hover:bg-[#f3f3f3] transition-colors rounded-full text-[#154CB3]">
              Go to Homepage
            </button>
          </a>
        </div>

        <div className="space-y-3">
          <h2 className="text-base font-semibold text-[#0F2E7A]">Quick break</h2>
          <PingPongMini />
        </div>

        <p className="mt-6 text-xs text-gray-500 text-center">
          We’re already on it and logging details to prevent repeats. Thanks for your patience.
        </p>
      </div>
    </div>
  );
}
// Loading fallback for Suspense
function ErrorLoadingFallback() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-4 bg-gradient-to-b from-[#F7FAFF] to-white">
      <div className="w-full max-w-xl rounded-2xl bg-white p-8 border border-gray-200 shadow-lg">
        <div className="animate-pulse">
          <div className="mx-auto mb-5 h-14 w-14 rounded-xl bg-gray-200"></div>
          <div className="h-8 w-48 bg-gray-200 rounded mb-4"></div>
          <div className="h-4 w-full bg-gray-200 rounded mb-2"></div>
          <div className="h-4 w-3/4 bg-gray-200 rounded mb-6"></div>
          <div className="flex gap-3">
            <div className="flex-1 h-12 bg-gray-200 rounded-full"></div>
            <div className="flex-1 h-12 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function BeepPage() {
  return (
    <Suspense fallback={<ErrorLoadingFallback />}>
      <ErrorContent />
    </Suspense>
  );
}