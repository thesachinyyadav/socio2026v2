"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";

interface TermsConsentModalProps {
  onAccept: () => void;
  onDecline: () => void;
}

export default function TermsConsentModal({ onAccept, onDecline }: TermsConsentModalProps) {
  const [hasConsented, setHasConsented] = useState(false);
  
  // Function to handle checkbox change
  const handleConsentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setHasConsented(e.target.checked);
  };

  return (
    <>
      {/* Modal Backdrop */}
      <div 
        className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center p-4"
        onClick={onDecline} // Close modal on backdrop click
      >
        {/* Modal Content */}
        <div 
          className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden relative animate-scale-up"
          onClick={(e) => e.stopPropagation()} // Prevent closing when clicking modal content
        >
          {/* Header */}
          <div className="bg-[#063168] p-4 sm:p-6">
            <h2 className="text-xl sm:text-2xl font-bold text-white">Terms of Service</h2>
            <p className="text-blue-100 text-sm mt-1">
              Please review and accept before continuing
            </p>
          </div>
          
          {/* Content */}
          <div className="p-4 sm:p-6">
            <div className="mb-6 prose prose-sm max-w-none overflow-y-auto max-h-60 border border-gray-200 rounded-md p-4 bg-gray-50">
              <p className="font-medium">
                By using Socio, you agree to be bound by our Terms of Service, Privacy Policy, and Cookie Policy.
              </p>
              
              <p className="text-sm text-gray-700">
                Socio is a platform for university students to discover and engage with campus events. 
                You are responsible for any content you post, and we are not responsible for incidents 
                that may occur due to connections made through our platform.
              </p>
              
              <p className="text-sm text-gray-700">
                We collect certain personal information including your name, email address, and 
                registration number to provide our services. Please review our full policies for details.
              </p>
              
              <div className="mt-4 flex flex-col space-y-1 text-xs text-gray-500">
                <p>Key points to note:</p>
                <ul className="list-disc ml-5">
                  <li>You must have a valid university email to use Socio</li>
                  <li>You're responsible for maintaining the confidentiality of your account</li>
                  <li>Don't share harmful, offensive, or misleading content</li>
                  <li>Exercise caution when interacting with others on the platform</li>
                  <li>We may use cookies to improve your experience</li>
                </ul>
              </div>
            </div>
            
            {/* Consent Checkbox */}
            <div className="mb-6 flex items-start">
              <input
                type="checkbox"
                id="consent"
                className="mt-1 h-4 w-4 text-[#063168] focus:ring-[#3D75BD] border-gray-300 rounded"
                onChange={handleConsentChange}
                checked={hasConsented}
              />
              <label htmlFor="consent" className="ml-2 block text-sm text-gray-700">
                I have read and agree to Socio's{" "}
                <Link href="/terms" className="text-[#063168] hover:underline font-semibold" target="_blank">
                  Terms of Service
                </Link>
                ,{" "}
                <Link href="/privacy" className="text-[#063168] hover:underline font-semibold" target="_blank">
                  Privacy Policy
                </Link>
                , and{" "}
                <Link href="/cookies" className="text-[#063168] hover:underline font-semibold" target="_blank">
                  Cookie Policy
                </Link>
                .
              </label>
            </div>
            
            {/* Action Buttons */}
            <div className="flex justify-between">
              <button
                onClick={onDecline}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 text-sm font-medium rounded-md hover:bg-gray-100"
              >
                Decline
              </button>
              <button
                onClick={onAccept}
                disabled={!hasConsented}
                className={`px-6 py-2 bg-[#063168] text-white text-sm font-medium rounded-md shadow-sm ${
                  hasConsented 
                    ? "hover:bg-[#154CB3] transition-colors duration-200" 
                    : "opacity-50 cursor-not-allowed"
                }`}
              >
                Accept & Continue
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}