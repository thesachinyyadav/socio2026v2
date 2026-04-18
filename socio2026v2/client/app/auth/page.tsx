"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Page() {
  const { session, isLoading, signInWithGoogle } = useAuth();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);

  const triggerGoogleSignIn = useCallback(async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch {
      setAuthError("Could not start Google sign-in. Please try again.");
    }
  }, [signInWithGoogle]);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (session) {
      router.replace("/Discover");
    } else {
      void triggerGoogleSignIn();
    }
  }, [session, isLoading, triggerGoogleSignIn, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto h-12 w-12 rounded-full border-4 border-[#154CB3]/25 border-t-[#154CB3] animate-spin" />
          <p className="text-slate-600">Checking your session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm text-center space-y-4">
        <h1 className="text-xl font-bold text-[#0f2557]">Sign In</h1>
        <p className="text-sm text-slate-600">Continue with your Google account to access SOCIO.</p>
        {authError && <p className="text-sm text-red-600">{authError}</p>}
        <button
          type="button"
          onClick={() => void triggerGoogleSignIn()}
          className="w-full rounded-full bg-[#154CB3] text-white font-semibold py-2.5 hover:bg-[#124099] transition-colors"
        >
          Continue with Google
        </button>
      </div>
    </div>
  );
}
