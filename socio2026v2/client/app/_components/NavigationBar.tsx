"use client";

import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";
import { NotificationSystem } from "./NotificationSystem";
import TermsConsentModal from "./TermsConsentModal";
import { useState, useEffect, useCallback, useRef, memo } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

// OPTIMIZATION: Move static data outside component to prevent recreation on every render
const navigationLinks = [
  {
    name: "Home",
    href: "/",
  },
  {
    name: "Discover",
    href: "/Discover",
    dropdown: [
      { name: "All Events", href: "/events" },
      { name: "All Fests", href: "/fests" },
      { name: "Clubs, Centres & Cells", href: "/clubs" }
    ]
  },
  {
    name: "About",
    href: "/about",
    dropdown: [
      { name: "Our Story", href: "/about/story" },
      { name: "Team", href: "/about/team" },
      { name: "Mission", href: "/about/mission" }
    ]
  },
  {
    name: "Contact",
    href: "/contact",
    dropdown: [
      { name: "Get in Touch", href: "/contact" },
      { name: "Support", href: "/support" },
      { name: "FAQ", href: "/faq" }
    ]
  }
];

const discoverNestedLinks: Record<string, Array<{ name: string; href: string }>> = {
  "/events": [
    { name: "Upcoming", href: "/events?category=upcoming" },
    { name: "Popular", href: "/events?category=popular" }
  ],
  "/fests": [
    { name: "Inter-Campus", href: "/fests?category=inter-campus" },
    { name: "Department", href: "/fests?category=department" }
  ],
  "/clubs": [
    { name: "Academic", href: "/clubs?category=academic" },
    { name: "Cultural", href: "/clubs?category=cultural" }
  ]
};

