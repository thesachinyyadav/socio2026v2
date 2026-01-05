"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TermsOfService() {
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
            <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
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
                <h2 className="text-2xl font-bold text-[#063168] m-0">Welcome to Socio</h2>
              </div>
              <p>
                These Terms of Service ("Terms") govern your access to and use of Socio, a platform designed 
                for university students to discover and engage with campus events and activities. By accessing 
                or using Socio, you agree to be bound by these Terms. If you do not agree to these Terms, 
                please do not access or use Socio.
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
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Eligibility</h2>
              </div>
              <p>
                Socio is intended for use by current students, faculty, and staff of the university. To access 
                and use Socio, you must have a valid university email address ending in "christuniversity.in" or contact us at thesocio.blr@gmail.com for 
                otherwise approved by Socio administrators. By accessing or using Socio, you represent and warrant 
                that you are a current student, faculty, or staff member of the university.
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
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">User Accounts</h2>
              </div>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials and for all 
                activities that occur under your account. You agree to immediately notify Socio of any unauthorized 
                use of your account or any other breach of security. Socio will not be liable for any loss or damage 
                arising from your failure to comply with this section.
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
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Content and Conduct</h2>
              </div>
              <p>
                <strong>User-Generated Content:</strong> You are solely responsible for any content you post, upload, 
                or otherwise make available through Socio ("User Content"). By posting User Content, you represent 
                and warrant that you have all necessary rights to post such content and that it does not violate any laws 
                or infringe upon the rights of any third party.
              </p>
              <p>
                <strong>Prohibited Conduct:</strong> You agree not to engage in any of the following:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Posting false, misleading, or fraudulent information</li>
                <li>Harassing, threatening, or intimidating other users</li>
                <li>Posting content that is defamatory, obscene, or offensive</li>
                <li>Using Socio for any illegal purpose or to violate university policies</li>
                <li>Attempting to interfere with, compromise, or disrupt Socio's services</li>
                <li>Impersonating any person or entity</li>
              </ul>
              <p>
                <strong>IMPORTANT DISCLAIMER:</strong> Socio is not responsible for any incidents, disputes, 
                or negative outcomes that may result from connections or interactions made through our platform. 
                We provide a platform for students to connect, but we do not control or monitor individual 
                communications or activities. Please exercise caution and good judgment when interacting with 
                others or attending events discovered through Socio.
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
                <h2 className="text-2xl font-bold text-[#063168] m-0">Intellectual Property</h2>
              </div>
              <p>
                Socio and its content, features, and functionality are owned by us and are protected by copyright, 
                trademark, and other intellectual property laws. You may not copy, modify, create derivative works of, 
                publicly display, publicly perform, republish, download, or distribute any portion of Socio without 
                our prior written consent.
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
                      d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Limitation of Liability</h2>
              </div>
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, SOCIO AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS WILL 
                NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING 
                WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc ml-6 mb-4">
                <li>Your access to or use of or inability to access or use Socio</li>
                <li>Any conduct or content of any third party on Socio</li>
                <li>Any content obtained from Socio</li>
                <li>Unauthorized access, use, or alteration of your transmissions or content</li>
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
                      d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Termination</h2>
              </div>
              <p>
                We may terminate or suspend your account and access to Socio immediately, without prior notice or 
                liability, for any reason, including without limitation if you breach these Terms. Upon termination, 
                your right to use Socio will immediately cease.
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
                      d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Governing Law</h2>
              </div>
              <p>
                These Terms shall be governed by the laws of India, without respect to its conflict of laws principles. 
                Any dispute arising from or relating to these Terms shall be subject to the exclusive jurisdiction of 
                the courts of Bangalore, India.
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-[#063168] m-0">Changes to Terms</h2>
              </div>
              <p>
                We reserve the right to modify or replace these Terms at any time. If a revision is material, we will 
                provide at least 30 days' notice prior to any new terms taking effect. What constitutes a material 
                change will be determined at our sole discretion. By continuing to access or use Socio after any 
                revisions become effective, you agree to be bound by the revised terms.
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
                If you have any questions about these Terms, please contact us at:
              </p>
              <p className="text-[#063168] font-bold">thesocio.blr@gmail.com</p>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between">
                <Link href="/" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                  ← Back to Home
                </Link>
                <div className="space-x-4">
                  <Link href="/privacy" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                    Privacy Policy
                  </Link>
                  <Link href="/cookies" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                    Cookie Policy
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