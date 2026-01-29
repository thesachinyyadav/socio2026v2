"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Session, User } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

type UserData = {
  id: number;
  created_at: string;
  name: string;
  register_number: string | null;
  email: string;
  course: string | null;
  department: string | null;
  badges: any;
  campus: string | null;
  is_organiser: boolean;
  is_support: boolean;
  is_masteradmin: boolean;
  organiser_expires_at?: string | null;
  support_expires_at?: string | null;
  masteradmin_expires_at?: string | null;
  avatar_url: string | null;
  organization_type?: 'christ_member' | 'outsider';
  visitor_id?: string | null;
  outsider_name_edit_used?: boolean | null;
};

type AuthContextType = {
  session: Session | null;
  userData: UserData | null;
  isLoading: boolean;
  isSupport: boolean;
  isMasterAdmin: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showOutsiderWarning, setShowOutsiderWarning] = useState(false);
  const [outsiderVisitorId, setOutsiderVisitorId] = useState<string | null>(null);
  
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );
  
  const router = useRouter();

  const getOrganizationType = (email: string | undefined): 'christ_member' | 'outsider' => {
    if (!email) return 'outsider';
    return email.toLowerCase().endsWith('@christuniversity.in') ? 'christ_member' : 'outsider';
  };

  useEffect(() => {
    const checkUserSession = async () => {
      setIsLoading(true);
      try {
        const {
          data: { session: currentSession },
        } = await supabase.auth.getSession();

        if (currentSession) {
          setSession(currentSession);
          // Fetch user data without blocking
          fetchUserData(currentSession.user.email!);
        }
      } catch (error) {
        console.error("Error checking user session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUserSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (event === "SIGNED_IN" && newSession) {
        // Set session immediately - don't block on user data
        setSession(newSession);
        setIsLoading(true);
        
        // Check if user is an outsider
        const orgType = getOrganizationType(newSession.user?.email);
        
        // User creation is now handled in the callback route (server-side)
        // Just fetch the user data - with retry for new users
        let userData = await fetchUserData(newSession.user.email!);
        
        // If user data not found, wait briefly and retry (new user being created)
        if (!userData) {
          await new Promise(resolve => setTimeout(resolve, 500));
          userData = await fetchUserData(newSession.user.email!);
        }
        
        // Show warning for first-time outsiders
        if (orgType === 'outsider' && userData?.visitor_id) {
          setOutsiderVisitorId(userData.visitor_id);
          const hasSeenWarning = localStorage.getItem(`outsider_warning_${newSession.user.id}`);
          if (!hasSeenWarning) {
            setShowOutsiderWarning(true);
            localStorage.setItem(`outsider_warning_${newSession.user.id}`, 'true');
          }
        }
        setIsLoading(false);
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUserData(null);
      } else if (event === "USER_UPDATED" && newSession) {
        setSession(newSession);
        fetchUserData(newSession.user.email!);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, router]);

  const createOrUpdateUser = async (user: User) => {
    if (!user?.email) return;

    try {
      const orgType = getOrganizationType(user.email);
      
      // Extract registration number and name from email/user metadata
      let fullName = user.user_metadata?.full_name || user.user_metadata?.name || "";
      let registerNumber = null;
      let course = null;
      
      // Only process registration number and course for Christ members
      if (orgType === 'christ_member') {
        // Extract course from email domain
        const emailParts = user.email.split("@");
        if (emailParts.length === 2) {
          const domainParts = emailParts[1].split(".");
          if (domainParts.length > 0) {
            // Look for course code in domain (like @bcah.christuniversity.in)
            const possibleCourse = domainParts[0].toUpperCase();
            if (possibleCourse && possibleCourse !== "CHRISTUNIVERSITY") {
              course = possibleCourse;
            }
          }
        }
        
        // Extract registration number from last name or full name
        if (user.user_metadata?.last_name) {
          const lastNameStr = user.user_metadata.last_name.trim();
          if (/^\d+$/.test(lastNameStr)) {
            registerNumber = lastNameStr; // Keep as string
          }
        } else if (fullName) {
          const nameParts = fullName.split(" ");
          if (nameParts.length > 1) {
            const lastPart = nameParts[nameParts.length - 1].trim();
            if (/^\d+$/.test(lastPart)) {
              registerNumber = lastPart; // Keep as string
              // Remove registration number from the full name
              fullName = nameParts.slice(0, nameParts.length - 1).join(" ");
            }
          }
        }
      }
      // For outsiders, visitor_id will be generated by backend
      
      const payload = {
        id: user.id,
        email: user.email,
        name: fullName || user.email?.split("@")[0],
        avatar_url: user.user_metadata?.avatar_url,
        register_number: registerNumber,
        course: course
      };

      console.log("Creating/updating user with payload:", payload);

      const response = await fetch(`${API_URL}/api/users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user: payload }),
      });

      if (!response.ok) {
        throw new Error(`Failed to create/update user: ${response.statusText}`);
      }
    } catch (error) {
      console.error("Error creating/updating user:", error);
    }
  };

  const fetchUserData = async (email: string) => {
    if (!email) {
      setUserData(null);
      return null;
    }

    try {
      const response = await fetch(`${API_URL}/api/users/${email}`);
      if (!response.ok) {
        if (response.status === 404) {
          console.warn(
            `User data not found for ${email}. User might need to be created.`
          );
          setUserData(null);
        } else {
          throw new Error(`Failed to fetch user data: ${response.statusText}`);
        }
        return null;
      }
      const data = await response.json();
      const user = { ...data.user, is_support: Boolean(data.user?.is_support) };
      setUserData(user);
      return user;
    } catch (error) {
      console.error("Error fetching user data:", error);
      setUserData(null);
      return null;
    }
  };

  const signInWithGoogle = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${APP_URL}/auth/callback`,
        },
      });
    } catch (error) {
      console.error("Google authentication error:", error);
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
    }
  };

  const isSupport = Boolean(userData?.is_support);
  const isMasterAdmin = Boolean(userData?.is_masteradmin);

  return (
    <AuthContext.Provider
      value={{ session, userData, isLoading, isSupport, isMasterAdmin, signInWithGoogle, signOut }}
    >
      {children}
      
      {/* Visitor Welcome Modal */}
      {showOutsiderWarning && outsiderVisitorId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="bg-gradient-to-r from-[#063168] to-[#154CB3] p-6 text-center">
              <div className="flex items-center justify-center w-16 h-16 bg-white rounded-full mx-auto mb-3">
                <svg className="w-8 h-8 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-1">Welcome, Visitor! 👋</h3>
              <p className="text-blue-100 text-sm">We&apos;re glad to have you here</p>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 text-center mb-4">
                You&apos;re joining us as an <span className="font-semibold text-[#154CB3]">External Visitor</span>. 
                You can explore and register for events that are open to visitors.
              </p>
              
              <div className="bg-[#063168] rounded-xl p-4 mb-4">
                <p className="text-sm text-blue-100 text-center mb-1">Your Visitor ID</p>
                <p className="text-2xl font-bold text-[#FFCC00] text-center tracking-wider">{outsiderVisitorId}</p>
                <p className="text-xs text-blue-200 text-center mt-2">Keep this ID handy for event registrations</p>
              </div>
              
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-5">
                <p className="text-sm text-amber-800 flex items-start gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                  </svg>
                  <span><strong>Important:</strong> Please set your display name on the next page. You only get <strong>one chance</strong> to edit it!</span>
                </p>
              </div>
              
              <button
                onClick={() => {
                  setShowOutsiderWarning(false);
                  router.push('/profile');
                }}
                className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-semibold py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
              >
                Continue to My Profile
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
