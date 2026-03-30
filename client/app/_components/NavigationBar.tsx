"use client";

import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";
import { NotificationSystem } from "./NotificationSystem";
import TermsConsentModal from "./TermsConsentModal";
import { useState, useEffect, useCallback, memo } from "react";
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
      { name: "Centres & Cells", href: "/clubs" }
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
  const sessionDisplayName =
    session?.user?.user_metadata?.full_name ||
    session?.user?.user_metadata?.name ||
    session?.user?.email?.split("@")[0] ||
    "User";
  const displayName = userData?.name || sessionDisplayName;
  const displayAvatar = userData?.avatar_url || session?.user?.user_metadata?.avatar_url || null;
  const avatarInitial = (displayName || "U").charAt(0).toUpperCase();

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
      <nav className="w-full flex flex-wrap md:flex-nowrap items-center pt-6 pb-4 md:pt-8 md:pb-7 px-4 md:px-8 lg:px-12 text-[#154CB3] select-none relative gap-3 md:gap-4">
        {/* Logo */}
        <div className="flex-shrink-0">
          <Link href={session ? "/Discover" : "/"}>
            <Image
              src={Logo}
              alt="Logo"
              width={100}
              height={100}
              className="cursor-pointer z-20 relative"
            />
          </Link>
        </div>

        {/* Desktop Navigation Links - Centered */}
       {/* hides stuff for smaller screens and centers on larger screens, also adds dropdowns */ }
       <div className="hidden md:flex flex-1 justify-center mx-4 lg:mx-8 min-w-0">
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
<div className="flex items-center gap-2 lg:gap-3 flex-shrink-0 min-w-0 w-full md:w-auto justify-end">
            {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="hidden sm:flex">
            <div className="relative">
   <input
  type="text"
  placeholder="Search events..."
  value={searchQuery}
  onChange={(e) => setSearchQuery(e.target.value)}
  // CHANGED FOR EACH DEVICE
  className="w-32 md:w-36 lg:w-48 xl:w-64 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-[#154CB3] focus:ring-1 focus:ring-[#154CB3] transition-all duration-200"
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

          {/* Auth Buttons */}
          <div className="flex gap-2 sm:gap-3 items-center flex-wrap justify-end">
            {isLoading && !session ? (
              <div className="flex items-center gap-2">
                <div className="h-9 w-20 rounded-full bg-gray-200 animate-pulse" />
                <div className="h-9 w-24 rounded-full bg-gray-200 animate-pulse" />
              </div>
            ) : session ? (
              userData && (userData.is_organiser || (userData as any).is_masteradmin) ? (
                <div className="flex gap-2 sm:gap-4 items-center flex-wrap justify-end">
                  <NotificationSystem />
                  {(userData as any).is_masteradmin && (
                    <Link href="/masteradmin">
                      <button className="cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 rounded-full text-xs sm:text-sm hover:bg-red-50 border-red-600 text-red-600 transition-all duration-200 ease-in-out">
                        Admin Panel
                      </button>
                    </Link>
                  )}
                  {userData.is_organiser && (
                    <Link href="/manage">
                      <button className="cursor-pointer font-semibold px-3 py-1.5 sm:px-4 sm:py-2 border-2 rounded-full text-xs sm:text-sm hover:bg-[#f3f3f3] transition-all duration-200 ease-in-out">
                        Manage events
                      </button>
                    </Link>
                  )}
                  {/* CHANGED ORGANISED AND ADMIN BUTTON */}
                  <Link href="/profile">
  <div className="flex items-center gap-2 lg:gap-4 min-w-0">
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
              ) : (
                <div className="flex gap-2 sm:gap-4 items-center flex-wrap justify-end">
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
      <div className="md:hidden px-4 pb-4 space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {navigationLinks.map((link) => (
            <Link
              key={`mobile-${link.name}`}
              href={link.href}
              className="whitespace-nowrap rounded-full border border-[#154CB3]/20 bg-white px-3 py-1.5 text-sm font-medium text-[#154CB3] hover:bg-[#154CB3]/5"
            >
              {link.name}
            </Link>
          ))}
          <Link
            href="/events"
            className="whitespace-nowrap rounded-full border border-[#154CB3]/20 bg-white px-3 py-1.5 text-sm font-medium text-[#154CB3] hover:bg-[#154CB3]/5"
          >
            Events
          </Link>
          <Link
            href="/fests"
            className="whitespace-nowrap rounded-full border border-[#154CB3]/20 bg-white px-3 py-1.5 text-sm font-medium text-[#154CB3] hover:bg-[#154CB3]/5"
          >
            Fests
          </Link>
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