function NavigationBar() {
  const { session, userData, isLoading, signInWithGoogle, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isEventsPage = pathname === "/events";
  const searchParam = searchParams.get("search") || "";
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [isDesktopCompact, setIsDesktopCompact] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [expandedDesktopSection, setExpandedDesktopSection] = useState<string | null>(null);
  const [expandedDesktopSubSection, setExpandedDesktopSubSection] = useState<string | null>(null);
  const navContainerRef = useRef<HTMLElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const rightControlsRef = useRef<HTMLDivElement | null>(null);
  const desktopNavMeasureRef = useRef<HTMLDivElement | null>(null);
  const sessionDisplayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const displayName = userData?.name || sessionDisplayName;
  const displayAvatar = userData?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const avatarInitial = (displayName || "U").charAt(0).toUpperCase();
  const isMasterAdmin = Boolean((userData as any)?.is_masteradmin);
  const isOrganiser = Boolean(userData?.is_organiser);

  useEffect(() => {
    setAvatarLoadError(false);
  }, [displayAvatar]);

  useEffect(() => {
    if (isEventsPage) {
      setSearchQuery(searchParam);
      return;
    }

    setSearchQuery("");
  }, [isEventsPage, searchParam]);

  const closeDesktopMenu = useCallback(() => {
    setIsDesktopMenuOpen(false);
    setExpandedDesktopSection(null);
    setExpandedDesktopSubSection(null);
  }, []);

  const measureDesktopOverlap = useCallback(() => {
    if (!navContainerRef.current || !logoRef.current || !rightControlsRef.current || !desktopNavMeasureRef.current) {
      return;
    }

    const isDesktopViewport = window.innerWidth >= 768;
    if (!isDesktopViewport) {
      setIsDesktopCompact(false);
      closeDesktopMenu();
      return;
    }

    const navWidth = navContainerRef.current.clientWidth;
    const logoWidth = logoRef.current.offsetWidth;
    const rightWidth = rightControlsRef.current.offsetWidth;
    const centerWidth = desktopNavMeasureRef.current.offsetWidth;

    // Use a larger safety gap so compact mode kicks in before visual crowding starts.
    const reservedSpacing = window.innerWidth < 1280 ? 190 : 150;
    const shouldCompact = logoWidth + rightWidth + centerWidth + reservedSpacing > navWidth;

    setIsDesktopCompact(shouldCompact);
    if (!shouldCompact) {
      closeDesktopMenu();
    }
  }, [closeDesktopMenu]);

  useEffect(() => {
    measureDesktopOverlap();

    const onResize = () => measureDesktopOverlap();
    window.addEventListener("resize", onResize);

    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(() => {
        measureDesktopOverlap();
      });

      if (navContainerRef.current) observer.observe(navContainerRef.current);
      if (rightControlsRef.current) observer.observe(rightControlsRef.current);
      if (desktopNavMeasureRef.current) observer.observe(desktopNavMeasureRef.current);

      return () => {
        window.removeEventListener("resize", onResize);
        observer.disconnect();
      };
    }

    return () => {
      window.removeEventListener("resize", onResize);
    };
  }, [measureDesktopOverlap]);

  useEffect(() => {
    closeDesktopMenu();
  }, [pathname, closeDesktopMenu]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeDesktopMenu();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closeDesktopMenu]);

  useEffect(() => {
    if (isDesktopMenuOpen) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }

    document.body.style.overflow = "";
  }, [isDesktopMenuOpen]);
  

  // OPTIMIZATION: Memoize callbacks to prevent recreation on every render
  const handleSignIn = useCallback(async () => {
    setIsSigningIn(true);
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error('Sign in error:', error);
      setIsSigningIn(false);
    }
  }, [signInWithGoogle]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleSignUpClick = useCallback(() => {
    if (!isSigningIn) {
      setShowTermsModal(true);
    }
  }, [isSigningIn]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSearch = searchQuery.trim();
    const params = new URLSearchParams();

    if (isEventsPage) {
      const activeCategory = searchParams.get("category");
      if (activeCategory) {
        params.set("category", activeCategory);
      }
    }

    if (trimmedSearch) {
      params.set("search", trimmedSearch);
    }

    const queryString = params.toString();
    router.push(queryString ? `/events?${queryString}` : "/events");
  }, [isEventsPage, searchParams, searchQuery, router]);

  const handleDropdownHover = useCallback((linkName: string | null) => {
    setActiveDropdown(linkName);
  }, []);

  return (
    <>
 {/* CHANGED FOR EACH DEVICE */}
      <nav ref={navContainerRef} className="w-full flex flex-wrap md:flex-nowrap items-center pt-6 pb-4 md:pt-8 md:pb-7 px-4 md:px-8 lg:px-12 text-[#154CB3] select-none relative gap-3 md:gap-4">
        <div ref={desktopNavMeasureRef} className="hidden md:flex absolute invisible pointer-events-none -z-10">
          <div className="flex space-x-8">
            {navigationLinks.map((link) => (
              <span key={`measure-${link.name}`} className="font-medium py-2 px-1 whitespace-nowrap">
                {link.name}
              </span>
            ))}
          </div>
        </div>
        {/* Left cluster - Logo and Search */}
        <div ref={logoRef} className="flex items-center gap-3 md:gap-4 flex-shrink-0 min-w-0">
          <Link href={session ? "/Discover" : "/"}>
            <Image
              src={Logo}
              alt="Logo"
              width={100}
              height={100}
              className="cursor-pointer z-20 relative"
            />
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex">
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-32 md:w-36 lg:w-48 xl:w-64 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-[#154CB3] focus:ring-1 focus:ring-[#154CB3]"
              />
              <button
                type="submit"
                aria-label="Search events"
                title="Search events"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#154CB3] transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>
        </div>

        {/* Desktop Navigation Links - Centered */}
       {/* hides stuff for smaller screens and centers on larger screens, also adds dropdowns */ }
       <div className={`${isDesktopCompact ? "hidden" : "hidden md:flex"} flex-1 justify-center mx-4 lg:mx-8 min-w-0`}>
          <div className="flex space-x-8">
            {navigationLinks.map((link) => (
              <div
                key={link.name}
                className="relative group"
                onMouseEnter={() => handleDropdownHover(link.name)}
                onMouseLeave={() => handleDropdownHover(null)}
              >
                <Link
                  href={link.href}
                  className="font-medium hover:text-[#154cb3df] transition-colors duration-200 py-2 px-1 whitespace-nowrap"
                >
                  {link.name}
                </Link>
                
                {/* Dropdown Menu */}
                {activeDropdown === link.name && link.dropdown && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                    {link.dropdown.map((item) => (
                      <Link
                        key={item.name}
                        href={item.href}
                        className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#154CB3] transition-colors duration-200 first:rounded-t-lg last:rounded-b-lg"
                      >
                        {item.name}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right side - Search Bar and Auth Buttons */}
<div ref={rightControlsRef} className="md:ml-auto flex items-center gap-2 lg:gap-3 flex-shrink-0 min-w-0 w-full md:w-auto justify-end">
          {isDesktopCompact && (
            <button
              type="button"
              onClick={() => setIsDesktopMenuOpen((prev) => !prev)}
              aria-label="Toggle navigation menu"
              aria-expanded={isDesktopMenuOpen}
              className="hidden md:inline-flex items-center justify-center w-10 h-10 rounded-full border border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          )}

          {/* Auth Buttons */}
          <div className="ml-auto flex gap-2 sm:gap-3 items-center md:flex-nowrap justify-end">
            {isLoading && !session ? (
              <div className="flex items-center gap-2">
                <div className="h-9 w-20 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-9 w-24 rounded-full bg-gray-200 animate-pulse" />
              </div>
            ) : session ? (
              userData && (isOrganiser || isMasterAdmin) ? (
                <div className="flex gap-2 sm:gap-4 items-center md:flex-nowrap justify-end">
                  <NotificationSystem />
                  {!isDesktopCompact && isMasterAdmin && (
                    <Link href="/masteradmin">
                      <button className="cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 rounded-full text-xs sm:text-sm hover:bg-red-50 border-red-600 text-red-600 transition-all duration-200 ease-in-out">
                        Admin
                      </button>
                    </Link>
                  )}
                  {!isDesktopCompact && isOrganiser && (
                    <Link href="/manage">
                      <button className="cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 rounded-full text-xs sm:text-sm hover:bg-[#f3f3f3] transition-all duration-200 ease-in-out">
                        Organiser
                      </button>
                    </Link>
                  )}
                  {/* CHANGED ORGANISED AND ADMIN BUTTON */}
                  <div className="relative">
                    <button
                      onClick={() => setShowProfileDropdown(!showProfileDropdown)}
                      className="flex items-center gap-2 lg:gap-4 min-w-0 cursor-pointer"
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0"> 
                        {displayAvatar && !avatarLoadError ? (
                          <img
                            src={displayAvatar}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={() => setAvatarLoadError(true)}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-white text-sm">
                            {avatarInitial}
                          </div>
                        )}
                      </div>
                    </button>
                    {showProfileDropdown && (
                      <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-30">
                        <Link
                          href="/profile"
                          className="block px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:text-[#154CB3] transition-colors duration-200 first:rounded-t-lg"
                        >
                          View Profile
                        </Link>
                        <button
                          onClick={handleSignOut}
                          className="w-full text-left px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200 last:rounded-b-lg border-t"
                        >
                          Logout
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 sm:gap-4 items-center md:flex-nowrap justify-end">
                  {userData && <NotificationSystem />}
                  <Link href="/profile">
  <div className="flex items-center gap-2 lg:gap-4 min-w-0">
    {/* CHANGED: USERNAME IS HIDDEN ON SMALLER WIDTHS, LONG NAMES DON’T PUSH AVATAR OUTSIDE, AVATAR ALWAYS STAYS VISIBLE */}
    <span className="hidden lg:block font-medium truncate max-w-[140px]">
      {displayName}
    </span>
    <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden relative flex-shrink-0">
                        {displayAvatar && !avatarLoadError ? (
                          <img
                            src={displayAvatar}
                            alt="Profile"
                            className="w-full h-full object-cover"
                            onError={() => setAvatarLoadError(true)}
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-white text-sm">
                            {avatarInitial}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSignIn}
                  disabled={isSigningIn}
                  className="cursor-pointer font-medium px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-[#154CB3] hover:bg-[#154CB3] hover:text-white transition-all duration-200 ease-in-out text-xs sm:text-sm rounded-full text-[#154CB3] bg-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Log in
                </button>
                <button
                  onClick={handleSignUpClick}
                  disabled={isSigningIn}
                  className="cursor-pointer font-semibold px-4 py-1.5 sm:px-5 sm:py-2 border-2 border-[#154CB3] bg-[#154CB3] hover:bg-[#0d3a8a] hover:border-[#0d3a8a] transition-all duration-200 ease-in-out text-xs sm:text-sm rounded-full text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSigningIn ? (
                    <>
                      <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>...</span>
                    </>
                  ) : (
                    "Sign up"
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {isDesktopCompact && isDesktopMenuOpen && (
        <>
          <button
            type="button"
            aria-label="Close navigation overlay"
            onClick={closeDesktopMenu}
            className="hidden md:block fixed inset-0 bg-black/35 backdrop-blur-[1px] z-40"
          />

          <aside
            className="hidden md:flex fixed inset-y-0 right-0 h-full w-[min(360px,94vw)] bg-white border-l border-gray-200 shadow-2xl z-50 flex-col"
            role="dialog"
            aria-label="Desktop navigation menu"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-base font-semibold text-[#154CB3]">Navigation</h2>
              <button
                type="button"
                onClick={closeDesktopMenu}
                aria-label="Close menu"
                className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="px-4 py-3 overflow-y-auto flex-1">
              {navigationLinks.map((link) => {
                const isExpanded = expandedDesktopSection === link.name;

                return (
                  <div key={`desktop-panel-${link.name}`} className="border-b border-gray-100 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        href={link.href}
                        onClick={closeDesktopMenu}
                        className="flex-1 px-3 py-2.5 rounded-lg text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
                      >
                        {link.name}
                      </Link>

                      {link.dropdown && (
                        <button
                          type="button"
                          aria-label={`Toggle ${link.name} submenu`}
                          aria-expanded={isExpanded}
                          onClick={() => {
                            setExpandedDesktopSection((prev) => (prev === link.name ? null : link.name));
                            setExpandedDesktopSubSection(null);
                          }}
                          className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-[#154CB3]/20 text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden="true"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {isExpanded && link.dropdown && (
                      <div className="mt-1 ml-3 space-y-1 border-l border-[#154CB3]/20 pl-3">
                        {link.dropdown.map((item) => {
                          const hasNested = link.name === "Discover" && !!discoverNestedLinks[item.href];
                          const isSubExpanded = expandedDesktopSubSection === item.href;

                          return (
                            <div key={`desktop-sub-${item.name}`}>
                              <div className="flex items-center gap-1">
                                <Link
                                  href={item.href}
                                  onClick={closeDesktopMenu}
                                  className="flex-1 px-2.5 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-[#154CB3] transition-colors duration-200"
                                >
                                  {item.name}
                                </Link>

                                {hasNested && (
                                  <button
                                    type="button"
                                    aria-label={`Toggle ${item.name} nested options`}
                                    aria-expanded={isSubExpanded}
                                    onClick={() => {
                                      setExpandedDesktopSubSection((prev) => (prev === item.href ? null : item.href));
                                    }}
                                    className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#154CB3]/20 text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
                                  >
                                    <svg
                                      className={`w-3.5 h-3.5 transition-transform duration-200 ${isSubExpanded ? "rotate-180" : ""}`}
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                      aria-hidden="true"
                                    >
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                    </svg>
                                  </button>
                                )}
                              </div>

                              {hasNested && isSubExpanded && (
                                <div className="ml-3 mb-1 border-l border-gray-200 pl-2.5 space-y-1">
                                  {discoverNestedLinks[item.href].map((nestedItem) => (
                                    <Link
                                      key={`desktop-nested-${nestedItem.href}`}
                                      href={nestedItem.href}
                                      onClick={closeDesktopMenu}
                                      className="block px-2 py-1.5 rounded text-xs font-medium text-gray-600 hover:bg-gray-100 hover:text-[#154CB3] transition-colors duration-200"
                                    >
                                      {nestedItem.name}
                                    </Link>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {session && userData && (isMasterAdmin || isOrganiser) && (
              <div className="px-4 pb-4 border-t border-gray-200">
                <p className="pt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Quick actions
                </p>

                <div className="mt-2 space-y-2">
                  {isMasterAdmin && (
                    <Link
                      href="/masteradmin"
                      onClick={closeDesktopMenu}
                      className="block rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors duration-200"
                    >
                      Admin
                    </Link>
                  )}

                  {isOrganiser && (
                    <Link
                      href="/manage"
                      onClick={closeDesktopMenu}
                      className="block rounded-lg border border-[#154CB3]/30 px-3 py-2 text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
                    >
                      Organiser
                    </Link>
                  )}
                </div>
              </div>
            )}
          </aside>
        </>
      )}

      <div className="md:hidden px-4 pb-4 space-y-3">
        <div className="rounded-2xl border border-[#154CB3]/15 bg-white/90 shadow-sm p-2.5">
          <div className="grid grid-cols-2 gap-2">
            {navigationLinks.map((link) => (
              <Link
                key={`mobile-${link.name}`}
                href={link.href}
                className="inline-flex items-center justify-center rounded-full border border-[#154CB3]/20 bg-white px-3 py-2 text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}

            <Link
              href="/events"
              className="inline-flex items-center justify-center rounded-full border border-[#154CB3]/20 bg-white px-3 py-2 text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors duration-200"
            >
              Events
            </Link>

            <Link
              href="/fests"
              className="inline-flex items-center justify-center rounded-full border border-[#154CB3]/20 bg-white px-3 py-2 text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/5 transition-colors duration-200"
            >
              Fests
            </Link>

            {isMasterAdmin && (
              <Link
                href="/masteradmin"
                className="inline-flex items-center justify-center rounded-full border border-red-200 bg-white px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 transition-colors duration-200"
              >
                Admin
              </Link>
            )}

            {isOrganiser && (
              <Link
                href="/manage"
                className="inline-flex items-center justify-center rounded-full border border-[#154CB3]/30 bg-white px-3 py-2 text-sm font-semibold text-[#154CB3] hover:bg-[#154CB3]/10 transition-colors duration-200"
              >
                Organiser
              </Link>
            )}
          </div>
        </div>

        <form onSubmit={handleSearchSubmit} className="sm:hidden">
          <div className="relative">
            <input
              type="text"
              placeholder="Search events..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-[#154CB3] focus:ring-1 focus:ring-[#154CB3] transition-all duration-200"
            />
            <button
              type="submit"
              aria-label="Search events"
              title="Search events"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#154CB3] transition-colors duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </button>
          </div>
        </form>
      </div>
      <hr className="border-[#3030304b]" />
      {showTermsModal && (
        <TermsConsentModal
          onAccept={() => {
            setShowTermsModal(false);
            handleSignIn();
          }}
          onDecline={() => setShowTermsModal(false)}
        />
      )}
    </>
  );
}

// OPTIMIZATION: Wrap with React.memo to prevent re-renders when props haven't changed
export default memo(NavigationBar);
