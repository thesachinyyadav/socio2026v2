import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

// Register GSAP plugins
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

// Initialize character animations with a reveal effect
export function initCharacterAnimations(container: HTMLElement) {
  console.log("Initializing character animations");
  
  // Get all character elements
  const chars = Array.from(container.querySelectorAll('.char'));
  
  // Initialize positions
  gsap.set(chars, { 
    y: 0,
    opacity: 0,
    rotateX: -90,
    transformOrigin: "50% 50% -20px"
  });

  // Create a timeline for the initial animation
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: container,
      start: "top 80%",
      end: "bottom 20%",
      toggleActions: "play none none reverse",
    }
  });

  // Animate each character with a stagger
  tl.to(chars, {
    duration: 0.8,
    opacity: 1,
    y: 0,
    rotateX: 0,
    stagger: 0.03,
    ease: "back.out(1.7)",
    onComplete: () => {
      console.log("Initial character animation complete");
    }
  });
  
  return tl;
}

// Create a cycling animation for word groups
export function setupWordCycleAnimations(container: HTMLElement) {
  console.log("Setting up word cycle animations");
  
  try {
    // Find all word groups
    const wordGroups = container.querySelectorAll('.word-group');
    console.log(`Found ${wordGroups.length} word groups`);
    
    if (wordGroups.length === 0) return;
    
    // Setup timeline for each word
    wordGroups.forEach((wordGroup, index) => {
      createWordAnimation(wordGroup as HTMLElement, index);
    });
    
    console.log("Word cycle animations setup complete");
  } catch (error) {
    console.error("Error setting up word cycle animations:", error);
  }
}

// Create animation for a single word
export function createWordAnimation(wordGroup: HTMLElement, index: number) {
  // Get word content for debugging
  const wordContent = wordGroup.textContent?.trim();
  console.log(`Creating animation for word: ${wordContent} (index: ${index})`);
  
  // Find all characters in this word
  const wordChars = wordGroup.querySelectorAll('.char:not([data-separator="true"])');
  
  if (wordChars.length === 0) {
    console.warn(`No characters found in word group ${index}`);
    return null;
  }
  
  // Create timeline for this word with specific delay based on index
  const wordTl = gsap.timeline({
    repeat: -1,
    repeatDelay: 6,
    delay: index * 3,
  });
  
  // Animate the word with a shine effect
  wordTl
    .to(wordChars, {
      y: -10,
      color: '#FFCC00',
      textShadow: '0 0 8px rgba(255, 204, 0, 0.6)',
      scale: 1.1,
      stagger: 0.05,
      duration: 0.4,
      ease: 'power2.out',
      onStart: () => console.log(`Starting animation for "${wordContent}"`),
    })
    .to(wordChars, {
      y: 0,
      color: '',
      textShadow: 'none',
      scale: 1,
      stagger: 0.05,
      duration: 0.4,
      ease: 'power2.in',
      delay: 1,
    });
  
  return wordTl;
}

// Add a light sweep effect across the text
export function setupLightSweepEffect(container: HTMLElement) {
  const lightSweepTl = gsap.timeline({
    repeat: -1,
    repeatDelay: 3,
  });
  
  lightSweepTl
    .fromTo('.light-element', {
      left: '-50%',
      opacity: 0,
    }, {
      left: '150%',
      opacity: 1,
      duration: 1,
      ease: 'power1.inOut',
      onStart: () => console.log("Light sweep animation started"),
    });
  
  return lightSweepTl;
}

// Text scrambling effect for dynamic text changes
export function scrambleText(element: HTMLElement, newText: string, duration = 1) {
  const originalText = element.textContent || '';
  const length = Math.max(originalText.length, newText.length);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()';
  
  let timeline = gsap.timeline();
  
  const scrambleEffect = {
    value: originalText
  };
  
  timeline.to(scrambleEffect, {
    duration: duration,
    value: newText,
    onUpdate: function() {
      let currentText = '';
      const progress = this.progress();
      
      for (let i = 0; i < length; i++) {
        if (i < scrambleEffect.value.length) {
          // Keep characters that are final
          if (progress > i / length) {
            currentText += newText.charAt(i);
          } else {
            // Scramble in-progress characters
            currentText += chars.charAt(Math.floor(Math.random() * chars.length));
          }
        }
      }
      element.textContent = currentText;
    }
  });
  
  return timeline;
}

// Clean up all animations
export function cleanupAnimations() {
  // Kill all animations targeted at char elements
  gsap.killTweensOf(".char");
}
