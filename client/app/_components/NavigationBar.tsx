"use client";

import Link from "next/link";
import Image from "next/image";
import Logo from "@/app/logo.svg";
import { useAuth } from "@/context/AuthContext";
import { NotificationSystem } from "./NotificationSystem";
import { useState, useMemo, useCallback, memo } from "react";
import TermsConsentModal from "./TermsConsentModal";
import { useTermsConsent } from "@/context/TermsConsentContext";
import { createBrowserClient } from "@supabase/ssr";

// OPTIMIZATION: Move static data outside component to prevent recreation on every render
const navigationLinks = [
  {
    name: "Home",
    href: "/",
    dropdown: [
      { name: "Dashboard", href: "/" },
      { name: "Featured Events", href: "/#featured" },
      { name: "Announcements", href: "/#announcements" }
    ]
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
    name: "Solutions",
    href: "/solutions",
    dropdown: [
      { name: "Our Solutions", href: "/solutions" },
      { name: "Pricing", href: "/pricing" }
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
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const { hasConsented, setHasConsented, checkConsentStatus } = useTermsConsent();

  // OPTIMIZATION: Memoize callbacks to prevent recreation on every render
  const handleSignIn = useCallback(async (isSignUpButton = false) => {
    setIsSignUp(isSignUpButton);
    
    if (isSignUpButton && !checkConsentStatus()) {
      setShowTermsModal(true);
      return;
    }
    
    await signInWithGoogle();
  }, [checkConsentStatus, signInWithGoogle]);

  const handleSignOut = useCallback(async () => {
    await signOut();
  }, [signOut]);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      window.location.href = `/Discover?search=${encodeURIComponent(searchQuery.trim())}`;
    }
  }, [searchQuery]);

  const handleDropdownHover = useCallback((linkName: string | null) => {
    setActiveDropdown(linkName);
  }, []);

  // OPTIMIZATION: Memoize loading state JSX
  const loadingView = useMemo(() => (
    <>
      <nav className="w-full flex justify-between items-center pt-8 pb-7 px-12 text-[#154CB3] select-none">
        <div className="h-10 w-24"></div>
        <div className="h-10 w-24"></div>
      </nav>
      <hr className="border-[#3030304b]" />
    </>
  ), []);

  if (isLoading) {
    return loadingView;
  }

  const handleTermsAccept = async () => {
    setHasConsented(true);
    setShowTermsModal(false);
    
    // After accepting terms, trigger the sign in
    await signInWithGoogle();
  };
  
  const handleTermsDecline = () => {
    setShowTermsModal(false);
    // Reset isSignUp state
    setIsSignUp(false);
  };

  return (
    <>
      {showTermsModal && (
        <TermsConsentModal 
          onAccept={handleTermsAccept}
          onDecline={handleTermsDecline}
        />
      )}
      <nav className="w-full flex items-center pt-8 pb-7 px-6 md:px-12 text-[#154CB3] select-none relative">
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
        <div className="flex flex-1 justify-center mx-8">
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
                {activeDropdown === link.name && (
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
        <div className="flex items-center gap-3 flex-shrink-0">
          {/* Search Bar */}
          <form onSubmit={handleSearchSubmit} className="flex">
            <div className="relative">
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-48 xl:w-64 px-4 py-2 text-sm border border-gray-300 rounded-full focus:outline-none focus:border-[#154CB3] focus:ring-1 focus:ring-[#154CB3] transition-all duration-200"
              />
              <button
                type="submit"
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#154CB3] transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </button>
            </div>
          </form>

          {/* Auth Buttons */}
          <div className="flex gap-3 items-center">
            {session && userData ? (
              userData.is_organiser || (userData as any).is_masteradmin ? (
                <div className="flex gap-4 items-center">
                  <NotificationSystem />
                  {(userData as any).is_masteradmin && (
                    <Link href="/masteradmin">
                      <button className="cursor-pointer font-semibold px-4 py-2 border-2 rounded-full text-sm hover:bg-red-50 border-red-600 text-red-600 transition-all duration-200 ease-in-out">
                        Admin Panel
                      </button>
                    </Link>
                  )}
                  {userData.is_organiser && (
                    <Link href="/manage">
                      <button className="cursor-pointer font-semibold px-4 py-2 border-2 rounded-full text-sm hover:bg-[#f3f3f3] transition-all duration-200 ease-in-out">
                        Manage events
                      </button>
                    </Link>
                  )}
                  {userData.course && (
                    <Link href="/profile">
                      <div className="flex items-center gap-4">
                        <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden relative">
                          {userData?.avatar_url ? (
                            <Image
                              src={userData.avatar_url}
                              alt="Profile"
                              fill
                              className="object-cover"
                              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-300 flex items-center justify-center text-white text-sm">
                              {userData?.name
                                ? userData.name.charAt(0).toUpperCase()
                                : "U"}
                            </div>
                          )}
                        </div>
                      </div>
                    </Link>
                  )}
                  {!userData.course && (
                    <button
                      onClick={handleSignOut}
                      className="cursor-pointer font-semibold px-4 py-2 border-2 border-[#d6392b] hover:border-[#d6392b] hover:bg-[#d6392bdd] transition-all duration-200 ease-in-out text-sm rounded-full text-white bg-[#d6392b]"
                    >
                      Log out
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex gap-4 items-center">
                  <NotificationSystem />
                  <Link href="/profile">
                    <div className="flex items-center gap-4">
                      <span className="font-medium">
                        {userData?.name || "User"}
                      </span>
                      <div className="w-8 h-8 rounded-full bg-gray-200 overflow-hidden relative">
                        {userData?.avatar_url ? (
                          <Image
                            src={userData.avatar_url}
                            alt="Profile"
                            fill
                            className="object-cover"
                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-300 flex items-center justify-center text-white text-sm">
                            {userData?.name
                              ? userData.name.charAt(0).toUpperCase()
                              : "U"}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </div>
              )
            ) : (
              <>
                <button
                  onClick={() => handleSignIn(false)}
                  className="cursor-pointer font-semibold px-4 py-2 border-2 rounded-full text-sm hover:bg-[#f3f3f3] transition-all duration-200 ease-in-out"
                >
                  Log in
                </button>
                <button
                  onClick={() => handleSignIn(true)}
                  className="cursor-pointer font-semibold px-4 py-2 border-2 border-[#154CB3] hover:border-[#154cb3df] hover:bg-[#154cb3df] transition-all duration-200 ease-in-out text-sm rounded-full text-white bg-[#154CB3]"
                >
                  Sign up
                </button>
              </>
            )}
          </div>
        </div>
      </nav>
      <hr className="border-[#3030304b]" />
    </>
  );
}

// OPTIMIZATION: Wrap with React.memo to prevent re-renders when props haven't changed
export default memo(NavigationBar);
