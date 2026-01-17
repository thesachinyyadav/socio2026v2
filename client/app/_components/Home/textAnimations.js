/**
 * Text animation utilities
 */

export const scrambleText = (finalText, callback, duration = 1500) => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()";
  const finalChars = finalText.split('');
  let output = '';
  let iteration = 0;
  
  // Set initial random string
  for (let i = 0; i < finalText.length; i++) {
    if (finalChars[i] === ' ') {
      output += ' ';
    } else {
      output += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  // Update callback with initial string
  callback(output);
  
  // Calculate iterations based on duration
  const totalIterations = Math.ceil(duration / 50);
  const iterationsPerChar = Math.ceil(totalIterations / finalText.length);
  
  // Begin scrambling
  const interval = setInterval(() => {
    output = '';
    let isComplete = true;
    
    for (let i = 0; i < finalText.length; i++) {
      // If it's a space, keep it as is
      if (finalChars[i] === ' ') {
        output += ' ';
        continue;
      }
      
      // Calculate if this character should be set to final value
      const charIterationThreshold = i * iterationsPerChar;
      
      if (iteration >= charIterationThreshold) {
        output += finalChars[i];
      } else {
        isComplete = false;
        output += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    }
    
    callback(output);
    iteration++;
    
    // Check if animation is complete
    if (isComplete) {
      clearInterval(interval);
    }
  }, 50);
  
  return () => clearInterval(interval);
};

export const createGlitchEffect = (element) => {
  let isAnimating = false;
  const glitchDuration = 500;
  const originalText = element.textContent;
  
  const glitch = () => {
    if (isAnimating) return;
    isAnimating = true;
    
    const originalChars = originalText.split('');
    const iterations = 10;
    let currentIteration = 0;
    
    const glitchInterval = setInterval(() => {
      // Generate glitched text
      const glitchedChars = originalChars.map(char => {
        if (char === ' ') return ' ';
        return Math.random() > 0.7 ? 
          String.fromCharCode(char.charCodeAt(0) + Math.floor(Math.random() * 10) - 5) : 
          char;
      });
      
      element.textContent = glitchedChars.join('');
      currentIteration++;
      
      if (currentIteration >= iterations) {
        clearInterval(glitchInterval);
        element.textContent = originalText;
        isAnimating = false;
      }
    }, glitchDuration / iterations);
  };
  
  return glitch;
};

export const createWaveEffect = (elements) => {
  if (!elements || elements.length === 0) return;
  
  const tl = {
    play: () => {
      elements.forEach((el, i) => {
        setTimeout(() => {
          el.style.transform = 'translateY(-15px)';
          setTimeout(() => {
            el.style.transform = 'translateY(0)';
          }, 200);
        }, i * 100);
      });
    }
  };
  
  return tl;
};

export default {
  scrambleText,
  createGlitchEffect,
  createWaveEffect
};