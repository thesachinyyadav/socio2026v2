"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import gsap from "gsap";
import "./FunkyButton.css";

interface FunkyButtonProps {
  text?: string;
  link?: string;
  onClick?: () => void;
  className?: string;
}

const FunkyButton: React.FC<FunkyButtonProps> = ({
  text = "Get Started",
  link = "/discover",
  onClick,
  className = "",
}) => {
  const buttonRef = useRef<HTMLAnchorElement>(null);
  const buttonContentRef = useRef<HTMLDivElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // State for magnetic effect
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);
  const [isClicked, setIsClicked] = useState(false);

  // Handle mouse position for magnetic effect
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!buttonRef.current) return;
    
    const button = buttonRef.current;
    const rect = button.getBoundingClientRect();
    
    // Calculate center of button
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    
    // Calculate distance from mouse to center
    const distanceX = e.clientX - centerX;
    const distanceY = e.clientY - centerY;
    
    // Calculate movement (closer to edge = more movement)
    const maxDistance = Math.min(rect.width, rect.height) * 0.4;
    const magnetStrength = 0.3;
    
    const moveX = (distanceX / maxDistance) * 15 * magnetStrength;
    const moveY = (distanceY / maxDistance) * 10 * magnetStrength;
    
    // Update position state
    setPosition({ x: moveX, y: moveY });
  };

  // Create particles on click
  const createParticles = () => {
    if (!particlesRef.current) return;
    
    const particles = particlesRef.current;
    particles.innerHTML = '';
    
    // Create random particles
    for (let i = 0; i < 20; i++) {
      const particle = document.createElement("div");
      particle.classList.add("funky-particle");
      
      // Random position, size and color
      const size = Math.random() * 6 + 3; // Smaller particles
      const color = Math.random() > 0.5 ? "#063168" : "#3D75BD";
      
      Object.assign(particle.style, {
        width: `${size}px`,
        height: `${size}px`,
        backgroundColor: color,
        left: "50%",
        top: "50%",
        opacity: 0.7,
      });
      
      particles.appendChild(particle);
      
      // Animate particles outward
      gsap.to(particle, {
        x: (Math.random() - 0.5) * 100,
        y: (Math.random() - 0.5) * 100,
        opacity: 0,
        duration: Math.random() * 1 + 0.5,
        onComplete: () => {
          particle.remove();
        }
      });
    }
  };

  // Handle button click
  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onClick) {
      e.preventDefault();
      setIsClicked(true);
      createParticles();
      
      // Reset button position with a bouncy animation
      gsap.to(buttonContentRef.current, {
        x: 0,
        y: 0,
        scale: 0.95,
        duration: 0.1,
        onComplete: () => {
          gsap.to(buttonContentRef.current, {
            scale: 1,
            duration: 0.3,
            ease: "elastic.out(1.2, 0.4)",
            onComplete: () => {
              onClick();
            }
          });
        }
      });
    } else if (link) {
      e.preventDefault();
      setIsClicked(true);
      createParticles();
      
      // Animate button before navigation
      gsap.to(buttonContentRef.current, {
        scale: 0.95,
        duration: 0.1,
        onComplete: () => {
          gsap.to(buttonContentRef.current, {
            scale: 1,
            duration: 0.3,
            ease: "elastic.out(1.2, 0.4)",
            onComplete: () => {
              router.push(link);
            }
          });
        }
      });
    }
  };

  // Setup and cleanup effects
  useEffect(() => {
    if (!buttonContentRef.current) return;
    
    // Set up floating animation
    const floatAnimation = gsap.to(buttonContentRef.current, {
      y: "-3px",
      duration: 1.5,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
    
    // Initial glow pulse animation
    const glowAnimation = gsap.to(".funky-button-glow", {
      opacity: 0.6,
      scale: 1.05,
      duration: 1.2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut"
    });
    
    return () => {
      floatAnimation.kill();
      glowAnimation.kill();
    };
  }, []);

  // Update button position based on mouse movement
  useEffect(() => {
    if (!buttonContentRef.current || !isHovered) return;
    
    gsap.to(buttonContentRef.current, {
      x: position.x,
      y: position.y,
      duration: 0.3,
      ease: "power2.out"
    });
    
    return () => {
      if (buttonContentRef.current) {
        gsap.to(buttonContentRef.current, {
          x: 0,
          y: 0,
          duration: 0.5,
          ease: "elastic.out(1, 0.3)"
        });
      }
    };
  }, [position, isHovered]);

  return (
    <a
      ref={buttonRef}
      href={link}
      onClick={handleClick}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`funky-button-wrapper ${className} ${isHovered ? 'hovered' : ''}`}
    >
      <div className="funky-button-glow"></div>
      <div
        ref={buttonContentRef}
        className={`funky-button-content ${isClicked ? 'clicked' : ''}`}
      >
        {text}
        <svg className="funky-button-icon" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5 12h14"></path>
          <path d="m12 5 7 7-7 7"></path>
        </svg>
      </div>
      <div ref={particlesRef} className="funky-button-particles"></div>
    </a>
  );
};

export default FunkyButton;