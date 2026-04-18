"use client";

import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";

interface CarouselImage {
  id: number;
  src: string;
  link: string;
  title: string;
  department: string;
}

interface FullWidthCarouselProps {
  images: CarouselImage[];
  autoplaySpeed?: number;
}

export const FullWidthCarousel: React.FC<FullWidthCarouselProps> = ({
  images,
  autoplaySpeed = 5000,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const carouselRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isHovered || images.length <= 1 || isTransitioning) return;

    intervalRef.current = setInterval(() => {
      setIsTransitioning(true);
      setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
    }, autoplaySpeed);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isHovered, images.length, autoplaySpeed, isTransitioning]);

  useEffect(() => {
    const handleTransitionEnd = () => {
      setIsTransitioning(false);
    };

    const carousel = carouselRef.current;
    if (carousel) {
      carousel.addEventListener("transitionend", handleTransitionEnd);
    }

    return () => {
      if (carousel) {
        carousel.removeEventListener("transitionend", handleTransitionEnd);
      }
    };
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (carouselRef.current) {
        carouselRef.current.style.transition = "none";
        setTimeout(() => {
          carouselRef.current!.style.transition = "transform 0.5s ease-in-out";
        }, 0);
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const nextSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prevIndex) => (prevIndex + 1) % images.length);
  };

  const prevSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prevIndex) =>
      prevIndex === 0 ? images.length - 1 : prevIndex - 1
    );
  };

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const deltaX = touchEndX - touchStartX.current;

    if (deltaX > 50) {
      prevSlide();
    } else if (deltaX < -50) {
      nextSlide();
    }

    touchStartX.current = null;
  };

  if (!images || images.length === 0) {
    return (
      <div className="text-center py-8 md:py-12 text-gray-500">
        No images available
      </div>
    );
  }

  return (
    <div
      className="relative w-full overflow-hidden mb-8 md:mb-12 rounded-xl -md"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <Link href={images[currentIndex].link}>
        <div
          ref={carouselRef}
          className="flex transition-transform duration-500 ease-in-out will-change-transform"
          style={{
            transform: `translateX(-${currentIndex * 100}%)`,
          }}
        >
          {images.map((image) => (
            <div
              key={image.id}
              className="relative flex-shrink-0 w-full h-52 md:h-96"
            >
              <img
                src={image.src}
                alt={image.title}
                className="w-full h-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4 md:p-6 text-white w-full">
                <div className="flex flex-col">
                  <h1 className="text-xl md:text-[2.1rem] font-bold text-white m-0">
                    {image.title}
                  </h1>
                  <p className="text-sm md:text-lg font-medium text-white/80">
                    {image.department}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Link>

      {images.length > 1 && (
        <>
          <button
            onClick={prevSlide}
            className="absolute top-1/2 cursor-pointer left-2 md:left-4 -translate-y-1/2 bg-white/30 backdrop-blur-sm hover:bg-white/50 text-white p-2 md:p-3 rounded-full transition-colors duration-200"
            aria-label="Previous slide"
            disabled={isTransitioning}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 md:h-6 md:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <button
            onClick={nextSlide}
            className="absolute top-1/2 right-2 md:right-4 cursor-pointer -translate-y-1/2 bg-white/30 backdrop-blur-sm hover:bg-white/50 text-white p-2 md:p-3 rounded-full transition-colors duration-200"
            aria-label="Next slide"
            disabled={isTransitioning}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 md:h-6 md:w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </button>

          <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex space-x-2 md:space-x-3">
            {images.map((image, index) => (
              <button
                key={`carousel-dot-${image.id}-${index}`}
                onClick={() => goToSlide(index)}
                className={`w-2 h-2 md:w-3 md:h-3 rounded-full transition-colors ${
                  index === currentIndex ? "bg-white" : "bg-white/50"
                } ${isTransitioning ? "cursor-not-allowed" : "cursor-pointer"}`}
                aria-label={`Go to slide ${index + 1}`}
                disabled={isTransitioning}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
};
