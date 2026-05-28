"use client";

import { useEffect } from "react";
import { Suspense, lazy } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

const CampusDirectorAnalyticsDashboard = lazy(
  () => import("@/app/_components/CampusDirector/CampusDirectorAnalyticsDashboard")
);

export default function CampusDirectorPage() {
  const { session, userData, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!session) {
      router.replace("/auth");
      return;
    }
    if (userData && !(userData as any).is_campus_director && !(userData as any).is_masteradmin) {
      router.replace("/error");
    }
  }, [isLoading, session, userData, router]);

  if (isLoading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#faf8ff] text-slate-500">
        Loading…
      </div>
    );
  }

  if (userData && !(userData as any).is_campus_director && !(userData as any).is_masteradmin) {
    return null;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#faf8ff] text-slate-500">
          Loading analytics…
        </div>
      }
    >
      <CampusDirectorAnalyticsDashboard />
    </Suspense>
  );
}
