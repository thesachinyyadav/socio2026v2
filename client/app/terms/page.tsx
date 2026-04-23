"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function TermsOfService() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-[#063168] py-6 px-8">
            <h1 className="text-3xl font-bold text-white">Terms and Conditions</h1>
            <p className="mt-2 text-blue-100">Effective Date: January 30,06</p>
          </div>

          <div className="px-8 py-6 prose prose-blue max-w-none text-gray-700">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] m-0">TERMS AND CONDITIONS OF USE</h2>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">1. About SOCIO and Your Agreement</h3>
              <p>
                SOCIO is an event-centric digital platform created to streamline campus fest and event participation at
                Christ University by enabling users to discover, register for, and engage with events in an organized and
                accessible manner.
              </p>
              <p>
                These Terms and Conditions (&quot;Terms&quot;) constitute a legally binding agreement between you and the SOCIO
                platform, operated by its founders (&quot;SOCIO&quot;, &quot;we&quot;, &quot;us&quot;, or &quot;our&quot;), governing your access to and use of
                https://socio.christuniversity.in/ (&quot;Platform&quot;).
              </p>
              <p>
                By accessing or using the Platform, you agree to comply with and be bound by these Terms. If you do not
                agree, you must refrain from using the Platform.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">1.1. What the Platform Provides</h3>
              <p>
                SOCIO functions as an intermediary platform that allows users to create profiles, explore events, and
                register for fests. It also enables event organizers to publish event details, collect participant
                information, and communicate updates.
              </p>
              <p>
                SOCIO does not organize events itself unless explicitly stated and shall not be responsible for the
                execution, management, or outcome of any event listed on the Platform.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">1.2. Registration, Access, and Account Integrity</h3>
              <p>
                Certain features of the Platform require account creation. You agree to provide accurate and current
                information, including your name, email, and academic affiliation where applicable.
              </p>
              <p>
                You are solely responsible for safeguarding your login credentials and for all activities conducted
                through your account. Any misuse, unauthorized access, or suspected breach must be reported immediately.
              </p>
              <p>
                SOCIO reserves the right to restrict, suspend, or terminate access where information is found to be
                inaccurate or where the account is used in violation of these Terms.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">2. Acceptable Use and Platform Discipline</h3>
              <p>
                You agree to use the Platform in a lawful and responsible manner. You shall not misuse the Platform by
                posting inaccurate event details, misleading participants, uploading harmful or unlawful content, or
                attempting to disrupt the Platform&apos;s functionality.
              </p>
              <p>
                Any form of harassment, impersonation, fraud, or unauthorized system access is strictly prohibited. SOCIO
                reserves the right to take corrective action, including removal of content or suspension of accounts.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">2.1. Event Information and Organizer Obligations</h3>
              <p>
                Users who publish events (&quot;Organizers&quot;) are solely responsible for ensuring that all information relating
                to the event, including descriptions, schedules, eligibility criteria, and instructions, is accurate and
                complete.
              </p>
              <p>
                SOCIO acts only as a facilitation tool and does not verify or guarantee the authenticity, quality, or
                execution of any event. Any disputes, claims, or issues arising from events must be resolved directly
                between participants and organizers.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">2.2. Limited Use of User Information for Platform Functionality</h3>
              <p>
                In order to enable registrations, participation tracking, and event coordination, certain user-provided
                information (such as name, contact details, and registration inputs) may be made accessible to relevant
                event organizers and platform administrators.
              </p>
              <p>
                Additionally, the Platform may display announcements, featured events, or promotional content based on
                general user interactions within the Platform. Such use is limited to improving user experience and
                visibility of events and does not involve sale of user data.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3. Ownership of Platform and Content Rights</h3>
              <p>
                All rights, title, and interest in and to the Platform, including its design, structure, software,
                branding, and content (excluding user-generated content), are owned by SOCIO and are protected under
                applicable intellectual property laws.
              </p>
              <p>
                Users retain ownership of the content they upload or publish. However, by submitting content,which
                includes event details, images, or communications, you grant SOCIO a non-exclusive, worldwide,
                royalty-free license to use, display, reproduce, and distribute such content for purposes related to
                operating, improving, and promoting the Platform.
              </p>
              <p>
                The Platform is protected under applicable copyright, trademark, and other intellectual property laws in
                India. You are granted a limited, non-exclusive, non-transferable, and revocable license to access and
                use the Platform strictly for its intended purposes. You shall not copy, modify, distribute, reverse
                engineer, decompile, extract source code, or create derivative works from any part of the Platform
                without prior written consent from SOCIO.
              </p>
              <p>
                Any unauthorized use of the Platform&apos;s intellectual property shall constitute a violation of applicable
                laws and may result in legal action.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.1. User Content and Copyright Compliance</h3>
              <p>
                Users may upload or publish content such as event details, images, or communications on the Platform.
                You retain ownership of such content; however, by submitting it, you grant SOCIO a limited,
                non-exclusive, royalty-free license to host, display, and use such content solely for operating and
                promoting the Platform.
              </p>
              <p>
                You are solely responsible for ensuring that any content you upload does not infringe the copyright or
                intellectual property rights of any third party. SOCIO does not claim ownership over user-generated
                content but reserves the right to remove any content that violates these Terms or applicable laws.
              </p>
              <p>
                If you believe that any content on the Platform infringes your copyright, you may notify us at
                support@withsocio.com with relevant details. Upon receiving a valid complaint, SOCIO may remove or
                restrict access to such content and take appropriate action.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.2. External Links and Third-Party Interfaces</h3>
              <p>
                The Platform may include links to third-party websites or services for user convenience. SOCIO does not
                control or endorse such services and shall not be responsible for their content, accuracy, or practices.
              </p>
              <p>Users access such third-party services at their own risk.</p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.3. Platform Availability and Disclaimer</h3>
              <p>
                SOCIO strives to maintain uninterrupted access to the Platform, however, it does not guarantee continuous
                or error-free operation. The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
                warranties of any kind.
              </p>
              <p>
                SOCIO does not warrant that the Platform will meet all user expectations or that any defects will be
                corrected immediately.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.4. Limitation of Liability</h3>
              <p>
                To the fullest extent permitted by law, SOCIO and its founders shall not be liable for any indirect,
                incidental, consequential, or special damages arising out of or in connection with the use of the
                Platform or participation in any events listed on it.
              </p>
              <p>This includes, but is not limited to, loss of data, opportunity, goodwill, or reputation.</p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.5. User Responsibility and Indemnification</h3>
              <p>
                You agree to indemnify and hold harmless SOCIO, its founders, and affiliates against any claims,
                liabilities, damages, or expenses arising from your use of the Platform, your violation of these Terms,
                or your infringement of any rights of a third party.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">3.6. Suspension, Restriction, and Termination</h3>
              <p>
                SOCIO reserves the right to suspend, restrict, or terminate your access to the Platform at any time,
                without prior notice, if it believes that you have violated these Terms or engaged in conduct harmful to
                the Platform or its users.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">4. Updates to These Terms</h3>
              <p>
                These Terms may be revised from time to time. Updated versions will be made available on the Platform.
                Continued use of the Platform after such updates constitutes your acceptance of the revised Terms.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">5. Applicable Law and Jurisdiction</h3>
              <p>
                These Terms shall be governed by the laws of India. Any disputes arising out of or relating to these
                Terms shall be subject to the exclusive jurisdiction of the courts in Bangalore, Karnataka.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-bold text-[#063168] m-0">6. Contact and Grievance Redressal</h3>
              <p>
                For any queries, complaints, or intellectual property concerns, you may contact:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800">SOCIO Support Team</p>
                <p>Email: support@withsocio.com</p>
              </div>
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
