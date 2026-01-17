"use client";

import React, { useState } from "react";
import Link from "next/link";

import { CentreClubCard } from "../_components/Discover/ClubCard";
import Footer from "../_components/Home/Footer";

interface Centre {
  id: number;
  title: string;
  subtitle?: string;
  description: string;
  link?: string;
  image?: string;
}

interface FilterOption {
  name: string;
  active: boolean;
}

const CentresPage = () => {
  const [filterOptions, setFilterOptions] = useState<FilterOption[]>([
    { name: "All", active: true },
    { name: "Research", active: false },
    { name: "Academic", active: false },
    { name: "Cultural", active: false },
    { name: "Student support", active: false },
    { name: "Innovation", active: false },
    { name: "Social", active: false },
    { name: "Leadership", active: false },
    { name: "Sports", active: false },
  ]);

  const allCentres: Centre[] = [
    {
      id: 1,
      title: "CNRI",
      subtitle: "Centre for Neurodiversity Research and Innovation",
      description: "Enhances understanding and support for neurodiverse individuals by fostering research and innovation, creating inclusive environments, and advancing societal awareness and acceptance.",
      link: "https://christuniversity.in/center/C/cnri",
      image: "https://christuniversity.in/uploads/centers/thumb/472543836_2024-02-08_04-05-53.jpg",
    },
    {
      id: 2,
      title: "CAPS",
      subtitle: "Centre for Academic and Professional Support",
      description: "Provides academic and professional training, resources, and talks designed to support students' academic excellence and career development with workshops on various skills.",
      link: "https://caps.christuniversity.in/",
      image: "https://christuniversity.in/uploads/centers/thumb/399194325_2023-07-11_06-36-56.jpg",
    },
    {
      id: 3,
      title: "CARD",
      subtitle: "Centre for Advanced Research and Development",
      description: "Focuses on advancing research in various disciplines by providing resources, facilities, and support for innovative research projects that contribute to academic knowledge and societal development.",
      link: "https://christuniversity.in/center/C/card",
      image: "https://christuniversity.in/uploads/centers/thumb/1464799697_2023-06-16_10-20-28.jpg",
    },
    {
      id: 4,
      title: "CAI",
      subtitle: "Centre for Artificial Intelligence",
      description: "Dedicated to advancing education, research, and innovation in artificial intelligence, focusing on practical applications of AI technologies in industries and academia.",
      link: "https://christuniversity.in/center/C/Centre-forArtificialIntelligence",
      image: "https://christuniversity.in/uploads/centers/thumb/826197872_2023-07-11_06-30-37.jpg",
    },
    {
      id: 5,
      title: "CCRD",
      subtitle: "Centre for Case Research and Development",
      description: "Develops comprehensive case studies across disciplines, enhancing teaching effectiveness through real-world business scenarios and facilitating case-based learning and research.",
      link: "https://christuniversity.in/center/C/Centre-for-Case-Research-and-Development-",
      image: "https://christuniversity.in/uploads/centers/thumb/1739624898_2023-06-16_09-51-59.jpg",
    },
    {
      id: 6,
      title: "CCD",
      subtitle: "Centre for Concept Design",
      description: "Emphasizes effective communication through media, content, and digital services, nurturing creativity and providing tools to conceptualize and design innovative digital media projects.",
      link: "https://christuniversity.in/center/C/CCD",
      image: "https://christuniversity.in/uploads/centers/thumb/1134426620_2023-06-16_09-34-34.jpg",
    },
    {
      id: 7,
      title: "CCHS",
      subtitle: "Centre for Counselling and Health Services",
      description: "Offers services to support mental and physical well-being of students including counseling sessions, mental health awareness programs, and professional health support.",
      link: "https://christuniversity.in/center/C/CCHS",
      image: "https://christuniversity.in/uploads/centers/thumb/474773062_2023-06-16_09-24-32.jpg",
    },
    {
      id: 8,
      title: "CDI",
      subtitle: "Centre for Digital Innovation",
      description: "Fosters digital innovation through cutting-edge technology exploration, encouraging students and faculty to develop innovative digital solutions for real-world challenges.",
      link: "https://christuniversity.in/center/C/CDI",
      image: "https://christuniversity.in/uploads/centers/thumb/757176875_2023-06-16_09-14-38.jpg",
    },
    {
      id: 9,
      title: "CEAS",
      subtitle: "Centre for East Asian Studies",
      description: "Promotes understanding of East Asian cultures, languages, and societies through academic programs, cultural exchanges, and research collaborations with East Asian institutions.",
      link: "https://ceas.christuniversity.in/",
      image: "https://christuniversity.in/uploads/centers/thumb/845100346_2023-06-16_09-06-11.jpg",
    },
    {
      id: 10,
      title: "CEDBEC",
      subtitle: "Centre for Education Beyond Curriculum",
      description: "Enhances student learning beyond traditional curriculum through workshops, seminars, and experiential learning opportunities that develop critical thinking and practical skills.",
      link: "https://christuniversity.in/center/C/CEDBEC",
      image: "https://christuniversity.in/uploads/centers/thumb/1448228427_2023-06-16_08-46-12.jpg",
    },
    {
      id: 11,
      title: "CEDRIC",
      subtitle: "Centre for Establishing, Developing, and Research in Incubation Centres",
      description: "Supports entrepreneurial initiatives by providing resources, mentorship, and infrastructure for startups, fostering innovation and business development within the university ecosystem.",
      link: "https://christuniversity.in/center/C/cedric",
      image: "https://christuniversity.in/uploads/centers/thumb/304659937_2023-06-16_06-57-01.jpg",
    },
    {
      id: 12,
      title: "CFPR",
      subtitle: "Centre for Fiscal Policy Research",
      description: "Conducts research on fiscal policies and economic trends, providing insights and recommendations for policymakers, academics, and the public on financial and economic issues.",
      link: "https://christuniversity.in/center/C/cfpr",
      image: "https://christuniversity.in/uploads/centers/thumb/1042458721_2023-06-16_06-43-44.jpg",
    },
    {
      id: 13,
      title: "CIS",
      subtitle: "Centre for International Studies",
      description: "Promotes global engagement through international academic collaborations, exchange programs, and research partnerships, enhancing the university's global presence and perspective.",
      link: "https://christuniversity.in/center/C/CIS",
      image: "https://christuniversity.in/uploads/centers/thumb/2130509750_2023-06-16_06-20-01.jpg",
    },
    {
      id: 14,
      title: "CLGT",
      subtitle: "Centre for Leadership and Governance Transformation",
      description: "Develops effective leadership skills and governance practices through training programs, workshops, and research aimed at transforming individuals into responsible leaders.",
      link: "https://christuniversity.in/center/C/CLGT",
      image: "https://christuniversity.in/uploads/centers/thumb/1758958172_2023-06-16_05-41-48.jpg",
    },
    {
      id: 15,
      title: "CMTP",
      subtitle: "Centre for Modern Technologies and Practices",
      description: "Explores and integrates modern technologies and innovative practices into academic and administrative processes, enhancing efficiency and effectiveness across the university.",
      link: "https://christuniversity.in/center/C/centre-for-modern-technologies-and-practices-cmtp",
      image: "https://christuniversity.in/uploads/centers/thumb/798694573_2023-06-16_05-27-37.jpg",
    },
    {
      id: 16,
      title: "CMRP",
      subtitle: "Centre for Management Research and Projects",
      description: "Facilitates management research and project-based learning, connecting academic knowledge with real-world management practices and business challenges.",
      link: "https://christuniversity.in/center/C/cmrp",
      image: "https://christuniversity.in/uploads/centers/thumb/1555158781_2023-06-16_05-16-57.jpg",
    },
    {
      id: 17,
      title: "CPE",
      subtitle: "Centre for Professional Excellence",
      description: "Enhances professional competencies through specialized training programs, industry collaborations, and skill development initiatives that prepare students for successful careers.",
      link: "https://christuniversity.in/center/C/CPE",
      image: "https://christuniversity.in/uploads/centers/thumb/2086186414_2023-06-16_05-04-48.jpg",
    },
    {
      id: 18,
      title: "CPFA",
      subtitle: "Centre for Professional Fine Arts",
      description: "Nurtures artistic talents and creative expression through fine arts programs, exhibitions, and workshops that develop aesthetic sensibilities and professional artistic skills.",
      link: "https://christuniversity.in/center/C/cpfa",
      image: "https://christuniversity.in/uploads/centers/thumb/1576222968_2023-06-16_04-45-23.jpg",
    },
    {
      id: 19,
      title: "CPSA",
      subtitle: "Centre for Professional Skills and Activities",
      description: "Focuses on developing essential professional skills through practical training, activities, and workshops that enhance employability and workplace readiness.",
      link: "https://christuniversity.in/center/C/cpsa",
      image: "https://christuniversity.in/uploads/centers/thumb/1822230593_2023-06-16_04-25-28.jpg",
    },
    {
      id: 20,
      title: "CRCDC",
      subtitle: "Centre for Resource & Curriculum Development for Communication",
      description: "Develops innovative curriculum and resources for communication studies, enhancing teaching methodologies and learning materials for effective communication education.",
      link: "https://christuniversity.in/center/C/centre-for-resource-curriculum-development-for-communication-crcdc",
      image: "https://christuniversity.in/uploads/centers/thumb/1831788784_2023-06-16_04-09-24.jpg",
    },
    {
      id: 21,
      title: "CRSL",
      subtitle: "Centre for Research in Social Innovation and Leadership",
      description: "Promotes research and initiatives focused on social innovation and leadership development, addressing societal challenges through innovative leadership approaches.",
      link: "https://christuniversity.in/center/C/crsl",
      image: "https://christuniversity.in/uploads/centers/thumb/806621914_2023-06-16_03-51-33.jpg",
    },
    {
      id: 22,
      title: "CSA",
      subtitle: "Centre for Social Action",
      description: "Engages in community service and social responsibility initiatives, encouraging students to contribute to society through various outreach programs and volunteer activities.",
      link: "https://christuniversity.in/center/C/CSA",
      image: "https://christuniversity.in/uploads/centers/thumb/91103435_2023-06-16_03-32-05.jpg",
    },
    {
      id: 23,
      title: "CSED",
      subtitle: "Centre for Software Engineering and Development",
      description: "Focuses on software engineering principles and practices, developing innovative software solutions and providing expertise in software development methodologies.",
      link: "https://christuniversity.in/center/C/csed",
      image: "https://christuniversity.in/uploads/centers/thumb/1193308951_2023-06-16_03-15-35.jpg",
    },
    {
      id: 24,
      title: "CTIT",
      subtitle: "Centre for Technology in Teaching and Testing",
      description: "Integrates technology into teaching and assessment processes, enhancing educational delivery through innovative technological tools and digital assessment methods.",
      link: "https://ctit.christuniversity.in/",
      image: "https://christuniversity.in/uploads/centers/thumb/685376776_2023-06-16_02-48-47.jpg",
    },
    {
      id: 25,
      title: "CTIL",
      subtitle: "Centre for Technology Innovation Lab",
      description: "Provides a platform for technological innovation and experimentation, encouraging students to develop new technologies and solutions for various applications.",
      link: "https://christuniversity.in/center/C/CTIL",
      image: "https://christuniversity.in/uploads/centers/thumb/696573225_2023-06-16_02-26-04.jpg",
    },
    {
      id: 26,
      title: "CTMS",
      subtitle: "Centre for Test Management and Standardization",
      description: "Ensures quality and standardization in testing and assessment methodologies, developing reliable evaluation systems for measuring student learning outcomes.",
      link: "https://christuniversity.in/center/C/CTMS",
      image: "https://christuniversity.in/uploads/centers/thumb/589231854_2023-06-16_02-07-49.jpg",
    },
    {
      id: 27,
      title: "CWE",
      subtitle: "Centre for Wellness Education",
      description: "Promotes holistic well-being through wellness education programs, activities, and initiatives that address physical, mental, and emotional health of the university community.",
      link: "https://christuniversity.in/center/C/CWE",
      image: "https://christuniversity.in/uploads/centers/thumb/1395560400_2023-06-16_01-28-49.jpg",
    },
    {
      id: 28,
      title: "VWCN",
      subtitle: "V-Window for Cultural Navigation",
      description: "Facilitates cultural exchange and understanding through events, exhibitions, and programs that showcase diverse cultural expressions and promote cross-cultural appreciation.",
      link: "https://christuniversity.in/center/C/V-Window-for-Cultural-Navigation-VWCN",
      image: "https://christuniversity.in/uploads/centers/thumb/196411319_2023-06-16_01-04-38.jpg",
    },
    {
      id: 29,
      title: "SDG Cell",
      subtitle: "Sustainable Development Goal Cell",
      description: "Committed to integrating UN Sustainable Development Goals into the university's framework through research, education, and community engagement initiatives.",
      link: "https://christuniversity.in/center/C/sdg-cell",
      image: "https://christuniversity.in/uploads/centers/thumb/451919318_2023-06-16_12-59-01.jpg",
    },
    {
      id: 30,
      title: "TLEC",
      subtitle: "Teaching Learning Evaluation Centre",
      description: "Focuses on enhancing teaching methodologies, learning experiences, and evaluation processes through research, workshops, and faculty development programs.",
      link: "https://christuniversity.in/center/C/teaching-learning-evaluation-centre-tlec",
      image: "https://christuniversity.in/uploads/centers/thumb/2041802744_2023-06-16_12-29-04.jpg",
    }
  ];

  const activeFilter =
    filterOptions.find((filter) => filter.active)?.name || "All";

  const filteredCentres =
    activeFilter === "All"
      ? allCentres
      : allCentres.filter((centre) => {
          if (activeFilter === "Research") {
            return ["CNRI", "CAI", "CARD", "CRSL", "CFPR", "CMRP"].includes(centre.title);
          } else if (activeFilter === "Academic") {
            return ["CAPS", "CEDRIC", "TLEC", "CEDBEC", "CPE", "CRCDC", "CTIT", "CTMS"].includes(centre.title);
          } else if (activeFilter === "Cultural") {
            return ["CCD", "VWCN", "CPFA", "CEAS", "CIS"].includes(centre.title);
          } else if (activeFilter === "Student support") {
            return ["CCHS", "CAPS", "CWE", "CSA", "CPSA"].includes(centre.title);
          } else if (activeFilter === "Innovation") {
            return ["CAI", "CCD", "SDG Cell", "CDI", "CTIL", "CSED", "CMTP"].includes(centre.title);
          } else if (activeFilter === "Social") {
            return ["CSA", "SDG Cell", "CRSL", "CWE"].includes(centre.title);
          } else if (activeFilter === "Leadership") {
            return ["CLGT", "CRSL", "CPE", "CEDRIC"].includes(centre.title);
          } else if (activeFilter === "Sports") {
            return ["CWE", "CPSA"].includes(centre.title);
          }
          return false;
        });

  const handleFilterClick = (clickedFilter: string) => {
    setFilterOptions(
      filterOptions.map((filter) => ({
        ...filter,
        active: filter.name === clickedFilter,
      }))
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-12">
          <div className="flex flex-row items-center justify-between">
            <h1 className="text-3xl font-black text-[#154CB3] mb-2 mt-6">
              Explore centres & cells
            </h1>
            <Link
              href="/Discover"
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
              Back to Discovery
            </Link>
          </div>
          <p className="text-gray-500 mb-6 text-sm sm:text-base">
            Browse through all 30 specialized centres and cells at Christ University that enhance academic excellence, 
            research, innovation, and student development.
          </p>
          <div className="flex flex-wrap gap-2 mb-6 sm:mb-8">
            {filterOptions.map((filter, index) => (
              <button
                key={index}
                onClick={() => handleFilterClick(filter.name)}
                className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs sm:text-sm font-medium transition-all cursor-pointer touch-manipulation ${
                  filter.active
                    ? "bg-[#154CB3] text-white"
                    : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                }`}
              >
                {filter.name}
              </button>
            ))}
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-4 sm:mb-6">
              {`${activeFilter === "All" ? "All" : activeFilter} centres (${filteredCentres.length})`}
            </h2>

            {filteredCentres.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 lg:gap-12">
                {filteredCentres.map((centre) => (
                  <CentreClubCard
                    key={centre.id}
                    title={centre.title}
                    subtitle={centre.subtitle}
                    description={centre.description}
                    link={centre.link}
                    image={centre.image}
                    type="center"
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 sm:py-12">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="mx-auto h-12 w-12 text-gray-400" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-lg sm:text-xl font-bold text-gray-700 mb-2">
                  No centres found
                </h3>
                <p className="text-gray-500 text-sm sm:text-base">
                  Try adjusting your filters to find more centres, or explore a different category.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default CentresPage;
