"use client";

import React, { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import gsap from "gsap";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { TypeAnimation } from "react-type-animation";
import FunkyButton from "./FunkyButton";

const Hero = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const { session, isLoading } = useAuth();
  const router = useRouter();
  const [startTyping, setStartTyping] = useState(false);
  

  const handleSignInWithGoogle = async () => {
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

  const handleExploreClick = () => {
    if (!session && !isLoading) {
      handleSignInWithGoogle();
    } else if (session && !isLoading) {
      router.push("/Discover");
    }
  };

  useEffect(() => {
    const text = heroRef.current?.querySelectorAll("h1, p");
    const buttons = heroRef.current?.querySelectorAll("button");
    const imageDiv = heroRef.current?.querySelector(".image-container");

    if (text && text.length > 0) {
      gsap.from(text, {
        opacity: 0,
        x: -50,
        duration: 1,
        stagger: 0.2,
        ease: "power3.out",
        onComplete: () => {
          setStartTyping(true);
        },
      });
    }

    if (buttons && buttons.length > 0) {
      buttons.forEach((button) => {
        button.addEventListener("mouseenter", () => {
          gsap.to(button, { scale: 1.05, duration: 0.3, ease: "power2.out" });
        });
        button.addEventListener("mouseleave", () => {
          gsap.to(button, { scale: 1, duration: 0.3, ease: "power2.out" });
        });
      });
    }

    if (imageDiv) {
      gsap.from(imageDiv, {
        opacity: 0,
        scale: 0.8,
        duration: 1,
        delay: 0.5,
        ease: "elastic.out(1, 0.5)",
      });
    }
  }, []);

  const buttonsDisabled = isLoading;

  return (
      <div
        ref={heroRef}
        className="flex flex-col sm:flex-row justify-between items-center w-full px-4 sm:px-8 md:px-16 lg:px-36 py-12 sm:py-16 md:py-24"
      >
      <div className="w-full sm:w-1/2 mb-8 sm:mb-0">
        <div>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-tight" style={{ 
              backgroundImage: 'linear-gradient(45deg, #063168, #3D75BD)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundSize: '200% 200%',
              animation: 'gradient-shift 5s ease infinite'
            }}>
            Discover Christ University events and&nbsp;
            {startTyping ? (
              <TypeAnimation
                sequence={[
                  "connect.",
                  2000,
                  "",
                  500,
                  "participate.",
                  2000,
                  "",
                  500,
                  "excel.",
                  2000,
                  "",
                  500,
                ]}
                wrapper="span"
                speed={50}
                repeat={Infinity}
                style={{
                  display: "inline-block",
                  minWidth: "150px",
                  color: "#063168",
                }}
              />
            ) : (
              <span
                style={{ display: "inline-block", minWidth: "150px" }}
              ></span>
            )}
          </h1>
          <p className="mt-4 text-[#1e1e1eb6] text-base sm:text-lg font-medium">
            Your one-stop platform for Discovering, registering, and managing all Christ University events, festivals, and activities across all campuses.
          </p>
        </div>
        <div className="flex mt-6 sm:mt-8 gap-4 sm:gap-5 items-center select-none flex-row">
          <FunkyButton 
            text="Get Started" 
            onClick={() => {
              if (session && !isLoading) {
                router.push("/Discover");
              } else {
                router.push("/auth");
              }
            }}
          />
          <button
            onClick={handleExploreClick}
            disabled={buttonsDisabled}
            className="cursor-pointer font-semibold px-6 py-2.5 sm:px-6 sm:py-3 border-2 border-[#3D75BD] text-sm sm:text-base rounded-md text-[#063168] bg-white hover:bg-[#3D75BD]/10 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out hover:shadow-md"
          >
            Explore
          </button>
        </div>
      </div>
      <div className="w-full sm:w-1/2 flex justify-center sm:justify-end relative">
        <div className="absolute w-full h-full flex items-center justify-center">
          <div className="w-64 h-64 sm:w-80 sm:h-80 rounded-full bg-blue-100 opacity-20 animate-pulse"></div>
        </div>
        <div className="absolute w-full h-full flex items-center justify-center">
          <div className="w-72 h-72 sm:w-88 sm:h-88 rounded-full bg-yellow-100 opacity-20 animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        <div className="image-container w-48 h-48 sm:w-60 sm:h-60 md:w-72 md:h-72 rounded-full overflow-hidden shadow-xl relative z-10" 
             style={{ 
               boxShadow: '0 10px 25px -5px rgba(21, 76, 179, 0.4), 0 8px 10px -6px rgba(21, 76, 179, 0.3)',
               border: '5px solid rgba(255, 255, 255, 0.7)'
             }}>
          <img 
            src="https://bangalorestudy.com/static/media/Central.85c63a34.jpg"
            alt="Christ University Campus"
            className="w-full h-full object-cover transform transition-transform duration-10000 hover:scale-110"
          />
        </div>
        {/* Decorative elements */}
        <div className="absolute top-1/4 right-1/4 w-12 h-12 rounded-full bg-yellow-300 opacity-20 animate-bounce" style={{ animationDuration: '3s' }}></div>
        <div className="absolute bottom-1/4 left-1/4 w-8 h-8 rounded-full bg-blue-300 opacity-20 animate-bounce" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }}></div>
      </div>
    </div>
  );
};

export default Hero;
