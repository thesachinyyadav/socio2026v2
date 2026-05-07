"use client";

import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";
import supabase from "@/lib/supabaseClient";
import { useState, useEffect, useLayoutEffect, useCallback, useRef, memo } from "react";
import { useRouter, usePathname } from "next/navigation";

const NotificationSystem = dynamic(
  () => import("./NotificationSystem").then((mod) => mod.NotificationSystem),
  { ssr: false }
);

const TermsConsentModal = dynamic(() => import("./TermsConsentModal"), {
  ssr: false,
});

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
      { name: "Clubs and Centers", href: "/clubs" }
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

type RoleAction = {
  key: string;
  label: string;
  href: string;
  variant: "admin" | "cfo" | "dean" | "hod" | "accounts" | "organiser" | "student_organiser" | "venue" | "support" | "catering" | "stalls" | "it" | "clubs";
};

function NavigationBar() {
  const { session, userData, isLoading, signInWithGoogle, signOut, isStudentOrganiser, isVolunteer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isEventsPage = pathname === "/events";
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [avatarLoadError, setAvatarLoadError] = useState(false);
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [isDesktopCompact, setIsDesktopCompact] = useState(false);
  const [isDesktopMenuOpen, setIsDesktopMenuOpen] = useState(false);
  const [expandedDesktopSection, setExpandedDesktopSection] = useState<string | null>(null);
  const [expandedDesktopSubSection, setExpandedDesktopSubSection] = useState<string | null>(null);
  const [clubEditorClubs, setClubEditorClubs] = useState<Array<{club_id: string; club_name: string}>>([]);
  const [showClubSelectionModal, setShowClubSelectionModal] = useState(false);
  const [selectedClubId, setSelectedClubId] = useState<string>("");
  const [hasMounted, setHasMounted] = useState(false);
  useEffect(() => {
    setHasMounted(true);
  }, []);
  const navContainerRef = useRef<HTMLElement | null>(null);
  const logoRef = useRef<HTMLDivElement | null>(null);
  const rightControlsRef = useRef<HTMLDivElement | null>(null);
  const desktopNavMeasureRef = useRef<HTMLDivElement | null>(null);
  const roleDropdownRef = useRef<HTMLDivElement | null>(null);
  const profileDropdownRef = useRef<HTMLDivElement | null>(null);
  const dropdownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sessionDisplayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const displayName = userData?.name || sessionDisplayName;
  const displayAvatar = userData?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const avatarInitial = (displayName || "U").charAt(0).toUpperCase();
  const isLocalhost = hasMounted && typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
  const isMasterAdmin = Boolean((userData as any)?.is_masteradmin);
  const canAccessAdmin = isMasterAdmin || isLocalhost;
  const isAccountsOffice = Boolean((userData as any)?.is_accounts_office);
  const isCfo = Boolean((userData as any)?.is_cfo);
  const isDean = Boolean((userData as any)?.is_dean);
  const isHod = Boolean((userData as any)?.is_hod);
  const isOrganiser = Boolean(userData?.is_organiser);
  const isSupport = Boolean(userData?.is_support);
  const isVenueManager = Boolean((userData as any)?.is_venue_manager);
  const isStalls = Boolean((userData as any)?.is_stalls);
  const isItSupport = Boolean((userData as any)?.is_it_support);
  const catersList = (() => {
    const c = (userData as any)?.caters;
    return Array.isArray(c) ? c : c ? [c] : [];
  })();
  const isCaterer = catersList.some((c: any) => c?.is_catering);

  useEffect(() => {
    let isMounted = true;
    const email = String(userData?.email || "").trim().toLowerCase();

    if (!email) {
      setClubEditorClubs([]);
      return;
    }

    const resolveClubEditorDashboard = async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("club_id, club_name, club_editors")
        .order("club_name", { ascending: true });

      if (!isMounted) return;

      if (error) {
        console.error("Failed to resolve club editor dashboard:", error.message);
        setClubEditorClubs([]);
        return;
      }

      const clubs = Array.isArray(data) ? data : [];
      const matchedClubs = clubs.filter((club) => {
        if (isMasterAdmin) return true;
        const editors = Array.isArray((club as any)?.club_editors)
          ? ((club as any).club_editors as unknown[])
          : [];
        return editors.some(
          (editor) => String(editor || "").trim().toLowerCase() === email
        );
      }).map(club => ({ club_id: club.club_id, club_name: club.club_name }));

      setClubEditorClubs(matchedClubs);
      if (matchedClubs.length > 0) {
        setSelectedClubId(String(matchedClubs[0].club_id));
      }
    };

    void resolveClubEditorDashboard();

    return () => {
      isMounted = false;
    };
  }, [userData?.email, isMasterAdmin]);

  const isNavLinkActive = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  };

  const roleActions: RoleAction[] = [];
  if (canAccessAdmin) roleActions.push({ key: "admin", label: "Admin", href: "/masteradmin", variant: "admin" });
  if (isAccountsOffice) roleActions.push({ key: "accounts", label: "Accounts", href: "/accounts", variant: "accounts" });
  if (isCfo) roleActions.push({ key: "cfo", label: "CFO", href: "/cfo", variant: "cfo" });
  if (isDean) roleActions.push({ key: "dean", label: "Dean", href: "/dean", variant: "dean" });
  if (isHod) roleActions.push({ key: "hod", label: "HOD", href: "/hod", variant: "hod" });
  if (isOrganiser) roleActions.push({ key: "organiser", label: "Organiser", href: "/manage", variant: "organiser" });
  if (!isOrganiser && isStudentOrganiser) roleActions.push({ key: "student_organiser", label: "Student Organiser", href: "/manage", variant: "student_organiser" });
  if (isSupport) roleActions.push({ key: "support", label: "Support", href: "/support/inbox", variant: "support" });
  if (isVenueManager) roleActions.push({ key: "venue", label: "Venue", href: "/venue", variant: "venue" });
  if (isCaterer) roleActions.push({ key: "catering", label: "Catering", href: "/catering", variant: "catering" });
  if (isStalls) roleActions.push({ key: "stalls", label: "Stalls", href: "/stalls", variant: "stalls" });
  if (isItSupport) roleActions.push({ key: "it", label: "IT", href: "/it", variant: "it" });
  if (clubEditorClubs.length > 0) roleActions.push({ key: "clubs", label: "Clubs", href: clubEditorClubs.length === 1 ? `/clubeditor/${encodeURIComponent(String(clubEditorClubs[0].club_id))}` : "#clubs-modal", variant: "clubs" });

  const visibleRoleActions = roleActions.length > 2 ? roleActions.slice(0, 1) : roleActions;
  const dashboardDropdownRoles = roleActions.length > 2 ? roleActions.slice(1) : [];
  const showDashboardDropdown = roleActions.length > 2;
  const hasRoleActions = roleActions.length > 0;

  const rolePillMap: Record<RoleAction["variant"], string> = {
    admin:     "border-red-600 text-red-600 hover:bg-red-50",
    cfo:       "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    dean:      "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    hod:       "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    accounts:  "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    organiser:          "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    student_organiser:  "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    venue:              "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    support:   "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    catering:  "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    stalls:    "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    it:        "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
    clubs:     "border-[#154CB3]/45 text-[#154CB3] hover:bg-[#f3f3f3]",
  };

  const roleQuickActionMap: Record<RoleAction["variant"], string> = {
    admin:     "border-red-200 text-red-600 hover:bg-red-50",
    cfo:       "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    dean:      "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    hod:       "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    accounts:  "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    organiser:          "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    student_organiser:  "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    venue:              "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    support:   "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    catering:  "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    stalls:    "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    it:        "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
    clubs:     "border-[#154CB3]/30 text-[#154CB3] hover:bg-[#154CB3]/10",
  };

  const getRolePillClasses = (variant: RoleAction["variant"]) => rolePillMap[variant];
  const getRoleQuickActionClasses = (variant: RoleAction["variant"]) => roleQuickActionMap[variant];

  useEffect(() => {
    setAvatarLoadError(false);
  }, [displayAvatar]);

  // Sync the search input with the URL whenever we land on (or leave) the events page.
  // Uses window.location.search so NavigationBar needs no useSearchParams / Suspense.
  useEffect(() => {
    if (!isEventsPage) {
      setSearchQuery("");
      return;
    }
    const sync = () => {
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get("search") ?? "");
    };
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, [isEventsPage, pathname]);

  const closeDesktopMenu = useCallback(() => {
    setIsDesktopMenuOpen(false);
    setExpandedDesktopSection(null);
    setExpandedDesktopSubSection(null);
    setShowRoleDropdown(false);
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

  // useLayoutEffect so the compact/non-compact decision is applied before the
  // browser paints — prevents the "navbar renders huge then shrinks" flash.
  useLayoutEffect(() => {
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
    const onMouseDown = (event: MouseEvent) => {
      if (!roleDropdownRef.current) {
        return;
      }

      if (!roleDropdownRef.current.contains(event.target as Node)) {
        setShowRoleDropdown(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    const onMouseDown = (event: MouseEvent) => {
      if (!profileDropdownRef.current) {
        return;
      }

      if (!profileDropdownRef.current.contains(event.target as Node)) {
        setShowProfileDropdown(false);
      }
    };

    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => {
    if (!showDashboardDropdown) {
      setShowRoleDropdown(false);
    }
  }, [showDashboardDropdown]);

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
    } finally {
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

  const handleProfileDropdownToggle = useCallback(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 768) {
      return;
    }
    setShowProfileDropdown((prev) => !prev);
  }, []);

  const profileAvatarClasses =
    "w-8 h-8 rounded-full border-2 border-[#154CB3] bg-gray-200 overflow-hidden relative flex-shrink-0";

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSearch = searchQuery.trim();
    const params = new URLSearchParams();

    if (isEventsPage) {
      const activeCategory = new URLSearchParams(window.location.search).get("category");
      if (activeCategory) {
        params.set("category", activeCategory);
      }
    }

    if (trimmedSearch) {
      params.set("search", trimmedSearch);
    }

    const queryString = params.toString();
    router.push(queryString ? `/events?${queryString}` : "/events");
  }, [isEventsPage, searchQuery, router]);

  const handleDropdownHover = useCallback((linkName: string | null) => {
    if (dropdownTimerRef.current) {
      clearTimeout(dropdownTimerRef.current);
      dropdownTimerRef.current = null;
    }
    if (linkName !== null) {
      setActiveDropdown(linkName);
    } else {
      dropdownTimerRef.current = setTimeout(() => {
        setActiveDropdown(null);
      }, 150);
    }
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
                  className="relative inline-flex items-center py-2 px-1 whitespace-nowrap font-medium text-[#063168] transition-colors duration-200 hover:text-[#154cb3df]"
                >
                  <span className="inline-block transition-transform duration-200 group-hover:scale-105">
                    {link.name}
                  </span>
                  <span
                    className={`absolute left-1/2 -bottom-1 h-[2px] w-5 -translate-x-1/2 rounded-full bg-[#154CB3] transition-all duration-300 ease-out ${
                      isNavLinkActive(link.href) ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"
                    }`}
                  />
                </Link>
                
                {/* Dropdown Menu */}
                {activeDropdown === link.name && link.dropdown && (
                  <div className="absolute top-full left-0 pt-1 w-48 z-30">
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg">
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
              hasRoleActions ? (
                <div className="flex gap-2 sm:gap-4 items-center md:flex-nowrap justify-end">
                  {userData && <NotificationSystem />}
                  {!isDesktopCompact && (
                    <div className="flex items-center gap-2">
                      {visibleRoleActions.map((roleAction) => (
                        <Link key={`desktop-role-${roleAction.key}`} href={roleAction.href}
                           onClick={(e) => {
                             if (roleAction.href === "#clubs-modal") {
                               e.preventDefault();
                               setShowClubSelectionModal(true);
                             }
                           }}
                        >
                          <button
                            className={`cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 rounded-full text-xs sm:text-sm transition-all duration-200 ease-in-out ${getRolePillClasses(roleAction.variant)}`}
                          >
                            {roleAction.label}
                          </button>
                        </Link>
                      ))}

                      {showDashboardDropdown && (
                        <div ref={roleDropdownRef} className="relative">
                          <button
                            type="button"
                            onClick={() => setShowRoleDropdown((prev) => !prev)}
                            aria-expanded={showRoleDropdown}
                            aria-label="Open dashboard menu"
                            className="inline-flex items-center gap-1.5 cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 border-[#154CB3] rounded-full text-xs sm:text-sm text-[#154CB3] hover:bg-[#f3f3f3] transition-all duration-200 ease-in-out"
                          >
                            Dashboard
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-200 ${showRoleDropdown ? "rotate-180" : ""}`}
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              aria-hidden="true"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>

                          {showRoleDropdown && (
                            <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-gray-200 rounded-lg shadow-lg z-40 py-1">
                              {dashboardDropdownRoles.map((roleAction) => (
                                <Link
                                  key={`desktop-dashboard-${roleAction.key}`}
                                  href={roleAction.href}
                                  onClick={(e) => {
                                    if (roleAction.href === "#clubs-modal") {
                                      e.preventDefault();
                                      setShowRoleDropdown(false);
                                      setShowClubSelectionModal(true);
                                    } else {
                                      setShowRoleDropdown(false);
                                    }
                                  }}
                                  className={`block px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${getRoleQuickActionClasses(roleAction.variant)}`}
                                >
                                  {roleAction.label}
                                </Link>
                              ))}
                              {isVolunteer && (
                                <Link
                                  href="/volunteer"
                                  onClick={() => setShowRoleDropdown(false)}
                                  className="block px-4 py-2.5 text-sm font-medium text-[#154CB3] hover:bg-gray-50 transition-colors duration-200"
                                >
                                  Volunteer
                                </Link>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* CHANGED ORGANISED AND ADMIN BUTTON */}
                  <div
                    ref={profileDropdownRef}
                    className="relative"
                    onMouseEnter={() => setShowProfileDropdown(true)}
                    onMouseLeave={() => setShowProfileDropdown(false)}
                  >
                    <button
                      type="button"
                      onClick={handleProfileDropdownToggle}
                      aria-expanded={showProfileDropdown}
                      aria-label="Open profile menu"
                      className="flex items-center gap-2 lg:gap-4 min-w-0 cursor-pointer"
                    >
                      <div className={profileAvatarClasses}>
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
                      <div className="absolute right-0 top-full pt-2 z-30">
                        <div className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
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
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 sm:gap-4 items-center md:flex-nowrap justify-end">
                  {userData && <NotificationSystem />}
                  <div
                    ref={profileDropdownRef}
                    className="relative"
                    onMouseEnter={() => setShowProfileDropdown(true)}
                    onMouseLeave={() => setShowProfileDropdown(false)}
                  >
                    <button
                      type="button"
                      onClick={handleProfileDropdownToggle}
                      aria-expanded={showProfileDropdown}
                      aria-label="Open profile menu"
                      className="flex items-center gap-2 lg:gap-4 min-w-0 cursor-pointer"
                    >
                      <span className="hidden lg:block font-medium truncate max-w-[140px]">
                        {displayName}
                      </span>
                      <div className={profileAvatarClasses}>
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
                      <div className="absolute right-0 top-full pt-2 z-30">
                        <div className="w-48 bg-white border border-gray-200 rounded-lg shadow-lg">
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
                      </div>
                    )}
                  </div>
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

            {session && userData && hasRoleActions && (
              <div className="px-4 pb-4 border-t border-gray-200">
                <p className="pt-3 px-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Quick actions
                </p>

                <div className="mt-2 space-y-2">
                  {roleActions.map((roleAction) => (
                    <Link
                      key={`drawer-role-${roleAction.key}`}
                      href={roleAction.href}
                      onClick={(e) => {
                        if (roleAction.href === "#clubs-modal") {
                          e.preventDefault();
                          closeDesktopMenu();
                          setShowClubSelectionModal(true);
                        } else {
                          closeDesktopMenu();
                        }
                      }}
                      className={`block rounded-lg border px-3 py-2 text-sm font-semibold transition-colors duration-200 ${getRoleQuickActionClasses(roleAction.variant)}`}
                    >
                      {roleAction.label}
                    </Link>
                  ))}
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

            {roleActions.map((roleAction) => (
              <Link
                key={`mobile-role-${roleAction.key}`}
                href={roleAction.href}
                onClick={(e) => {
                  if (roleAction.href === "#clubs-modal") {
                    e.preventDefault();
                    setShowClubSelectionModal(true);
                  }
                }}
                className={`inline-flex items-center justify-center rounded-full border bg-white px-3 py-2 text-sm font-semibold transition-colors duration-200 ${getRoleQuickActionClasses(roleAction.variant)}`}
              >
                {roleAction.label}
              </Link>
            ))}
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
      {showClubSelectionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 border border-gray-100">
            <h3 className="text-xl font-bold text-[#154CB3] mb-2">Select Club</h3>
            <p className="text-sm text-gray-500 mb-6">Choose which club dashboard you want to access.</p>
            
            <div className="space-y-4">
              <div className="w-full">
                <label htmlFor="club-select" className="sr-only">Select Club</label>
                <select
                  id="club-select"
                  value={selectedClubId}
                  onChange={(e) => setSelectedClubId(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent text-gray-700 transition-all duration-200"
                >
                  {clubEditorClubs.map((club) => (
                    <option key={club.club_id} value={club.club_id}>
                      {club.club_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 justify-end mt-6">
                <button
                  onClick={() => setShowClubSelectionModal(false)}
                  className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors duration-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowClubSelectionModal(false);
                    router.push(`/clubeditor/${encodeURIComponent(selectedClubId)}`);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-[#154CB3] hover:bg-[#0d3a8a] rounded-lg shadow-sm transition-all duration-200 cursor-pointer"
                >
                  Continue
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// OPTIMIZATION: Wrap with React.memo to prevent re-renders when props haven't changed
export default memo(NavigationBar);
