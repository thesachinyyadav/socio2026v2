"use client";

import React, { useEffect, useRef } from "react";
import { createBrowserClient } from "@supabase/ssr";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";
import { useAuth } from "../../../context/AuthContext";

const CTA = () => {
  const ctaRef = useRef<HTMLDivElement>(null);
  const { session, isLoading } = useAuth();
  

  const signInWithGoogle = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
    } catch (error) {
      console.error("Google authentication error:", error);
    }
  };
  

  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    const ctx = gsap.context(() => {
      // Only fade in the text — buttons stay always visible so they can never
      // get stuck hidden if the ScrollTrigger reveal doesn't fire.
      const elements = ctaRef.current?.querySelectorAll(
        "h1, p"
      ) as NodeListOf<HTMLElement>;
      if (elements?.length) {
        gsap.from(elements, {
          opacity: 0,
          y: 30,
          duration: 0.8,
          stagger: 0.2,
          ease: "power3.out",
          scrollTrigger: {
            trigger: ctaRef.current,
            start: "top 85%",
          },
        });
      }
    }, ctaRef);

    // Recompute trigger positions now that this lazy-loaded section is in the DOM,
    // otherwise the stale start position prevents the reveal from ever firing.
    ScrollTrigger.refresh();

    const buttons = ctaRef.current?.querySelectorAll(
      "button"
    ) as NodeListOf<HTMLButtonElement>;
    buttons?.forEach((button: HTMLButtonElement) => {
      button.addEventListener("mouseenter", () => {
        gsap.to(button, { scale: 1.05, duration: 0.3, ease: "power2.out" });
      });
      button.addEventListener("mouseleave", () => {
        gsap.to(button, { scale: 1, duration: 0.3, ease: "power2.out" });
      });
    });

    return () => {
      ctx.revert();
    };
  }, []);

  return (
      <div
        ref={ctaRef}
        className="py-12 sm:py-16 md:py-24 w-full flex flex-col items-center justify-center mt-8 sm:mt-12 md:mt-16 mb-8 bg-gradient-to-b from-[#063168] to-[#3D75BD]"
      >
      <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-[#fff] text-center leading-tight px-4">
        Find what's happening. <br className="hidden md:flex" /> Claim your spot
        and experience more.
      </h1>
      <p className="mt-4 sm:mt-6 text-[#ffffff97] text-base sm:text-lg text-center px-4">
        Join thousands of students who are already Discovering, attending, and{" "}
        <br className="hidden md:flex" />
        sharing campus events through SOCIO.
      </p>
      <div className="mt-6 sm:mt-8 flex flex-row sm:flex-row gap-4 px-4">
        {!session && !isLoading && (
          <button
            onClick={signInWithGoogle}
            className="cursor-pointer font-semibold px-4 py-1.5 sm:px-4 sm:py-2 border-2 border-[#fff] hover:bg-[#ffffff1a] transition-all ease-in-out text-xs sm:text-sm rounded-full text-white whitespace-nowrap"
          >
            Get started
          </button>
        )}
        <a href="/app-download">
          <button className="cursor-pointer font-semibold px-4 py-1.5 sm:px-4 sm:py-2 border-2 border-[#FFCC00] hover:bg-[#ffcc00f0] transition-all ease-in-out text-xs sm:text-sm rounded-full text-[#1e1e1e] bg-[#ffcc00] whitespace-nowrap">
            Download the app
          </button>
        </a>
      </div>
    </div>
  );
};

export default CTA;
