"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";

export default function Page() {
  const { session, isLoading, signInWithGoogle } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (session) {
      router.replace("/Discover");
    } else {
      signInWithGoogle();
    }
  }, [session, isLoading, signInWithGoogle, router]);

  return null;
}
