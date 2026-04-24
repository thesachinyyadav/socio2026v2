"use client";

import React, { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

import { CentreClubCard } from "../_components/Discover/ClubCard";
import Footer from "../_components/Home/Footer";
import { ClubRecord } from "@/app/actions/clubs";
import supabase from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

type OrganizationTypeFilter = "all" | "club" | "centre" | "cell";

const safeText = (value: unknown, fallback = ""): string => {
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const normalizeCategory = (category: unknown) => safeText(category).trim().toLowerCase();
const TYPE_FILTERS: { label: string; value: OrganizationTypeFilter }[] = [
  { label: "All", value: "all" },
  { label: "Clubs", value: "club" },
  { label: "Centres", value: "centre" },
  { label: "Cells", value: "cell" },
];
const CATEGORY_FILTERS = [
  "Academic",
  "Cultural",
  "Innovation",
  "Leadership",
  "Research",
  "Social",
  "Sports",
  "Student support",
];
const INITIAL_VISIBLE_CARDS = 12;
const LOAD_MORE_STEP = 12;

const normalizeTypeFilter = (typeParam: string | null): OrganizationTypeFilter => {
  if (typeParam === "club" || typeParam === "centre" || typeParam === "cell") {
    return typeParam;
  }
  return "all";
};

const buildCentresUrl = (
  typeFilter: OrganizationTypeFilter,
  category: string | null,
  searchValue: string
) => {
  const params = new URLSearchParams();
  if (typeFilter !== "all") {
    params.set("type", typeFilter);
  }
  if (category && normalizeCategory(category) !== "all") {
    params.set("category", category);
  }

  const normalizedSearch = searchValue.trim();
  if (normalizedSearch) {
    params.set("search", normalizedSearch);
  }

  const queryString = params.toString();
  return queryString ? `/clubs?${queryString}` : "/clubs";
};

const CentresPageContent = () => {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { userData, session } = useAuth();
  const selectedTypeFilter = normalizeTypeFilter(searchParams.get("type"));
  const categoryParam = searchParams.get("category");
  const selectedCategoryFilter = categoryParam?.trim() ? categoryParam.trim() : "All";
  const searchParam = searchParams.get("search") || "";

  const [searchQuery, setSearchQuery] = useState(searchParam);
  const [allCentres, setAllCentres] = useState<ClubRecord[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_CARDS);

  useEffect(() => {
    let isMounted = true;

    setLoadError(null);
    setDataLoading(true);

    const fetchOrganizations = async () => {
      try {
        const { data, error } = await supabase
          .from("clubs")
          .select(
            "club_id,club_name,subtitle,club_description,club_web_link,slug,club_banner_url,type,category,club_editors"
          )
          .order("club_name", { ascending: true });

        if (!isMounted) return;
        if (error) {
          throw new Error(error.message);
        }

        const organizations = (data ?? []) as ClubRecord[];
        setAllCentres(organizations);
      } catch (error) {
        if (!isMounted) return;
        setAllCentres([]);
        setLoadError(error instanceof Error ? error.message : "Failed to load organizations.");
      } finally {
        if (!isMounted) return;
        setDataLoading(false);
      }
    };

    void fetchOrganizations();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSearchQuery(searchParam);
  }, [searchParam]);

  // Keep URL in sync with page-level centres search input.
  useEffect(() => {
    const normalizedSearch = searchQuery.trim();
    const normalizedParamSearch = searchParam.trim();

    if (normalizedSearch === normalizedParamSearch) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      router.replace(
        buildCentresUrl(selectedTypeFilter, selectedCategoryFilter, normalizedSearch),
        {
        scroll: false,
        }
      );
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [router, searchParam, searchQuery, selectedCategoryFilter, selectedTypeFilter]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_CARDS);
  }, [selectedTypeFilter, selectedCategoryFilter, searchQuery]);

  const selectedTypeLabel =
    TYPE_FILTERS.find((filter) => filter.value === selectedTypeFilter)?.label ?? "All";
  const categoriesForSelectedType = useMemo(
    () =>
      Array.from(
        new Set(
          allCentres
            .filter(
              (centre) => selectedTypeFilter === "all" || centre.type === selectedTypeFilter
            )
            .map((centre) => centre.category?.trim())
            .filter((category): category is string => Boolean(category))
        )
      ),
    [allCentres, selectedTypeFilter]
  );

  const extraCategories = useMemo(
    () =>
      categoriesForSelectedType.filter(
        (category) =>
          !CATEGORY_FILTERS.some(
            (predefinedCategory) =>
              normalizeCategory(predefinedCategory) === normalizeCategory(category)
          )
      ),
    [categoriesForSelectedType]
  );

  const categoryOptions = useMemo(
    () => ["All", ...CATEGORY_FILTERS, ...extraCategories],
    [extraCategories]
  );

  const filteredCentres = useMemo(
    () =>
      allCentres.filter((centre: ClubRecord) => {
        if (selectedTypeFilter !== "all" && centre.type !== selectedTypeFilter) {
          return false;
        }

        if (
          normalizeCategory(selectedCategoryFilter) !== "all" &&
          normalizeCategory(centre.category ?? "") !== normalizeCategory(selectedCategoryFilter)
        ) {
          return false;
        }

        if (searchQuery.trim()) {
          const q = normalizeCategory(searchQuery.trim());
          const titleMatch = normalizeCategory(centre.club_name).includes(q);
          const subtitleMatch = normalizeCategory(centre.subtitle).includes(q);
          const descriptionMatch = normalizeCategory(centre.club_description).includes(q);
          const categoryMatch = normalizeCategory(centre.category).includes(q);

          if (!titleMatch && !subtitleMatch && !descriptionMatch && !categoryMatch) {
            return false;
          }
        }

        return true;
      }),
    [allCentres, searchQuery, selectedCategoryFilter, selectedTypeFilter]
  );

  const visibleCentres = useMemo(
    () => filteredCentres.slice(0, visibleCount),
    [filteredCentres, visibleCount]
  );
  const hasMoreCentres = visibleCount < filteredCentres.length;

  const currentEmail = String(
    userData?.email || session?.user?.email || ""
  )
    .trim()
    .toLowerCase();
  const isMasterAdmin = Boolean(userData?.is_masteradmin);
  const canEditOrganization = (centre: ClubRecord) => {
    if (isMasterAdmin) return true;
    if (!currentEmail) return false;
    const editors = Array.isArray(centre.club_editors) ? centre.club_editors : [];
    return editors.some(
      (editor) => String(editor || "").trim().toLowerCase() === currentEmail
    );
  };

  const handleTypeFilterChange = (typeFilter: OrganizationTypeFilter) => {
    router.replace(buildCentresUrl(typeFilter, "All", searchQuery), {
      scroll: false,
    });
  };

  const handleCategoryFilterClick = (category: string) => {
    router.replace(buildCentresUrl(selectedTypeFilter, category, searchQuery), {
      scroll: false,
    });
  };

  const handlePageSearchSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    router.push(buildCentresUrl(selectedTypeFilter, selectedCategoryFilter, searchQuery), {
      scroll: false,
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <main className="container mx-auto px-4 pt-8 pb-8 sm:pt-10 sm:pb-10 max-w-7xl">
        <div className="mb-6 sm:mb-8">
          <div className="flex flex-row items-start justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="min-w-0">
              <h1 className="text-2xl sm:text-3xl font-black text-[#154CB3] leading-tight">
                Explore centres, cells & clubs
              </h1>
              <p className="text-gray-500 mt-1 text-sm sm:text-base">
                Browse all centres, cells, and clubs at Christ University that support academic excellence, research, innovation, and student development.
              </p>
            </div>
            <Link
              href="/Discover"
              className="mt-1 flex items-center text-[#063168] hover:underline cursor-pointer text-xs sm:text-base shrink-0"
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

          <div className="mb-5 sm:mb-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-3 sm:gap-4">
              <form onSubmit={handlePageSearchSubmit} className="order-1 w-full lg:flex-1 lg:max-w-[560px]">
                <label htmlFor="clubs-page-search" className="sr-only">
                  Search centres, cells, and clubs
                </label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      id="clubs-page-search"
                      type="text"
                      placeholder="Search by name, category, subtitle, or description"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full border border-gray-300 px-4 py-2.5 pr-20 text-sm sm:text-base focus:outline-none focus:ring-1 focus:ring-[#154CB3] focus:border-[#154CB3]"
                    />
                    {searchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full px-2 py-1 text-xs font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 cursor-pointer"
                      >
                        Clear
                      </button>
                    ) : (
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          className="h-4 w-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m21 21-4.35-4.35m1.6-5.15a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z"
                          />
                        </svg>
                      </span>
                    )}
                  </div>
                  <button
                    type="submit"
                    className="shrink-0 rounded-full bg-[#154CB3] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#0f3f95] transition-colors cursor-pointer"
                  >
                    Search
                  </button>
                </div>
              </form>

              <div className="order-2 w-full lg:w-[220px] lg:shrink-0">
                <label
                  htmlFor="clubs-type-filter"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#4f6482]"
                >
                  Type filter
                </label>
                <select
                  id="clubs-type-filter"
                  value={selectedTypeFilter}
                  onChange={(e) =>
                    handleTypeFilterChange(e.target.value as OrganizationTypeFilter)
                  }
                  className="h-11 w-full rounded-xl border border-[#c6d5ee] bg-white px-3 text-sm font-medium text-[#123a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                >
                  {TYPE_FILTERS.map((filter) => (
                    <option key={filter.value} value={filter.value}>
                      {filter.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 sm:gap-3">
              {categoryOptions.map((category) => (
                <button
                  key={category}
                  onClick={() => handleCategoryFilterClick(category)}
                  className={`px-3.5 py-2 sm:px-4.5 sm:py-2 rounded-full text-sm font-medium transition-all cursor-pointer touch-manipulation ${
                    normalizeCategory(selectedCategoryFilter) === normalizeCategory(category)
                      ? "bg-[#154CB3] text-white"
                      : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-100"
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-3 sm:mb-4">
            {`${selectedTypeLabel}${normalizeCategory(selectedCategoryFilter) !== "all" ? ` • ${selectedCategoryFilter}` : ""} organizations (${filteredCentres.length})`}
          </h2>

          <div>
            {dataLoading ? (
              <div className="min-h-[240px] flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-[#154CB3]"></div>
              </div>
            ) : loadError ? (
              <div className="text-center py-8 sm:py-12">
                <h3 className="mt-2 text-lg sm:text-xl font-bold text-red-700 mb-2">
                  Failed to load organizations
                </h3>
                <p className="text-red-600 text-sm sm:text-base">{loadError}</p>
              </div>
            ) : filteredCentres.length > 0 ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
                  {visibleCentres.map((centre) => (
                    <div key={centre.club_id} className="min-w-0 h-full">
                      <CentreClubCard
                        title={centre.club_name}
                        subtitle={centre.subtitle ?? undefined}
                        description={centre.club_description ?? "No description provided."}
                        link={centre.club_web_link ?? undefined}
                        slug={centre.slug ?? undefined}
                        image={centre.club_banner_url ?? undefined}
                        type={
                          centre.type === "club"
                            ? "club"
                            : centre.type === "cell"
                              ? "cell"
                              : "center"
                        }
                        showEditButton={canEditOrganization(centre)}
                        editHref={`/edit/clubs/${centre.club_id}`}
                      />
                    </div>
                  ))}
                </div>
                {hasMoreCentres && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + LOAD_MORE_STEP)}
                      className="rounded-full border border-[#154CB3] px-5 py-2 text-sm font-semibold text-[#154CB3] transition-colors hover:bg-[#154CB3] hover:text-white"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
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
                  No organizations found
                </h3>
                <p className="text-gray-500 text-sm sm:text-base">
                  Try adjusting your filters to find more organizations, or explore a different category.
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

function CentresPageLoadingFallback() {
  return (
    <div className="min-h-screen bg-white flex justify-center items-center">
      <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-[#154CB3]"></div>
      <p className="ml-4 text-xl text-[#154CB3]">Loading centres...</p>
    </div>
  );
}

export default function CentresPage() {
  return (
    <Suspense fallback={<CentresPageLoadingFallback />}>
      <CentresPageContent />
    </Suspense>
  );
}
