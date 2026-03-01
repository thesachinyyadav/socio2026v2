"use client";

import React, { useState } from "react";
import Link from "next/link";

import { CentreClubCard } from "../_components/Discover/ClubCard";
import Footer from "../_components/Home/Footer";
import { allCentres, Centre } from "../lib/centresData";

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

  const activeFilter =
    filterOptions.find((filter) => filter.active)?.name || "All";

  const filteredCentres =
    activeFilter === "All"
      ? allCentres
      : allCentres.filter((centre) => centre.category === activeFilter);

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
                    link={centre.externalLink}
                    slug={centre.slug}
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
