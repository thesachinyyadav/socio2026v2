"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function CookiePolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-[#063168] py-6 px-8">
            <h1 className="text-3xl font-bold text-white">Cookie Policy</h1>
            <p className="mt-2 text-blue-100">Effective Date: April 23, 2026</p>
          </div>

          <div className="px-8 py-6 prose prose-blue max-w-none text-gray-700">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">1. Introduction</h2>
              <p>
                This Cookie Policy explains how SOCIO (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) uses cookies and similar technologies when
                you access or use the SOCIO platform available at https://socio.christuniversity.in/ (&quot;Platform&quot;).
              </p>
              <p>
                This Policy should be read together with our Privacy Policy, which explains how we collect, use, and
                process personal data, including data collected through cookies.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">2. What Are Cookies</h2>
              <p>
                Cookies are small text files that are placed on your device (computer, mobile device, or tablet) when
                you visit a website. Cookies help websites function efficiently and provide information to website
                operators.
              </p>
              <p>
                Cookies may be Session cookies, which expire when you close your browser or Persistent cookies, which
                remain on your device until they expire or are deleted.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">3. Types of Cookies We Use</h2>
              <h3 className="text-xl font-semibold text-gray-800">3.1 Essential Cookies</h3>
              <p>
                These cookies are strictly necessary for the functioning of the Platform and enable core features such
                as authentication, account access, and security. These cookies do not require user consent.
              </p>
              <h3 className="text-xl font-semibold text-gray-800">3.2 Performance and Analytics Cookies</h3>
              <p>
                These cookies collect information about how users interact with the Platform, such as pages visited,
                time spent, and errors encountered. This data is generally aggregated and used to improve performance and
                functionality.
              </p>
              <h3 className="text-xl font-semibold text-gray-800">3.3 Functional Cookies</h3>
              <p>
                These cookies allow the Platform to remember user preferences and provide enhanced, personalized features.
              </p>
              <h3 className="text-xl font-semibold text-gray-800">3.4 Advertising and Promotional Cookies</h3>
              <p>
                These cookies may be used to display relevant announcements, featured events, or promotional content
                based on your interaction with the Platform.
              </p>
              <p>SOCIO does not sell personal data to third-party advertisers.</p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">4. Legal Basis for Use of Cookies</h2>
              <p>We use cookies based on the following legal grounds:</p>
              <ul className="list-disc ml-6 mb-4">
                <li>Essential cookies are used as they are necessary for providing the Platform and its core services</li>
                <li>
                  Non-essential cookies (such as analytics, functional, and promotional cookies) are used only with your
                  consent
                </li>
              </ul>
              <p>
                Where required under applicable laws, including Indian data protection principles, your consent will be
                obtained before placing non-essential cookies on your device.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">5. Cookie Consent and Control</h2>
              <p>
                When you first visit the Platform, you may be presented with a cookie banner requesting your consent for
                the use of non-essential cookies.
              </p>
              <p>
                You have the option to accept all cookies, reject non-essential cookies and customize your cookie
                preferences (if available). You may withdraw or modify your consent at any time through your browser
                settings or any cookie preference tool made available on the Platform.
              </p>
              <p>
                Please note that disabling certain cookies may affect the functionality and performance of the Platform.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">6. Purpose of Cookies</h2>
              <p>
                We use cookies and similar technologies to ensure the proper functioning and security of the Platform,
                authenticate users and maintain session integrity, improve user experience and performance, analyze usage
                patterns and trends, and display relevant announcements and promotional content.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">7. Data Collected Through Cookies</h2>
              <p>
                Cookies may collect certain technical and usage-related information, including IP address, browser type
                and version, device information, pages visited and interaction patterns and date and time of access.
              </p>
              <p>
                This information may, in some cases, be associated with a user account and treated as personal data in
                accordance with our Privacy Policy.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">8. Cookie Duration</h2>
              <p>
                Cookies may remain on your device for varying periods depending on their purpose, where Session cookies
                are deleted when you close your browser and Persistent cookies remain for a predefined period or until
                manually deleted.
              </p>
              <p>The duration of cookies depends on their specific function and configuration.</p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">9. Third-Party Cookies</h2>
              <p>
                We may use third-party service providers, such as analytics or hosting providers, who may place cookies
                on your device to assist in delivering services.
              </p>
              <p>
                These third parties may independently collect and process certain information through their cookies,
                subject to their own privacy policies. SOCIO does not control such third-party cookies and encourages
                users to review the policies of such providers.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">10. Do Not Track Signals</h2>
              <p>
                Some browsers offer a &quot;Do Not Track&quot; (&quot;DNT&quot;) feature that signals websites that you do not wish to be
                tracked. Currently, the Platform does not respond to DNT signals. However, you may manage tracking
                preferences through your cookie settings and browser controls.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">11. Managing Cookies Through Browser Settings</h2>
              <p>
                Most web browsers allow you to control cookies through their settings. You can block cookies, delete
                stored cookies and configure preferences for specific websites.
              </p>
              <p>Disabling cookies may limit certain functionalities of the Platform.</p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">12. Updates to This Cookie Policy</h2>
              <p>
                We may update this Cookie Policy from time to time to reflect changes in technology, legal requirements,
                or Platform features.
              </p>
              <p>
                Any updates will be posted on this page with a revised &quot;Effective Date.&quot; Continued use of the Platform
                after such updates constitutes your acceptance of the revised Policy.
              </p>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">13. Contact Information</h2>
              <p>If you have any questions or concerns regarding this Cookie Policy, you may contact:</p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800">SOCIO Platform Support</p>
                <p>Email: support@withsocio.com</p>
              </div>
            </div>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <div className="flex justify-between">
                <Link href="/" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                  &larr; Back to Home
                </Link>
                <div className="space-x-4">
                  <Link href="/terms" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                    Terms and Conditions
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
