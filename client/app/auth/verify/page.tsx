"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function VerifyPage() {
  const router = useRouter();

  useEffect(() => {
    // Check if there's a returnTo URL in sessionStorage
    if (typeof window !== "undefined") {
      const returnTo = sessionStorage.getItem("returnTo");
      
      // Clear the returnTo from sessionStorage
      sessionStorage.removeItem("returnTo");
      
      // Redirect to the stored URL or to Discover if not found
      const redirectUrl = returnTo || "/Discover";
      router.push(redirectUrl);
    }
  }, [router]);

  // Show a loading state while redirecting
  return (
    <div className="flex flex-col justify-center items-center min-h-screen text-center px-4">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#154CB3] mb-4"></div>
      <p className="text-gray-700 text-lg">Finalizing your login...</p>
    </div>
  );
}
