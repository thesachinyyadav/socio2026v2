"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function CookiePolicy() {
  // Scroll to top on page load
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-[#063168] py-6 px-8">
            <h1 className="text-3xl font-bold text-white">Cookie Policy</h1>
            <p className="mt-2 text-blue-100">
              Last updated: September 22, 2025
            </p>
          </div>

          {/* Content */}
          <div className="px-8 py-6 prose prose-blue max-w-none">
            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">What Are Cookies</h2>
              </div>
              <p>
                Cookies are small pieces of text sent to your web browser by a website you visit. A cookie file is stored in 
                your web browser and allows the Service or a third party to recognize you and make your next visit easier and 
                the Service more useful to you.
              </p>
              <p>
                Cookies can be "persistent" or "session" cookies. Persistent cookies remain on your device when you go offline, 
                while session cookies are deleted as soon as you close your web browser.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">How Socio Uses Cookies</h2>
              </div>
              <p>
                When you use and access the Socio platform, we may place a number of cookie files in your web browser.
              </p>
              <p>
                We use cookies for the following purposes:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li><strong>Authentication:</strong> We use cookies to identify you when you visit our website and as you 
                navigate our website, and to help us determine if you are logged into our website.</li>
                <li><strong>Security:</strong> We use cookies as an element of the security measures to protect user accounts, 
                including preventing fraudulent use of login credentials and protecting our website and services generally.</li>
                <li><strong>Status:</strong> We use cookies to help us determine if you are logged into our website.</li>
                <li><strong>Personalization:</strong> We use cookies to store information about your preferences and to personalize 
                our website for you (such as remembering your preferred language or the region you are in).</li>
                <li><strong>Analysis:</strong> We use cookies to analyze the use and performance of our website and services.</li>
              </ul>
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Types of Cookies We Use</h2>
              </div>
              <p>
                The cookies we use on the Socio platform can be categorized as follows:
              </p>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h3 className="text-xl font-semibold text-[#063168] mb-2">Essential Cookies</h3>
                <p className="mb-2">
                  These cookies are necessary for the website to function properly. They enable core functionality such as 
                  security, network management, and account access. You may disable these by changing your browser settings, 
                  but this may affect how the website functions.
                </p>
                <p className="text-sm text-gray-600">
                  Examples: session cookies, authentication cookies
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h3 className="text-xl font-semibold text-[#063168] mb-2">Functionality Cookies</h3>
                <p className="mb-2">
                  These cookies allow the website to remember choices you make (such as your user name, language, or the region 
                  you are in) and provide enhanced, more personal features.
                </p>
                <p className="text-sm text-gray-600">
                  Examples: language preference cookies, theme preference cookies
                </p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <h3 className="text-xl font-semibold text-[#063168] mb-2">Performance and Analytics Cookies</h3>
                <p className="mb-2">
                  These cookies collect information about how visitors use a website, for instance which pages visitors go to most 
                  often, and if they get error messages from web pages. All information these cookies collect is aggregated and 
                  therefore anonymous.
                </p>
                <p className="text-sm text-gray-600">
                  Examples: Google Analytics cookies
                </p>
              </div>
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Managing Cookies</h2>
              </div>
              <p>
                Most browsers allow you to refuse to accept cookies and to delete cookies. The methods for doing so vary from 
                browser to browser, and from version to version.
              </p>
              <p>
                You can obtain up-to-date information about blocking and deleting cookies via these links:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>
                  <a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" 
                  className="text-[#063168] hover:text-[#3D75BD]">
                    Google Chrome
                  </a>
                </li>
                <li>
                  <a href="https://support.mozilla.org/en-US/kb/enhanced-tracking-protection-firefox-desktop" 
                  target="_blank" rel="noopener noreferrer" className="text-[#063168] hover:text-[#3D75BD]">
                    Mozilla Firefox
                  </a>
                </li>
                <li>
                  <a href="https://support.microsoft.com/en-us/microsoft-edge/delete-cookies-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" 
                  target="_blank" rel="noopener noreferrer" className="text-[#063168] hover:text-[#3D75BD]">
                    Microsoft Edge
                  </a>
                </li>
                <li>
                  <a href="https://support.apple.com/guide/safari/manage-cookies-and-website-data-sfri11471/mac" 
                  target="_blank" rel="noopener noreferrer" className="text-[#063168] hover:text-[#3D75BD]">
                    Safari (macOS)
                  </a>
                </li>
                <li>
                  <a href="https://support.apple.com/en-us/HT201265" target="_blank" rel="noopener noreferrer" 
                  className="text-[#063168] hover:text-[#3D75BD]">
                    Safari (iOS)
                  </a>
                </li>
              </ul>
              <p>
                Please note that blocking cookies may have a negative impact on the functions of many websites, including our 
                Site. Some features of the Site may cease to be available to you.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Changes to This Cookie Policy</h2>
              </div>
              <p>
                We may update our Cookie Policy from time to time. We will notify you of any changes by posting the new 
                Cookie Policy on this page.
              </p>
              <p>
                You are advised to review this Cookie Policy periodically for any changes. Changes to this Cookie Policy 
                are effective when they are posted on this page.
              </p>
            </div>

            <div className="mb-8">
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-6 w-6 text-[#063168]"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Contact Us</h2>
              </div>
              <p>
                If you have any questions about this Cookie Policy, please contact us:
              </p>
              <p className="text-[#063168] font-bold">thesocio.blr@gmail.com</p>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between">
                <Link href="/" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                  ← Back to Home
                </Link>
                <div className="space-x-4">
                  <Link href="/terms" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                    Terms of Service
                  </Link>
                  <Link href="/privacy" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                    Privacy Policy
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
