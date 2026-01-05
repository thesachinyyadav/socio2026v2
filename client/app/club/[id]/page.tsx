"use client";

import React from "react";
import Image from "next/image";

interface ClubDetailsProps {
  id: number;
  name: string;
  description: string;
  mission: string;
  vision: string;
  activities: string[];
  leaders: {
    name: string;
    role: string;
    image?: string;
  }[];
  contactInfo: {
    email: string;
    instagram?: string;
    facebook?: string;
    twitter?: string;
    website?: string;
  };
  meetingSchedule: string;
  coverImage: string;
  logo?: string;
  joinProcess: string;
  category: string[];
}

const ClubDetailsPage = () => {
  const clubDetails: ClubDetailsProps = {
    id: 1,
    name: "Technology Innovation Club",
    description:
      "A student-led organization focused on fostering technological innovation and entrepreneurship among university students. The club provides a platform for students to explore emerging technologies, develop technical skills, and collaborate on innovative projects.",
    mission:
      "To create a vibrant community of innovators who leverage technology to solve real-world problems and drive positive change in society.",
    vision:
      "Empowering students to become technological leaders and innovators who will shape the future of technology and entrepreneurship.",
    activities: [
      "Weekly tech workshops and hands-on training sessions",
      "Hackathons and coding competitions",
      "Industry expert guest lectures and networking events",
      "Collaborative projects with industry partners",
      "Annual tech symposium and innovation showcase",
    ],
    leaders: [
      {
        name: "Sarah Johnson",
        role: "President",
        image:
          "https://img.recraft.ai/X9PcH7ypNX4jGHPN6p4nb0P1SAP18j9uvc4tJj5UFL8/rs:fit:1024:1024:0/q:95/g:no/plain/abs://prod/images/2033dd45-d880-48b1-a247-1048c727f601@jpg",
      },
      {
        name: "Michael Chen",
        role: "Vice President",
        image:
          "https://img.recraft.ai/7Tgr1_2Sz_kz-NBpN3_KeUTNqLFmsNhQU0qWRSkND_I/rs:fit:1024:1024:0/q:95/g:no/plain/abs://prod/images/3caea42f-fe76-4992-b5e5-39612662b542@jpg",
      },
      {
        name: "Jessica Patel",
        role: "Technical Lead",
        image:
          "https://img.recraft.ai/B3GF-EcAdp0Eq6TwhjeEbUwk1TbnRT2jVKzbWx1dBus/rs:fit:1024:1024:0/q:95/g:no/plain/abs://prod/images/2ce2df3f-4ca5-4cab-a3ef-0a627f31c723@jpg",
      },
    ],
    contactInfo: {
      email: "tech.innovation@university.edu",
      instagram: "tech_innovation_club",
      facebook: "TechInnovationClub",
      twitter: "TechInnovClub",
      website: "https://techinnovationclub.university.edu",
    },
    meetingSchedule:
      "Every Wednesday at 5:00 PM in the Innovation Lab (Room 302, Technology Building)",
    coverImage:
      "https://img.recraft.ai/fZsh_b0fzcNaVdNLipdxoIPA-pj0NIm_SRLcnRapWRI/rs:fit:2048:1024:0/q:95/g:no/plain/abs://prod/images/76d78cf4-c7a2-479c-bd3d-d46d88cd63b3@jpg",
    logo: "https://img.recraft.ai/2CYhLu0usYJRKXNfVdYdDg0M7KG_0v-_4RHVM1Qolgk/rs:fit:1024:1024:0/q:95/g:no/plain/abs://prod/images/7f70a825-0020-44d2-9407-d3e6eec60bb0@jpg",
    joinProcess:
      "Interested students can join by filling out the membership form on our website or by attending our introductory meeting at the beginning of each semester. No prior technical experience required!",
    category: ["Innovation", "Technology", "Academic"],
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="relative w-full h-64 sm:h-80 md:h-96">
        <div className="absolute inset-0">
          <Image
            src={clubDetails.coverImage}
            alt={`${clubDetails.name} cover image`}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black opacity-60"></div>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-6 md:p-8 text-white">
          <div className="container mx-auto max-w-7xl flex items-end">
            {clubDetails.logo && (
              <div className="mr-4 sm:mr-6 hidden sm:block">
                <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-full overflow-hidden border-2 border-white">
                  <Image
                    src={clubDetails.logo}
                    alt={`${clubDetails.name} logo`}
                    fill
                    className="object-cover"
                  />
                </div>
              </div>
            )}
            <div>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-black mb-1 sm:mb-2">
                {clubDetails.name}
              </h1>
              <div className="flex flex-wrap gap-2 mb-6">
                {clubDetails.category.map((category, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 text-xs bg-[#e9f0fd] text-[#154CB3] rounded-full"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12 mt-5">
          <div className="lg:col-span-2">
            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] mb-4">About</h2>
              <p className="text-gray-700 mb-6">{clubDetails.description}</p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-[#f5f8fe] p-5 rounded-lg">
                  <h3 className="text-lg font-semibold text-[#154CB3] mb-2">
                    Mission
                  </h3>
                  <p className="text-gray-700">{clubDetails.mission}</p>
                </div>
                <div className="bg-[#f5f8fe] p-5 rounded-lg">
                  <h3 className="text-lg font-semibold text-[#154CB3] mb-2">
                    Vision
                  </h3>
                  <p className="text-gray-700">{clubDetails.vision}</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold text-[#063168] mb-4">
                Activities
              </h2>
              <ul className="list-disc pl-5 space-y-2 text-gray-700">
                {clubDetails.activities.map((activity, index) => (
                  <li key={index}>{activity}</li>
                ))}
              </ul>
            </section>

            <section className="hidden md:block mb-8">
              <h2 className="text-2xl font-bold text-[#063168] mb-4">
                Leadership Team
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {clubDetails.leaders.map((leader, index) => (
                  <div
                    key={index}
                    className="bg-white border border-gray-200 rounded-lg p-4 flex flex-col items-center text-center"
                  >
                    <div className="relative w-20 h-20 rounded-full overflow-hidden mb-3">
                      <Image
                        src={leader.image || "https://via.placeholder.com/200"}
                        alt={leader.name}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <h3 className="font-semibold text-[#154CB3]">
                      {leader.name}
                    </h3>
                    <p className="text-sm text-gray-600">{leader.role}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-[#f5f8fe] rounded-lg p-6 mb-6">
              <h3 className="text-lg font-semibold text-[#154CB3] mb-4">
                How to Join
              </h3>
              <p className="text-gray-700 mb-6">{clubDetails.joinProcess}</p>
              <button className="w-full bg-[#154CB3] text-white py-2 px-4 rounded-md hover:bg-[#063168] transition duration-200">
                Apply to Join
              </button>
            </div>

            <div className="bg-[#f5f8fe] rounded-lg p-6">
              <h3 className="text-lg font-semibold text-[#154CB3] mb-4">
                Contact Information
              </h3>
              <div className="flex items-center mb-3">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                  className="w-5 h-5 text-[#154CB3] mr-2"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                  />
                </svg>
                <a
                  href={`mailto:${clubDetails.contactInfo.email}`}
                  className="text-[#154CB3] hover:underline"
                >
                  {clubDetails.contactInfo.email}
                </a>
              </div>

              <div className="flex flex-wrap gap-3">
                {clubDetails.contactInfo.website && (
                  <a
                    href={clubDetails.contactInfo.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center bg-[#154CB3] text-white rounded-full hover:bg-[#063168] transition duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418"
                      />
                    </svg>
                  </a>
                )}

                {clubDetails.contactInfo.instagram && (
                  <a
                    href={`https://instagram.com/${clubDetails.contactInfo.instagram}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center bg-[#154CB3] text-white rounded-full hover:bg-[#063168] transition duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="bi bi-instagram"
                      viewBox="0 0 16 16"
                    >
                      <path d="M8 0C5.829 0 5.556.01 4.703.048 3.85.088 3.269.222 2.76.42a3.917 3.917 0 0 0-1.417.923A3.927 3.927 0 0 0 .42 2.76C.222 3.268.087 3.85.048 4.7.01 5.555 0 5.827 0 8.001c0 2.172.01 2.444.048 3.297.04.852.174 1.433.372 1.942.205.526.478.972.923 1.417.444.445.89.719 1.416.923.51.198 1.09.333 1.942.372C5.555 15.99 5.827 16 8 16s2.444-.01 3.298-.048c.851-.04 1.434-.174 1.943-.372a3.916 3.916 0 0 0 1.416-.923c.445-.445.718-.891.923-1.417.197-.509.332-1.09.372-1.942C15.99 10.445 16 10.173 16 8s-.01-2.445-.048-3.299c-.04-.851-.175-1.433-.372-1.941a3.926 3.926 0 0 0-.923-1.417A3.911 3.911 0 0 0 13.24.42c-.51-.198-1.092-.333-1.943-.372C10.443.01 10.172 0 7.998 0h.003zm-.717 1.442h.718c2.136 0 2.389.007 3.232.046.78.035 1.204.166 1.486.275.373.145.64.319.92.599.28.28.453.546.598.92.11.281.24.705.275 1.485.039.843.047 1.096.047 3.231s-.008 2.389-.047 3.232c-.035.78-.166 1.203-.275 1.485a2.47 2.47 0 0 1-.599.919c-.28.28-.546.453-.92.598-.28.11-.704.24-1.485.276-.843.038-1.096.047-3.232.047s-2.39-.009-3.233-.047c-.78-.036-1.203-.166-1.485-.276a2.478 2.478 0 0 1-.92-.598 2.48 2.48 0 0 1-.6-.92c-.109-.281-.24-.705-.275-1.485-.038-.843-.046-1.096-.046-3.233 0-2.136.008-2.388.046-3.231.036-.78.166-1.204.276-1.486.145-.373.319-.64.599-.92.28-.28.546-.453.92-.598.282-.11.705-.24 1.485-.276.738-.034 1.024-.044 2.515-.045v.002zm4.988 1.328a.96.96 0 1 0 0 1.92.96.96 0 0 0 0-1.92zm-4.27 1.122a4.109 4.109 0 1 0 0 8.217 4.109 4.109 0 0 0 0-8.217zm0 1.441a2.667 2.667 0 1 1 0 5.334 2.667 2.667 0 0 1 0-5.334z" />
                    </svg>
                  </a>
                )}

                {clubDetails.contactInfo.facebook && (
                  <a
                    href={`https://facebook.com/${clubDetails.contactInfo.facebook}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center bg-[#154CB3] text-white rounded-full hover:bg-[#063168] transition duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="bi bi-facebook"
                      viewBox="0 0 16 16"
                    >
                      <path d="M16 8.049c0-4.446-3.582-8.05-8-8.05C3.58 0-.002 3.603-.002 8.05c0 4.017 2.926 7.347 6.75 7.951v-5.625h-2.03V8.05H6.75V6.275c0-2.017 1.195-3.131 3.022-3.131.876 0 1.791.157 1.791.157v1.98h-1.009c-.993 0-1.303.621-1.303 1.258v1.51h2.218l-.354 2.326H9.25V16c3.824-.604 6.75-3.934 6.75-7.951z" />
                    </svg>
                  </a>
                )}

                {clubDetails.contactInfo.twitter && (
                  <a
                    href={`https://twitter.com/${clubDetails.contactInfo.twitter}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-8 h-8 flex items-center justify-center bg-[#154CB3] text-white rounded-full hover:bg-[#063168] transition duration-200"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="currentColor"
                      className="bi bi-twitter-x"
                      viewBox="0 0 16 16"
                    >
                      <path d="M12.6.75h2.454l-5.36 6.142L16 15.25h-4.937l-3.867-5.07-4.425 5.07H.316l5.733-6.57L0 .75h5.063l3.495 4.633L12.601.75Zm-.86 13.028h1.36L4.323 2.145H2.865l8.875 11.633Z" />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ClubDetailsPage;
