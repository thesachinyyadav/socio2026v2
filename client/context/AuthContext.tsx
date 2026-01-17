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
          await fetchUserData(currentSession.user.email!);
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
      setIsLoading(true);
      if (event === "SIGNED_IN" && newSession) {
        setSession(newSession);
        
        // Check if user is an outsider
        const orgType = getOrganizationType(newSession.user?.email);
        
        await createOrUpdateUser(newSession.user);
        const userData = await fetchUserData(newSession.user.email!);
        
        // Show warning for first-time outsiders
        if (orgType === 'outsider' && userData?.visitor_id) {
          setOutsiderVisitorId(userData.visitor_id);
          const hasSeenWarning = localStorage.getItem(`outsider_warning_${newSession.user.id}`);
          if (!hasSeenWarning) {
            setShowOutsiderWarning(true);
            localStorage.setItem(`outsider_warning_${newSession.user.id}`, 'true');
          }
        }
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUserData(null);
      } else if (event === "USER_UPDATED" && newSession) {
        setSession(newSession);
        await fetchUserData(newSession.user.email!);
      }
      setIsLoading(false);
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
      
      {/* Outsider Warning Modal */}
      {showOutsiderWarning && outsiderVisitorId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-center w-16 h-16 bg-yellow-100 rounded-full mx-auto mb-4">
              <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 text-center mb-2">Welcome, Outsider!</h3>
            <p className="text-gray-600 text-center mb-4">
              You are signing in as an outsider. <span className="font-semibold text-red-600">You will NOT be part of Christ University organization.</span>
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 text-center mb-2">Your Visitor ID:</p>
              <p className="text-2xl font-bold text-[#154CB3] text-center">{outsiderVisitorId}</p>
              <p className="text-xs text-gray-500 text-center mt-2">Use this ID for event registrations</p>
            </div>
            <button
              onClick={() => setShowOutsiderWarning(false)}
              className="w-full bg-[#154CB3] hover:bg-[#154cb3df] text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              I Understand
            </button>
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
