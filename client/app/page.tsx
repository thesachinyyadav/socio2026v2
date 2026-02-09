"use client";

import { useEffect } from "react";
import Hero from "./_components/Home/Hero";
import Features from "./_components/Home/Features";
import UpcomingEvents from "./_components/Home/UpcomingEvents";
import CTA from "./_components/Home/CTA";
import FAQPage from "./_components/Home/FAQs";
import Footer from "./_components/Home/Footer";
import AnimatedText from "./_components/Home/AnimatedText";
import gsap from "gsap";
import ScrollTrigger from "gsap/ScrollTrigger";

export default function Home() {
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);

    gsap.utils.toArray<HTMLElement>(".section").forEach((section) => {
      gsap.from(section, {
        opacity: 0,
        y: 50,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 80%",
          end: "bottom 20%",
          toggleActions: "play none none reverse",
        },
      });
    });
  }, []);

  return (
    <main className="w-full">
      <div className="section relative z-10">
        <Hero />
        <div className="absolute bottom-0 left-0 w-full z-0 pointer-events-none">
          <img src="/images/hero-wave.svg" className="w-full" alt="" />
        </div>
        <div className="relative z-20">
          <AnimatedText />
        </div>
      </div>
      <div className="section relative z-10">
        <Features />
      </div>
      <div className="section relative z-10">
        <UpcomingEvents />
      </div>
      <div className="section relative z-10">
        <CTA />
      </div>
      <div className="section relative z-10">
        <FAQPage />
      </div>
      <div className="section relative z-10">
        <Footer />
      </div>
    </main>
  );
}
