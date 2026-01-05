"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

type TermsConsentContextType = {
  hasConsented: boolean;
  setHasConsented: (consented: boolean) => void;
  showConsentPrompt: boolean;
  setShowConsentPrompt: (show: boolean) => void;
  checkConsentStatus: () => boolean;
};

const TermsConsentContext = createContext<TermsConsentContextType | undefined>(undefined);

export function TermsConsentProvider({ children }: { children: React.ReactNode }) {
  const [hasConsented, setHasConsented] = useState<boolean>(false);
  const [showConsentPrompt, setShowConsentPrompt] = useState<boolean>(false);
  const [initialized, setInitialized] = useState(false);
  
  // Check if user has consented before
  useEffect(() => {
    const checkLocalStorage = () => {
      if (typeof window !== "undefined") {
        const storedConsent = localStorage.getItem("socio-terms-consent");
        if (storedConsent === "true") {
          setHasConsented(true);
        }
        setInitialized(true);
      }
    };
    
    checkLocalStorage();
  }, []);
  
  // Store consent in localStorage when it changes
  useEffect(() => {
    if (initialized && hasConsented) {
      localStorage.setItem("socio-terms-consent", "true");
    }
  }, [hasConsented, initialized]);
  
  const checkConsentStatus = (): boolean => {
    // If on client-side, check localStorage
    if (typeof window !== "undefined") {
      return localStorage.getItem("socio-terms-consent") === "true";
    }
    // Default to the state value if on server-side
    return hasConsented;
  };

  return (
    <TermsConsentContext.Provider
      value={{
        hasConsented,
        setHasConsented,
        showConsentPrompt,
        setShowConsentPrompt,
        checkConsentStatus,
      }}
    >
      {children}
    </TermsConsentContext.Provider>
  );
}

export const useTermsConsent = () => {
  const context = useContext(TermsConsentContext);
  if (context === undefined) {
    throw new Error("useTermsConsent must be used within a TermsConsentProvider");
  }
  return context;
};