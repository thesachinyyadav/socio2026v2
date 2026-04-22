"use client";

import { createContext, useContext, useEffect, useState, useMemo } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { AuthChangeEvent, Session, User } from "@supabase/supabase-js";
import CampusDetectionModal, { isCampusDismissedRecently } from "../app/_components/CampusDetectionModal";

const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

type UserData = {
  id: number;
  created_at: string;
  name: string;
  register_number: string | null;
  email: string;
  course: string | null;
  department: string | null;
  school: string | null;
  badges: any;
  campus: string | null;
  is_organiser: boolean;
  is_support: boolean;
  is_masteradmin: boolean;
  is_hod?: boolean;
  is_dean?: boolean;
  is_cfo?: boolean;
  is_campus_director?: boolean;
  is_accounts_office?: boolean;
  is_vendor_manager?: boolean;
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
  const [outsiderNameInput, setOutsiderNameInput] = useState("");
  const [isEditingOutsiderName, setIsEditingOutsiderName] = useState(false);
  const [isSavingOutsiderName, setIsSavingOutsiderName] = useState(false);
  const [outsiderNameError, setOutsiderNameError] = useState<string | null>(null);
  const [showCampusModal, setShowCampusModal] = useState(false);

  const getFriendlyOutsiderNameError = (rawError?: string | null) => {
    const normalized = String(rawError || "").trim().toLowerCase();
    if (!normalized) {
      return "We couldn’t save your name right now. Please try again.";
    }
    if (normalized.includes("name edit already used")) {
      return "Your one-time name update has already been used.";
    }
    if (normalized.includes("unauthorized")) {
      return "Your session expired. Please sign in again and retry.";
    }
    if (normalized.includes("only outsider users can edit name")) {
      return "This update option is available only for visitor accounts.";
    }
    if (normalized.includes("name must be a non-empty string") || normalized.includes("name cannot be empty")) {
      return "Please enter your display name before saving.";
    }
    if (normalized.includes("network")) {
      return "Network issue detected. Please check your connection and try again.";
    }
    if (normalized.includes("internal server error") || normalized.includes("failed to save")) {
      return "Couldn’t save changes right now. Please try again in a moment.";
    }
    return rawError || "We couldn’t save your name right now. Please try again.";
  };

  // Helper to persist session in localStorage
  const persistSession = (session: Session | null) => {
    if (session) {
      localStorage.setItem('socio_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('socio_session');
    }
  };

  // Restore session from localStorage on mount
  useEffect(() => {
    const storedSession = localStorage.getItem('socio_session');
    if (storedSession && !session) {
      try {
        const parsedSession = JSON.parse(storedSession);
        setSession(parsedSession);
      } catch (e) {
        localStorage.removeItem('socio_session');
      }
    }
  }, []);

  const supabase = useMemo(
    () => {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        return null;
      }

      return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    },
    []
  );
  const getOrganizationType = (email: string | undefined): 'christ_member' | 'outsider' => {
    if (!email) return 'outsider';
    const lowerEmail = email.toLowerCase();
    const domain = lowerEmail.split('@')[1] || "";
    if (domain.endsWith('christuniversity.in')) return 'christ_member';
    return 'outsider';
  };

  useEffect(() => {
    if (!supabase) {
      console.warn("Supabase configuration missing in AuthProvider; auth features are disabled.");
      setIsLoading(false);
      return;
    }

    const checkUserSession = async () => {
      setIsLoading(true);
      try {
        // Add timeout to prevent hanging on Supabase connection issues
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Supabase connection timeout')), 5000)
        );

        const sessionPromise = supabase.auth.getSession();
        const {
          data: { session: currentSession },
        } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (currentSession) {
          setSession(currentSession);
          persistSession(currentSession);
          // Fetch user data in background so navbar can render immediately.
          void fetchUserData(currentSession.user.email!).then((existingUser) => {
            if (
              existingUser &&
              existingUser.organization_type === 'christ_member' &&
              !existingUser.campus &&
              !isCampusDismissedRecently()
            ) {
              setShowCampusModal(true);
            }
          });
        } else {
          setSession(null);
          setUserData(null);
          persistSession(null);
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
    } = supabase.auth.onAuthStateChange(async (event: AuthChangeEvent, newSession: Session | null) => {
      if (event === "INITIAL_SESSION") {
        setSession(newSession);
        persistSession(newSession);
        if (newSession?.user?.email) {
          void fetchUserData(newSession.user.email);
        } else {
          setUserData(null);
        }
        setIsLoading(false);
        return;
      }

      if (event === "SIGNED_IN" && newSession) {
        // Resolve auth state immediately and load profile details in background.
        setSession(newSession);
        persistSession(newSession);
        setIsLoading(false);

        const orgType = getOrganizationType(newSession.user?.email);

        void (async () => {
          await createOrUpdateUser(newSession.user);

          let fetchedUser = await fetchUserData(newSession.user.email!);
          if (!fetchedUser) {
            await new Promise((resolve) => setTimeout(resolve, 150));
            fetchedUser = await fetchUserData(newSession.user.email!);
          }

          if (
            orgType === 'outsider' &&
            fetchedUser?.visitor_id &&
            !fetchedUser?.outsider_name_edit_used
          ) {
            setOutsiderVisitorId(fetchedUser.visitor_id);
            const hasSeenWarning = localStorage.getItem(`outsider_warning_${newSession.user.id}`);
            if (!hasSeenWarning) {
              setShowOutsiderWarning(true);
              localStorage.setItem(`outsider_warning_${newSession.user.id}`, 'true');
            }
          }

          if (
            orgType === 'christ_member' &&
            fetchedUser &&
            !fetchedUser.campus &&
            !isCampusDismissedRecently()
          ) {
            setShowCampusModal(true);
          }
        })();
      } else if (event === "SIGNED_OUT") {
        setSession(null);
        setUserData(null);
        persistSession(null);
        setIsLoading(false);
      } else if (event === "USER_UPDATED" && newSession) {
        setSession(newSession);
        persistSession(newSession);
        void fetchUserData(newSession.user.email!);
      } else if (event === "TOKEN_REFRESHED" && newSession) {
        setSession(newSession);
        persistSession(newSession);
        setIsLoading(false);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase]);

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
      // For outsiders, IDs are generated by backend
      
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
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(email)}`);
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
      if (!supabase) {
        throw new Error("Supabase client is not configured");
      }

      const redirectOrigin = typeof window !== "undefined" ? window.location.origin : APP_URL;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${redirectOrigin}/auth/callback`,
        },
      });

      if (error) {
        throw error;
      }
    } catch (error) {
      console.error("Google authentication error:", error);
      setIsLoading(false);
      throw error;
    }
  };

  const signOut = async () => {
    setIsLoading(true);
    try {
      if (!supabase) {
        return;
      }

      await supabase.auth.signOut();
    } catch (error) {
      console.error("Sign out error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const isSupport = Boolean(userData?.is_support);
  const isMasterAdmin = Boolean(userData?.is_masteradmin);

  return (
    <AuthContext.Provider
      value={{ session, userData, isLoading, isSupport, isMasterAdmin, signInWithGoogle, signOut }}
    >
      {children}

      {/* Campus Detection Modal */}
      {showCampusModal && session?.access_token && userData?.email && (
        <CampusDetectionModal
          userEmail={userData.email}
          accessToken={session.access_token}
          onComplete={(campus) => {
            setShowCampusModal(false);
            setUserData((prev) => prev ? { ...prev, campus } : prev);
          }}
          onDismiss={() => setShowCampusModal(false)}
        />
      )}
      
      {/* Visitor Welcome Modal */}
      {showOutsiderWarning && outsiderVisitorId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full overflow-hidden">
            {/* Compact header */}
            <div className="bg-[#063168] px-5 py-4 flex items-center gap-3">
              <div className="w-10 h-10 bg-white/15 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-[#FFCC00]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Welcome, Visitor</h3>
                <p className="text-blue-200 text-xs">External visitor access</p>
              </div>
            </div>
            
            <div className="p-5 space-y-3">
              {/* Visitor ID badge */}
              <div className="flex items-center justify-between bg-[#063168] rounded-lg px-4 py-3">
                <span className="text-xs text-blue-200">Visitor ID</span>
                <span className="text-base font-bold text-[#FFCC00] tracking-wider">{outsiderVisitorId}</span>
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Please confirm your display name before continuing. Visitor profiles can update it only once.
                </p>
              </div>

              {/* Name display with inline actions */}
              <div className="bg-gray-50 rounded-lg px-4 py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-medium text-gray-500 mb-0.5">Display Name</p>
                    {!isEditingOutsiderName ? (
                      <p className="text-sm font-semibold text-[#063168]">{userData?.name || session?.user?.user_metadata?.full_name || "--"}</p>
                    ) : (
                      <input
                        type="text"
                        value={outsiderNameInput}
                        onChange={(e) => setOutsiderNameInput(e.target.value)}
                        className="w-full border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-[#154CB3] mt-0.5"
                        placeholder="Enter your name"
                        autoFocus
                      />
                    )}
                  </div>
                  {!isEditingOutsiderName && !isSavingOutsiderName && (
                    <button
                      onClick={() => {
                        setOutsiderNameInput(userData?.name || session?.user?.user_metadata?.full_name || "");
                        setIsEditingOutsiderName(true);
                        setOutsiderNameError(null);
                      }}
                      className="text-[#154CB3] text-xs font-semibold hover:underline flex-shrink-0 ml-3"
                    >
                      Change Name
                    </button>
                  )}
                </div>
              </div>

              {outsiderNameError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                  <p className="text-red-700 text-xs text-center">{outsiderNameError}</p>
                </div>
              )}

              {isEditingOutsiderName && (
                <p className="text-[11px] text-amber-700 text-center">One-time update: check spelling carefully before saving.</p>
              )}

              {!isEditingOutsiderName && (
                <p className="text-[11px] text-gray-500 text-center">Need a correction? Use Change Name before you continue.</p>
              )}

              {/* Action buttons */}
              {!isEditingOutsiderName ? (
                <button
                  onClick={async () => {
                    setIsSavingOutsiderName(true);
                    setOutsiderNameError(null);
                    try {
                      const currentName = userData?.name || session?.user?.user_metadata?.full_name || "";
                      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                      const token = (session as any)?.access_token;
                      if (token) headers['Authorization'] = `Bearer ${token}`;
                      const bodyPayload: any = { name: currentName.trim(), visitor_id: outsiderVisitorId };
                      const resp = await fetch(`${API_URL}/api/users/${encodeURIComponent(userData!.email)}/name`, {
                        method: 'PUT', headers, body: JSON.stringify(bodyPayload)
                      });
                      if (!resp.ok) {
                        const data = await resp.json();
                        setOutsiderNameError(getFriendlyOutsiderNameError(data.error));
                        setIsSavingOutsiderName(false);
                        return;
                      }
                      setShowOutsiderWarning(false);
                      window.location.reload();
                    } catch {
                      setOutsiderNameError(getFriendlyOutsiderNameError('Network error'));
                      setIsSavingOutsiderName(false);
                    }
                  }}
                  disabled={isSavingOutsiderName}
                  className="w-full bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {isSavingOutsiderName ? "Saving..." : "Name Is Correct, Continue"}
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => { setIsEditingOutsiderName(false); setOutsiderNameError(null); }}
                    disabled={isSavingOutsiderName}
                    className="flex-1 border border-gray-300 text-gray-600 font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!outsiderNameInput.trim()) {
                        setOutsiderNameError(getFriendlyOutsiderNameError("Name cannot be empty"));
                        return;
                      }
                      setIsSavingOutsiderName(true);
                      setOutsiderNameError(null);
                      try {
                        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
                        const token = (session as any)?.access_token;
                        if (token) headers['Authorization'] = `Bearer ${token}`;
                        const bodyPayload: any = { name: outsiderNameInput.trim(), visitor_id: outsiderVisitorId };
                        const resp = await fetch(`${API_URL}/api/users/${encodeURIComponent(userData!.email)}/name`, {
                          method: 'PUT', headers, body: JSON.stringify(bodyPayload)
                        });
                        if (!resp.ok) {
                          const data = await resp.json();
                          setOutsiderNameError(getFriendlyOutsiderNameError(data.error));
                          setIsSavingOutsiderName(false);
                          return;
                        }
                        setShowOutsiderWarning(false);
                        window.location.reload();
                      } catch {
                        setOutsiderNameError(getFriendlyOutsiderNameError('Network error'));
                        setIsSavingOutsiderName(false);
                      }
                    }}
                    disabled={isSavingOutsiderName}
                    className="flex-1 bg-[#154CB3] hover:bg-[#0f3d8a] text-white font-medium py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                  >
                    {isSavingOutsiderName ? "Saving..." : "Save Name"}
                  </button>
                </div>
              )}
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

