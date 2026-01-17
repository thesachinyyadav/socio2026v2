"use client";

import React from "react";
import Link from "next/link";
import Footer from "../../_components/Home/Footer";

const internshipTracks = [
  {
    title: "Product & Engineering",
    description:
      "Work closely with our core team on building features, fixing bugs, and improving performance across the SOCIO platform.",
    focus: ["Full-stack development", "API integration", "Testing & QA"],
  },
  {
    title: "Design & Storytelling",
    description:
      "Shape the way students experience SOCIO by designing UI, crafting visuals, and helping us tell compelling stories.",
    focus: ["UI/UX design", "Brand collateral", "Content creation"],
  },
  {
    title: "Growth & Community",
    description:
      "Help us reach more campuses, run outreach campaigns, and learn what our community needs next.",
    focus: ["Campus partnerships", "Operations", "Community research"],
  },
];

const applicationSteps = [
  {
    title: "Share your intent",
    detail:
      "Tell us why you want to join SOCIO and which track excites you the most. A short note or a portfolio link is perfect.",
  },
  {
    title: "Meet the team",
    detail:
      "We'll schedule a quick conversation to understand your interests, availability, and expectations.",
  },
  {
    title: "Start your journey",
    detail:
      "Selected interns receive an official onboarding letter, work with mentors, and get certified by Christ Incubation and Consultancy Foundation.",
  },
];

const benefits = [
  "Certificate of completion endorsed by Christ Incubation and Consultancy Foundation (CICF)",
  "Hands-on experience with a fast-growing campus product",
  "Direct mentorship from the founding team",
  "Flexible schedules that work around classes and exams",
  "Access to SOCIO's alumni and partner network",
];

const CareersPage = () => {
  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-10 flex items-center justify-between">
          <h1 className="text-3xl font-black text-[#154CB3] mt-6">Careers at SOCIO</h1>
          <Link
            href="/support"
            className="flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
              className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18"
              />
            </svg>
            Back to Support
          </Link>
        </div>

        <section className="mb-16 rounded-2xl bg-gradient-to-br from-[#063168] via-[#154CB3] to-[#3D75BD] text-white p-6 sm:p-12 shadow-lg">
          <div className="max-w-3xl space-y-6">
            <h2 className="text-2xl sm:text-3xl font-black">
              Build the future of campus life with us
            </h2>
            <p className="text-base sm:text-lg text-blue-100 leading-relaxed">
              SOCIO is in its early development phase and we are opening opportunities for passionate interns who want to learn, build, and create impact across campuses. Every role is internship-first, designed to help you gain experience while contributing to a fast-growing platform.
            </p>
            <div className="bg-white/10 border border-white/20 rounded-xl p-4 sm:p-6">
              <p className="text-sm sm:text-base text-blue-50">
                Each internship is officially supported by Christ Incubation and Consultancy Foundation (CICF). Complete your term successfully and you will receive certificates and recommendations issued by CICF and the SOCIO founding team.
              </p>
            </div>
          </div>
        </section>

        <section className="mb-16">
          <h3 className="text-2xl font-bold text-[#063168] mb-6">Where you can contribute</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {internshipTracks.map((track) => (
              <div
                key={track.title}
                className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <h4 className="text-xl font-semibold text-[#154CB3] mb-3">
                  {track.title}
                </h4>
                <p className="text-gray-600 text-sm leading-relaxed mb-4">
                  {track.description}
                </p>
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    You will explore
                  </p>
                  <ul className="space-y-2">
                    {track.focus.map((area) => (
                      <li key={area} className="flex items-center gap-2 text-sm text-gray-700">
                        <span className="h-2 w-2 rounded-full bg-[#FFCC00]"></span>
                        {area}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-[#F6F9FF] border border-[#154CB3]/20 rounded-2xl p-6 sm:p-8">
            <h3 className="text-xl font-bold text-[#063168] mb-4">Why join SOCIO?</h3>
            <ul className="space-y-3">
              {benefits.map((benefit) => (
                <li key={benefit} className="flex items-start gap-3 text-sm text-gray-700">
                  <span className="mt-1 h-3 w-3 flex-shrink-0 rounded-full bg-[#FFCC00]"></span>
                  {benefit}
                </li>
              ))}
            </ul>
          </div>
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#063168] mb-4">How the process works</h3>
            <ol className="space-y-4">
              {applicationSteps.map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="h-10 w-10 flex items-center justify-center rounded-full bg-[#FFCC00] text-[#063168] font-bold">
                    {index + 1}
                  </span>
                  <div>
                    <h4 className="text-base font-semibold text-[#154CB3]">
                      {step.title}
                    </h4>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {step.detail}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-[#063168] text-white rounded-2xl p-6 sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-3">Ready to apply?</h3>
              <p className="text-sm sm:text-base text-blue-100 max-w-xl">
                Send your resume or portfolio to our hiring desk. Let us know the internship track you are excited about, your availability, and any standout projects or campus work.
              </p>
            </div>
            <a
              href="mailto:hr.socio.blr@gmail.com"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-[#FFCC00] text-[#063168] font-semibold shadow-md hover:bg-[#ffcc00e6] transition-colors"
            >
              Email hr.socio.blr@gmail.com
            </a>
          </div>
        </section>

        <section className="mb-16">
          <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8 shadow-sm">
            <h3 className="text-xl font-bold text-[#063168] mb-4">Important notes</h3>
            <ul className="space-y-3 text-sm text-gray-600">
              <li>
                All roles are internship-based and structured around academic schedules. We do not have full-time openings yet.
              </li>
              <li>
                Internships typically run for 8-12 weeks, with flexible commitments depending on the team you join.
              </li>
              <li>
                Certificates are issued jointly by Christ Incubation and Consultancy Foundation (CICF) and the SOCIO founding team after successful completion.
              </li>
              <li>
                We love proactive applicants—feel free to pitch ideas that can make student life better.
              </li>
            </ul>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default CareersPage;
