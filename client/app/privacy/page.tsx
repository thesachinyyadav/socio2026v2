"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PrivacyPolicy() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-blue-50">
      <div className="max-w-4xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="bg-white shadow-xl rounded-2xl overflow-hidden">
          <div className="bg-[#063168] py-6 px-8">
            <h1 className="text-3xl font-bold text-white">Privacy Policy</h1>
            <p className="mt-2 text-blue-100">Effective Date: April 23, 2026</p>
          </div>

          <div className="px-8 py-6 prose prose-blue max-w-none text-gray-700">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-800">Introduction and Acceptance of Terms</h2>
              <p>
                SOCIO&apos;s mission is to simplify campus event management at Christ University, making it easy for students
                to discover, register, and engage with events. Focus on creating meaningful connections by making campus
                events accessible, discoverable, and engaging for every student.
              </p>
              <p>
                This Terms of Use and Privacy Policy (&quot;Agreement&quot;) governs your access to and use of the SOCIO platform,
                accessible at https://socio.christuniversity.in/ (&quot;Platform&quot;), which is owned, operated, and managed by
                SOCIO FOUNDERS (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;). The privacy policy applies to all the users who render to our services,
                offering a choice to choose the data we collect, use and share as described in the Privacy Policy,
                Cookie Policy, Setting and our Help Center.
              </p>
              <p>
                SOCIO is a digital platform designed to enable students, alumni, faculty, and associated individuals to
                collaborate, share information, and access academic, professional, and institutional opportunities.
              </p>
              <p>
                By accessing, registering on, or using the Platform, you agree to be bound by the terms of this Agreement.
                If you do not agree with any part of these terms, you must discontinue use of the Platform immediately.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">1.1. Nature of Services</h3>
              <p>
                SOCIO provides users with a digital environment to create profiles, register for fests, participate in
                events, share required information about events, provide updates, and explore academic or interest-related
                opportunities.
              </p>
              <p>
                The Platform is intended for lawful and legitimate use only and must not be used for any purpose that
                violates applicable laws or institutional policies.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">1.2. User Accounts and Registration</h3>
              <p>
                In order to access certain features, users may be required to create an account by providing personal
                information such as name, email address and academic or professional information. You agree that all
                information provided during registration and thereafter is accurate, complete, and up to date.
              </p>
              <p>
                You are responsible for maintaining the confidentiality of your login credentials and for all activities
                that occur under your account. The University reserves the right to suspend or terminate accounts that
                provide false information or engage in unauthorized activities.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">2. Collection of Personal Data</h3>
              <p>
                We collect personal data that you voluntarily provide, including but not limited to your name, contact
                details, academic information, profile details, and any content you post, upload, or share on the
                Platform. This includes instructions, posts, and participation in surveys or forms. The fest organiser
                must provide information required about the fest by the platform.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">2.1. Use of Personal Data</h3>
              <p>
                Your personal data is used to provide, operate, and improve the Platform and its services. We may also
                use your data to communicate with you regarding updates, notifications, administrative messages, and
                relevant opportunities.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">3. Advertising and Marketing</h3>
              <p>
                SOCIO may display promotional content, announcements, sponsored posts, or institutional advertisements
                on the Platform. These may include university programs, events and collaborations.
              </p>
              <p>
                We may use certain data such as your profile information, interests, interactions, and usage patterns to
                ensure that advertisements and promotional content are relevant to you. However, we do not sell your
                personal data to third parties for advertising purposes.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">4. Sharing of Information</h3>
              <p>
                Your information will be visible to the organising users and master admin of the Platform. Any content
                you post, including instructions or fest details, may be accessible to other users interested in the fest
                through the Platform.
              </p>
              <p>
                We may also disclose your information if required by law, legal process, or regulatory authority, or
                where such disclosure is necessary to protect the rights, safety, or integrity of the Platform, the
                University, or its users.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">4.1. User Content and Conduct</h3>
              <p>
                Users are responsible for the fest they post on the Platform, however, by posting the fest, you grant
                the University a non-exclusive, royalty-free license to use, display, reproduce, and distribute such
                content for the purpose of operating and promoting the Platform.
              </p>
              <p>
                You agree not to post or share content that is unlawful, defamatory, harmful, misleading, infringing,
                or otherwise inappropriate. The University and the SOCIO operators reserve the right to remove content
                and take appropriate action, including suspension or termination of accounts, in case of violations.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">4.2. Data Retention</h3>
              <p>
                We retain personal data for as long as your account remains active or as necessary to fulfill the purposes
                outlined in this Agreement. Even after account closure, certain data may be retained where required for
                legal, administrative, or security purposes.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">4.3. User Rights</h3>
              <p>
                You have the right to access, update, correct, or request deletion of your personal data, subject to
                applicable laws and institutional requirements. You may also request restriction of processing or object
                to certain uses of your data.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">5. Security of Data</h3>
              <p>
                We implement reasonable technical and organizational measures to safeguard your personal data against
                unauthorized access, misuse, or alteration. However, no system is completely secure, and we cannot
                guarantee absolute security of information transmitted through the Platform. Users are encouraged to take
                appropriate precautions, including safeguarding login credentials and avoiding sharing sensitive information
                publicly.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">5.1. Third-Party Links and Services</h3>
              <p>
                The Platform may contain links to third-party websites or services. These are provided for convenience
                only, and we do not control or endorse such third parties. We are not responsible for their content,
                policies, or practices, and users are advised to review their terms separately.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">5.2. Limitation of Liability</h3>
              <p>
                To the maximum extent permitted by law, the University or the founders of SOCIO shall not be liable for
                any direct, indirect, incidental, or consequential damages arising from the use of or inability to use
                the Platform, including loss of data, reputation, or opportunities.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">5.3. Governing Law and Jurisdiction</h3>
              <p>
                This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes
                arising from or relating to this Agreement shall be subject to the exclusive jurisdiction of the courts
                located in Bangalore, Karnataka.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">6. Modification of Terms</h3>
              <p>
                We reserve the right to modify this Agreement at any time. Changes will be communicated through the
                Platform or other appropriate means. Continued use of the Platform after such changes constitutes
                acceptance of the revised terms.
              </p>
            </div>

            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800">6.1. Contact Information</h3>
              <p>
                For any questions, concerns, or requests regarding this Agreement or your personal data, please contact:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg">
                <p className="font-medium text-gray-800">SOCIO Platform Support</p>
                <p>Email: support@withsocio.com</p>
              </div>
            </div>

            <div className="mt-12 pt-6 border-t border-gray-200">
              <h3 className="text-xl font-semibold text-gray-800 mb-4">Related Documents</h3>
              <div className="flex flex-wrap gap-4">
                <Link href="/terms" className="text-[#063168] hover:text-[#3D75BD] font-medium">
                  Terms and Conditions
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
  );
}
