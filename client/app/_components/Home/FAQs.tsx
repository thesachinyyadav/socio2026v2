"use client";

import { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface FAQ {
  question: string;
  answer: string;
}

export default function FAQSection() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    "Is Socio free to use?": true,
  });
  const faqRef = useRef<HTMLDivElement>(null);

  const toggleItem = (question: string) => {
    setOpenItems((prev) => ({
      ...prev,
      [question]: !prev[question],
    }));
  };

  const faqItems: FAQ[] = [
    {
      question: "Is Socio free to use?",
      answer:
        "Yes, absolutely. Socio is completely free for students. You can browse events, register, and stay updated, all without paying a rupee.",
    },
    {
      question:
        "Is Socio available for all colleges or just specific universities?",
      answer:
        "We’re starting off with Christ University, Central Campus. Very soon, we plan to expand to other Christ branches and eventually roll it out to other colleges across Bangalore. We want to make sure no student misses out, no matter which campus they’re from.",
    },
    {
      question: "What kind of events are usually listed on Socio?",
      answer:
        "All kinds! From casual open mics to major management fests, Socio covers it all. You’ll find vocational workshops, sports tournaments, speaker sessions, debates, cultural events, light-hearted activities, and more. Whether it’s your department’s internal contest, an inter-departmental battle, or a full-on intercollegiate fest, it’ll be listed here.",
    },
    {
      question: "Can anyone post an event, or do you verify the organizers?",
      answer:
        "To maintain authenticity, events can only be posted by the assigned teacher coordinator for that event. This helps us ensure everything listed on the platform is genuine and approved.",
    },
    {
      question: "How do I know when a new event has been posted?",
      answer:
        "Our app sends you push notifications whenever a new event goes live. So even if your WhatsApp groups are flooded, you won’t miss a thing.",
    },
  ];

  useEffect(() => {
    const items = faqRef.current?.querySelectorAll(
      ".faq-item"
    ) as NodeListOf<HTMLElement>;
    if (items) {
      items.forEach((item: HTMLElement) => {
        gsap.from(item, {
          opacity: 0,
          y: 20,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: item,
            start: "top 90%",
          },
        });

        const button = item.querySelector("button") as HTMLButtonElement;
        if (button) {
          const mouseEnterHandler = () =>
            gsap.to(button, { x: 5, duration: 0.3, ease: "power2.out" });
          const mouseLeaveHandler = () =>
            gsap.to(button, { x: 0, duration: 0.3, ease: "power2.out" });

          button.addEventListener("mouseenter", mouseEnterHandler);
          button.addEventListener("mouseleave", mouseLeaveHandler);

          return () => {
            button.removeEventListener("mouseenter", mouseEnterHandler);
            button.removeEventListener("mouseleave", mouseLeaveHandler);
          };
        }
      });
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => {
        if (
          items &&
          Array.from(items).some(
            (item) =>
              item === trigger.trigger || item.contains(trigger.trigger as Node)
          )
        ) {
          trigger.kill();
        }
      });
    };
  }, []);

  return (
    <div
      ref={faqRef}
      className="w-full py-8 sm:py-12 px-4 sm:px-6 md:px-16 bg-white mb-8"
    >
      <div className="max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-10">
          <div className="w-full">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6 text-gray-900">
              Frequently asked questions
            </h2>
            <p className="text-gray-500 text-base sm:text-lg leading-normal">
              Check out our FAQs for quick answers about event registrations,
              tickets, check-ins, and more. Contact us if you have any other
              queries.
            </p>
          </div>

          <div className="w-full">
            <div className="space-y-1">
              {faqItems.map((faq, index) => (
                <div
                  key={index} // Reverted key to index as in original
                  className={`faq-item ${
                    index !== faqItems.length - 1
                      ? "border-b border-gray-200"
                      : ""
                  }`}
                >
                  <button
                    onClick={() => toggleItem(faq.question)}
                    className="flex justify-between items-center w-full text-left py-4 sm:py-6 cursor-pointer"
                    aria-expanded={openItems[faq.question] || false}
                  >
                    <span className="font-medium text-base sm:text-lg text-gray-900">
                      {faq.question}
                    </span>
                    <span className="flex-shrink-0 ml-4 text-lg">
                      {openItems[faq.question] ? "-" : "+"}
                    </span>
                  </button>

                  {openItems[faq.question] && (
                    <div className="pb-4 sm:pb-6 pr-6 sm:pr-10 text-gray-500 text-sm sm:text-base leading-relaxed">
                      {faq.answer}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
