"use client";

import { useState, useEffect, useMemo } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import toast from "react-hot-toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import DateTimePickerAdmin from "../_components/DateTimePickerAdmin";
import dynamic from "next/dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ITEMS_PER_PAGE = 20;

const AnalyticsDashboard = dynamic(
  () => import("../_components/Admin/AnalyticsDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    ),
  }
);

const AdminNotifications = dynamic(
  () => import("../_components/Admin/AdminNotifications"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600">Loading notifications...</div>
      </div>
    ),
  }
);

type User = {
  id: number;
  email: string;
  name: string;
  is_organiser: boolean;
  organiser_expires_at?: string | null;
  is_support: boolean;
  support_expires_at?: string | null;
  is_masteradmin: boolean;
  masteradmin_expires_at?: string | null;
  created_at: string;
  course?: string | null;
  register_number?: number | null;
};

type Event = {
  event_id: string;
  title: string;
  organizing_dept: string;
  event_date: string;
  created_by: string;
  created_at: string;
  registration_fee: number;
  registration_count?: number;
};

type Fest = {
  fest_id: string;
  fest_title: string;
  organizing_dept: string;
  opening_date: string;
  created_by: string;
  created_at: string;
  registration_count?: number;
};

type Registration = {
  registration_id: string;
  event_id: string;
  user_email?: string;
  registration_type: string;
  created_at: string;
  participant_organization?: string;
  teammates?: any[];
};

export default function MasterAdminPage() {
  const { userData, isMasterAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "events" | "fests" | "notifications">("dashboard");
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserRoles, setEditingUserRoles] = useState<Partial<User>>({});
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  
  // Event management state
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState<string | null>(null);
  const [eventPage, setEventPage] = useState(1);
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "live" | "upcoming" | "thisweek" | "past">("all");
  const [eventSortKey, setEventSortKey] = useState<"title" | "date" | "registrations" | "dept">("date");
  const [eventSortDir, setEventSortDir] = useState<"asc" | "desc">("desc");
  
  // User sort state
  const [userSortKey, setUserSortKey] = useState<"name" | "email">("name");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("asc");

  // Fest management state
  const [fests, setFests] = useState<Fest[]>([]);
  const [filteredFests, setFilteredFests] = useState<Fest[]>([]);
  const [festSearchQuery, setFestSearchQuery] = useState("");
  const [showDeleteFestConfirm, setShowDeleteFestConfirm] = useState<string | null>(null);
  const [festPage, setFestPage] = useState(1);
  const [festSortKey, setFestSortKey] = useState<"title" | "date" | "registrations" | "dept">("date");
  const [festSortDir, setFestSortDir] = useState<"asc" | "desc">("desc");

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Debounced search queries for better performance
  const debouncedUserSearch = useDebounce(userSearchQuery, 300);
  const debouncedEventSearch = useDebounce(eventSearchQuery, 300);
  const debouncedFestSearch = useDebounce(festSearchQuery, 300);

  useEffect(() => {
    const getToken = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
    };
    
    getToken();
  }, []);

  useEffect(() => {
    if (!authLoading && !isMasterAdmin) {
      router.push("/");
    }
  }, [authLoading, isMasterAdmin, router]);

  useEffect(() => {
    if (!isMasterAdmin || !authToken) return;
    
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "events") {
      fetchEvents();
    } else if (activeTab === "fests") {
      fetchFests();
    } else if (activeTab === "dashboard") {
      fetchDashboardData();
    } else if (activeTab === "notifications") {
      // Ensure users/events are loaded for the notification composer
      if (users.length === 0) fetchUsers();
      if (events.length === 0) fetchEvents();
    }
  }, [activeTab, isMasterAdmin, authToken]);

  useEffect(() => {
    let filtered = users;

    if (debouncedUserSearch) {
      const query = debouncedUserSearch.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.name?.toLowerCase().includes(query)
      );
    }

    if (roleFilter !== "all") {
      switch (roleFilter) {
        case "organiser":
          filtered = filtered.filter((u) => u.is_organiser);
          break;
        case "support":
          filtered = filtered.filter((u) => u.is_support);
          break;
        case "masteradmin":
          filtered = filtered.filter((u) => u.is_masteradmin);
          break;
      }
    }

    setFilteredUsers(filtered);
    setUserPage(1);
  }, [users, debouncedUserSearch, roleFilter]);

  // Sort users
  const sortedFilteredUsers = useMemo(() => {
    return [...filteredUsers].sort((a, b) => {
      let cmp = 0;
      switch (userSortKey) {
        case "name": cmp = (a.name || "").localeCompare(b.name || ""); break;
        case "email": cmp = a.email.localeCompare(b.email); break;
      }
      return userSortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredUsers, userSortKey, userSortDir]);

  // Event status helper
  const getEventStatus = (dateStr: string) => {
    const now = new Date();
    const eventDate = new Date(dateStr);
    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < -1) return { label: "Past", color: "bg-gray-100 text-gray-600" };
    if (Math.abs(diffDays) <= 1) return { label: "Live", color: "bg-green-100 text-green-700" };
    if (diffDays <= 7) return { label: "This Week", color: "bg-yellow-100 text-yellow-700" };
    return { label: "Upcoming", color: "bg-blue-100 text-blue-700" };
  };

  // Sort toggle helper
  const toggleSort = <T extends string>(
    key: T,
    currentKey: T,
    currentDir: "asc" | "desc",
    setKey: (k: T) => void,
    setDir: (d: "asc" | "desc") => void
  ) => {
    if (currentKey === key) {
      setDir(currentDir === "asc" ? "desc" : "asc");
    } else {
      setKey(key);
      setDir("asc");
    }
  };

  // Sort indicator
  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => (
    <span className={`ml-1 inline-block transition-colors ${active ? "text-[#154CB3]" : "text-gray-400"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  useEffect(() => {
    let filtered = events;

    if (debouncedEventSearch) {
      const query = debouncedEventSearch.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.organizing_dept?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (eventStatusFilter !== "all") {
      filtered = filtered.filter((event) => {
        const status = getEventStatus(event.event_date).label.toLowerCase().replace(" ", "");
        return status === eventStatusFilter;
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (eventSortKey) {
        case "title": cmp = a.title.localeCompare(b.title); break;
        case "dept": cmp = (a.organizing_dept || "").localeCompare(b.organizing_dept || ""); break;
        case "date": cmp = new Date(a.event_date).getTime() - new Date(b.event_date).getTime(); break;
        case "registrations": cmp = (a.registration_count || 0) - (b.registration_count || 0); break;
      }
      return eventSortDir === "asc" ? cmp : -cmp;
    });

    setFilteredEvents(filtered);
    setEventPage(1);
  }, [events, debouncedEventSearch, eventStatusFilter, eventSortKey, eventSortDir]);

  useEffect(() => {
    let filtered = fests;

    if (debouncedFestSearch) {
      const query = debouncedFestSearch.toLowerCase();
      filtered = filtered.filter(
        (fest) =>
          fest.fest_title.toLowerCase().includes(query) ||
          fest.organizing_dept?.toLowerCase().includes(query)
      );
    }

    setFilteredFests(filtered);
    setFestPage(1);
  }, [fests, debouncedFestSearch]);

  // Sort fests
  const sortedFilteredFests = useMemo(() => {
    return [...filteredFests].sort((a, b) => {
      let cmp = 0;
      switch (festSortKey) {
        case "title": cmp = a.fest_title.localeCompare(b.fest_title); break;
        case "dept": cmp = (a.organizing_dept || "").localeCompare(b.organizing_dept || ""); break;
        case "date": cmp = new Date(a.opening_date).getTime() - new Date(b.opening_date).getTime(); break;
        case "registrations": cmp = (a.registration_count || 0) - (b.registration_count || 0); break;
      }
      return festSortDir === "asc" ? cmp : -cmp;
    });
  }, [filteredFests, festSortKey, festSortDir]);

  const fetchRegistrations = async () => {
    try {
      const response = await fetch(`${API_URL}/api/registrations`);
      if (!response.ok) throw new Error("Failed to fetch registrations");
      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error("Error fetching registrations:", error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchEvents(), fetchFests(), fetchRegistrations()]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      
      const [eventsResponse, registrationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/events`),
        fetch(`${API_URL}/api/registrations`)
      ]);

      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await eventsResponse.json();
      const eventsList = data.events || [];

      // Get registration counts by event_id
      let eventRegistrationCounts: Record<string, number> = {};
      if (registrationsResponse.ok) {
        const regData = await registrationsResponse.json();
        if (regData.registrations) {
          regData.registrations.forEach((reg: any) => {
            if (reg.event_id) {
              eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
            }
          });
        }
      }

      // Add registration counts to events
      const eventsWithCounts = eventsList.map((event: Event) => ({
        ...event,
        registration_count: eventRegistrationCounts[event.event_id] || 0
      }));

      setEvents(eventsWithCounts);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFests = async () => {
    try {
      setIsLoading(true);
      
      const [festsResponse, eventsResponse, registrationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/fests`),
        fetch(`${API_URL}/api/events`),
        fetch(`${API_URL}/api/registrations`)
      ]);

      if (!festsResponse.ok) {
        throw new Error("Failed to fetch fests");
      }

      const festsData = await festsResponse.json();
      const festsList = festsData.fests || festsData || [];

      // Get events data
      let eventsData: any[] = [];
      if (eventsResponse.ok) {
        const eventsJson = await eventsResponse.json();
        eventsData = eventsJson.events || [];
      }

      // Get registration counts by event_id
      let eventRegistrationCounts: Record<string, number> = {};
      if (registrationsResponse.ok) {
        const regData = await registrationsResponse.json();
        if (regData.registrations) {
          regData.registrations.forEach((reg: any) => {
            if (reg.event_id) {
              eventRegistrationCounts[reg.event_id] = (eventRegistrationCounts[reg.event_id] || 0) + 1;
            }
          });
        }
      }

      // Calculate fest registration counts: sum of all registrations for events belonging to that fest
      const festRegistrationCounts: Record<string, number> = {};
      eventsData.forEach((event: any) => {
        // Match by fest NAME (the 'fest' column contains fest title, not ID)
        if (event.fest) {
          const eventRegCount = eventRegistrationCounts[event.event_id] || 0;
          // Find fest by matching title
          const matchingFest = festsList.find((f: any) => f.fest_title === event.fest);
          if (matchingFest) {
            festRegistrationCounts[matchingFest.fest_id] = (festRegistrationCounts[matchingFest.fest_id] || 0) + eventRegCount;
          }
        }
      });

      // Add registration counts to fests
      const festsWithCounts = festsList.map((fest: Fest) => ({
        ...fest,
        registration_count: festRegistrationCounts[fest.fest_id] || 0
      }));

      setFests(festsWithCounts);
    } catch (error) {
      console.error("Error fetching fests:", error);
      toast.error("Failed to load fests");
    } finally {
      setIsLoading(false);
    }
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditingUserRoles({
      is_organiser: user.is_organiser,
      organiser_expires_at: user.organiser_expires_at,
      is_support: user.is_support,
      support_expires_at: user.support_expires_at,
      is_masteradmin: user.is_masteradmin,
      masteradmin_expires_at: user.masteradmin_expires_at,
    });
  };

  const handleRoleToggle = (role: "is_organiser" | "is_support" | "is_masteradmin") => {
    setEditingUserRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  const handleExpirationChange = (
    field: "organiser_expires_at" | "support_expires_at" | "masteradmin_expires_at",
    value: string | null
  ) => {
    setEditingUserRoles(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveRoleChanges = async (user: User) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}/roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          is_organiser: editingUserRoles.is_organiser,
          organiser_expires_at: editingUserRoles.organiser_expires_at || null,
          is_support: editingUserRoles.is_support,
          support_expires_at: editingUserRoles.support_expires_at || null,
          is_masteradmin: editingUserRoles.is_masteradmin,
          masteradmin_expires_at: editingUserRoles.masteradmin_expires_at || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update roles");
      }

      // Update local state
      setUsers((prev) => prev.map((u) => 
        u.id === user.id 
          ? { ...u, ...editingUserRoles }
          : u
      ));
      setEditingUserId(null);
      setEditingUserRoles({});
      toast.success("Roles updated successfully");
    } catch (error: any) {
      console.error("Error updating roles:", error);
      toast.error(error.message || "Failed to update roles");
    }
  };

  const deleteUser = async (email: string) => {
    try {
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      setUsers((prev) => prev.filter((u) => u.email !== email));
      setShowDeleteUserConfirm(null);
      toast.success("User deleted successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }

      setEvents((prev) => prev.filter((e) => e.event_id !== eventId));
      setShowDeleteEventConfirm(null);
      toast.success("Event deleted successfully");
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error(error.message || "Failed to delete event");
    }
  };

  const deleteFest = async (festId: string) => {
    try {
      const response = await fetch(`${API_URL}/api/fests/${festId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete fest");
      }

      setFests((prev) => prev.filter((f) => f.fest_id !== festId));
      setShowDeleteFestConfirm(null);
      toast.success("Fest deleted successfully");
    } catch (error: any) {
      console.error("Error deleting fest:", error);
      toast.error(error.message || "Failed to delete fest");
    }
  };

  // Pagination helpers
  const paginateArray = <T,>(array: T[], page: number) => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    return {
      items: array.slice(start, end),
      totalPages: Math.ceil(array.length / ITEMS_PER_PAGE),
      hasNext: end < array.length,
      hasPrev: page > 1
    };
  };

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    hasNext, 
    hasPrev, 
    onNext, 
    onPrev,
    totalItems
  }: { 
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
    totalItems?: number;
  }) => (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
        {totalItems !== undefined && (
          <span className="ml-2 text-gray-400">({totalItems} total items)</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasPrev
              ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasNext
              ? "bg-[#154CB3] text-white hover:bg-[#154cb3df]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );

  const paginatedUsers = paginateArray(sortedFilteredUsers, userPage);
  const paginatedEvents = paginateArray(filteredEvents, eventPage);
  const paginatedFests = paginateArray(sortedFilteredFests, festPage);

  if (authLoading || !authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header — Command Center */}
        <div className="mb-8">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#063168] via-[#154CB3] to-[#1e6fd9] rounded-2xl p-6 sm:p-8 shadow-lg">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-[#FFCC00]/10 rounded-full" />
            
            <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-full mb-3 border border-white/20">
                  <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  <span className="text-xs font-medium text-blue-100">Platform Online</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-black text-white mb-1">
                  Welcome back, {userData?.name?.split(' ')[0] || 'Admin'} 👋
                </h1>
                <p className="text-blue-200 text-sm">
                  SOCIO Command Center &middot; {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href="/create/event"
                  className="inline-flex items-center gap-2 bg-[#FFCC00] text-[#063168] px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-yellow-300 transition-all shadow-lg shadow-black/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Create Event
                </a>
                <a
                  href="/create/fest"
                  className="inline-flex items-center gap-2 bg-white/15 backdrop-blur-sm text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-white/25 transition-all border border-white/20"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  Create Fest
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm mb-6 overflow-hidden border border-gray-200">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {[
              { id: "dashboard", label: "Dashboard", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /></svg>
              )},
              { id: "users", label: "Users", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
              ), count: users.length },
              { id: "events", label: "Events", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              ), count: events.length },
              { id: "fests", label: "Fests", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
              ), count: fests.length },
              { id: "notifications", label: "Notifications", icon: (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /></svg>
              )}
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-5 py-4 font-medium transition-all whitespace-nowrap text-sm ${
                  activeTab === tab.id
                    ? "border-b-2 border-[#154CB3] text-[#154CB3] bg-blue-50/50"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                {tab.label}
                {"count" in tab && tab.count !== undefined && tab.count > 0 && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                    activeTab === tab.id ? "bg-[#154CB3]/10 text-[#154CB3]" : "bg-gray-100 text-gray-500"
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <div className="text-gray-600">Loading analytics...</div>
              </div>
            ) : (
              <>
                {/* Live Platform Pulse — At-a-glance power stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {(() => {
                    const now = new Date();
                    const liveEvents = events.filter(e => {
                      const d = new Date(e.event_date);
                      return d.toDateString() === now.toDateString();
                    });
                    const upcomingEvents = events.filter(e => new Date(e.event_date) > now);
                    const thisWeekRegs = registrations.filter(r => {
                      const d = new Date(r.created_at);
                      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                      return d >= weekAgo;
                    });
                    const organisers = users.filter(u => u.is_organiser);
                    const totalParticipants = registrations.reduce((sum, r) => sum + 1 + (r.teammates?.length || 0), 0);
                    
                    return [
                      {
                        label: "Live Today",
                        value: liveEvents.length,
                        sub: liveEvents.length > 0 ? liveEvents[0].title : "No events today",
                        color: "emerald",
                        icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" strokeWidth={2}/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06" /></svg>),
                        pulse: liveEvents.length > 0
                      },
                      {
                        label: "Upcoming Events",
                        value: upcomingEvents.length,
                        sub: `${events.length} total created`,
                        color: "blue",
                        icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>),
                        pulse: false
                      },
                      {
                        label: "This Week",
                        value: thisWeekRegs.length,
                        sub: `${totalParticipants.toLocaleString()} total participants`,
                        color: "violet",
                        icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>),
                        pulse: false
                      },
                      {
                        label: "Active Organisers",
                        value: organisers.length,
                        sub: `${users.length} total users`,
                        color: "amber",
                        icon: (<svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>),
                        pulse: false
                      }
                    ];
                  })().map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                          stat.color === "emerald" ? "bg-emerald-50 text-emerald-600" :
                          stat.color === "blue" ? "bg-blue-50 text-blue-600" :
                          stat.color === "violet" ? "bg-violet-50 text-violet-600" :
                          "bg-amber-50 text-amber-600"
                        }`}>
                          {stat.icon}
                        </div>
                        {stat.pulse && (
                          <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                            LIVE
                          </span>
                        )}
                      </div>
                      <div className="text-2xl font-black text-gray-900">{stat.value}</div>
                      <div className="text-sm font-medium text-gray-600 mt-0.5">{stat.label}</div>
                      <div className="text-xs text-gray-400 mt-1 truncate">{stat.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Analytics Dashboard */}
                <AnalyticsDashboard
                  users={users}
                  events={events}
                  fests={fests}
                  registrations={registrations}
                />

                {/* Recent Activity + Quick Actions side by side */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Recent Activity Feed */}
                  <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                        <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Recent Activity
                      </h3>
                      <span className="text-xs text-gray-400">Latest first</span>
                    </div>
                    <div className="space-y-3 max-h-80 overflow-y-auto">
                      {(() => {
                        type ActivityItem = { type: string; text: string; time: Date; color: string };
                        const activities: ActivityItem[] = [];
                        
                        // Recent events created
                        events.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).forEach(e => {
                          activities.push({
                            type: "event",
                            text: `Event "${e.title}" created by ${e.created_by?.split('@')[0] || 'unknown'}`,
                            time: new Date(e.created_at),
                            color: "blue"
                          });
                        });
                        
                        // Recent registrations
                        registrations.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5).forEach(r => {
                          const event = events.find(e => e.event_id === r.event_id);
                          activities.push({
                            type: "registration",
                            text: `New ${r.registration_type} registration for "${event?.title || r.event_id}"`,
                            time: new Date(r.created_at),
                            color: "emerald"
                          });
                        });
                        
                        // Recent users
                        users.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 3).forEach(u => {
                          activities.push({
                            type: "user",
                            text: `${u.name || u.email} joined the platform`,
                            time: new Date(u.created_at),
                            color: "violet"
                          });
                        });
                        
                        // Recent fests
                        fests.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 2).forEach(f => {
                          activities.push({
                            type: "fest",
                            text: `Fest "${f.fest_title}" created`,
                            time: new Date(f.created_at),
                            color: "amber"
                          });
                        });
                        
                        activities.sort((a, b) => b.time.getTime() - a.time.getTime());
                        
                        if (activities.length === 0) {
                          return (
                            <div className="text-center py-8 text-gray-400 text-sm">No recent activity</div>
                          );
                        }
                        
                        return activities.slice(0, 10).map((activity, idx) => {
                          const now = new Date();
                          const diff = now.getTime() - activity.time.getTime();
                          const mins = Math.floor(diff / 60000);
                          const hours = Math.floor(diff / 3600000);
                          const days = Math.floor(diff / 86400000);
                          const timeAgo = mins < 1 ? "just now" : mins < 60 ? `${mins}m ago` : hours < 24 ? `${hours}h ago` : `${days}d ago`;
                          
                          return (
                            <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-all">
                              <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                                activity.color === "blue" ? "bg-blue-500" :
                                activity.color === "emerald" ? "bg-emerald-500" :
                                activity.color === "violet" ? "bg-violet-500" :
                                "bg-amber-500"
                              }`} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-gray-700 truncate">{activity.text}</p>
                                <p className="text-xs text-gray-400 mt-0.5">{timeAgo}</p>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                    <h3 className="text-base font-bold mb-4 text-gray-900 flex items-center gap-2">
                      <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                      Quick Actions
                    </h3>
                    <div className="space-y-2">
                      {[
                        { tab: "users", title: "Manage Users", desc: "Roles & permissions", icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>), color: "blue" },
                        { tab: "events", title: "Manage Events", desc: "View, edit, delete", icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>), color: "emerald" },
                        { tab: "fests", title: "Manage Fests", desc: "Oversee all fests", icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>), color: "violet" },
                        { tab: "notifications", title: "Send Broadcast", desc: "Notify all users", icon: (<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>), color: "amber" }
                      ].map((action, idx) => (
                        <button
                          key={idx}
                          onClick={() => setActiveTab(action.tab as any)}
                          className="w-full flex items-center gap-3 p-3 border border-gray-100 rounded-xl hover:border-[#154CB3]/30 hover:bg-blue-50/50 transition-all text-left group"
                        >
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                            action.color === "blue" ? "bg-blue-50 text-blue-600 group-hover:bg-blue-100" :
                            action.color === "emerald" ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" :
                            action.color === "violet" ? "bg-violet-50 text-violet-600 group-hover:bg-violet-100" :
                            "bg-amber-50 text-amber-600 group-hover:bg-amber-100"
                          } transition-colors`}>
                            {action.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">{action.title}</div>
                            <div className="text-xs text-gray-400">{action.desc}</div>
                          </div>
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-[#154CB3] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                      ))}
                      <div className="pt-2 border-t border-gray-100 mt-2">
                        <a
                          href="/manage"
                          className="w-full flex items-center gap-3 p-3 border border-dashed border-gray-200 rounded-xl hover:border-[#154CB3]/30 hover:bg-blue-50/50 transition-all text-left group"
                        >
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 bg-gray-50 text-gray-500 group-hover:bg-gray-100 transition-colors">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 text-sm">Organiser View</div>
                            <div className="text-xs text-gray-400">Open manage page</div>
                          </div>
                          <svg className="w-4 h-4 text-gray-300 group-hover:text-[#154CB3] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Platform Health Bar */}
                <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-5">
                  <h3 className="text-base font-bold mb-4 text-gray-900 flex items-center gap-2">
                    <svg className="w-4 h-4 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    Platform Health
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                    {(() => {
                      const now = new Date();
                      const todayUsers = users.filter(u => new Date(u.created_at).toDateString() === now.toDateString()).length;
                      const todayRegs = registrations.filter(r => new Date(r.created_at).toDateString() === now.toDateString()).length;
                      const avgRegsPerEvent = events.length > 0 ? Math.round(registrations.length / events.length) : 0;
                      const paidEvents = events.filter(e => e.registration_fee > 0).length;
                      const revenue = events.reduce((sum, e) => sum + (e.registration_fee * (e.registration_count || 0)), 0);
                      
                      return [
                        { label: "New Users Today", value: todayUsers, icon: "👤" },
                        { label: "Registrations Today", value: todayRegs, icon: "📝" },
                        { label: "Avg Regs/Event", value: avgRegsPerEvent, icon: "📊" },
                        { label: "Paid Events", value: paidEvents, icon: "💰" },
                        { label: "Est. Revenue", value: `₹${revenue.toLocaleString('en-IN')}`, icon: "💵" }
                      ];
                    })().map((item, idx) => (
                      <div key={idx} className="text-center p-3 bg-gray-50 rounded-xl">
                        <div className="text-lg mb-1">{item.icon}</div>
                        <div className="text-lg font-black text-gray-900">{item.value}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Users
                  </label>
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Role
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  >
                    <option value="all">All Users ({users.length})</option>
                    <option value="organiser">Organisers ({users.filter((u) => u.is_organiser).length})</option>
                    <option value="support">Support ({users.filter((u) => u.is_support).length})</option>
                    <option value="masteradmin">Master Admins ({users.filter((u) => u.is_masteradmin).length})</option>
                  </select>
                </div>
              </div>
              {/* Result summary */}
              <div className="mt-3 text-sm text-gray-500">
                Showing <strong className="text-gray-700">{sortedFilteredUsers.length}</strong> of{" "}
                <strong className="text-gray-700">{users.length}</strong> users
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading users...</div>
                </div>
              ) : paginatedUsers.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No users found</div>
                  <div className="text-gray-500">Try adjusting your search or filter</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("name", userSortKey, userSortDir, setUserSortKey, setUserSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          >
                            User <SortIcon active={userSortKey === "name"} dir={userSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Organiser
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Support
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Master Admin
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedUsers.items.map((user) => {
                          const isEditing = editingUserId === user.id;
                          const displayRoles = isEditing ? editingUserRoles : user;

                          return (
                            <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <div className="font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_organiser || false}
                                      onChange={() => isEditing && handleRoleToggle("is_organiser")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-[#154CB3] rounded focus:ring-[#154CB3] cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_organiser ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_organiser ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_organiser && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.organiser_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("organiser_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("organiser_expires_at", null)
                                        }
                                        colorScheme="blue"
                                        label="Organiser expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_support || false}
                                      onChange={() => isEditing && handleRoleToggle("is_support")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_support ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_support ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_support && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.support_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("support_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("support_expires_at", null)
                                        }
                                        colorScheme="green"
                                        label="Support expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_masteradmin || false}
                                      onChange={() => isEditing && handleRoleToggle("is_masteradmin")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_masteradmin ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_masteradmin ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_masteradmin && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.masteradmin_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("masteradmin_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("masteradmin_expires_at", null)
                                        }
                                        colorScheme="red"
                                        label="Master Admin expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveRoleChanges(user)}
                                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingUserId(null);
                                          setEditingUserRoles({});
                                        }}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditUser(user)}
                                        className="px-4 py-2 bg-[#154CB3] text-white text-sm font-medium rounded-lg hover:bg-[#154cb3df] transition-colors"
                                      >
                                        Edit
                                      </button>
                                      {user.email !== userData?.email && (
                                        <button
                                          onClick={() => setShowDeleteUserConfirm(user.email)}
                                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={userPage}
                    totalPages={paginatedUsers.totalPages}
                    hasNext={paginatedUsers.hasNext}
                    hasPrev={paginatedUsers.hasPrev}
                    onNext={() => setUserPage(p => p + 1)}
                    onPrev={() => setUserPage(p => p - 1)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Event Management Tab */}
        {activeTab === "events" && (
          <div className="space-y-6">
            {/* Search + Status Filter + Result Count */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Events</label>
                  <input
                    type="text"
                    placeholder="Search events by title or department..."
                    value={eventSearchQuery}
                    onChange={(e) => setEventSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={eventStatusFilter}
                    onChange={(e) => setEventStatusFilter(e.target.value as any)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  >
                    <option value="all">All Events ({events.length})</option>
                    <option value="live">Live ({events.filter(e => getEventStatus(e.event_date).label === "Live").length})</option>
                    <option value="thisweek">This Week ({events.filter(e => getEventStatus(e.event_date).label === "This Week").length})</option>
                    <option value="upcoming">Upcoming ({events.filter(e => getEventStatus(e.event_date).label === "Upcoming").length})</option>
                    <option value="past">Past ({events.filter(e => getEventStatus(e.event_date).label === "Past").length})</option>
                  </select>
                </div>
              </div>
              {/* Result summary */}
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>
                  Showing <strong className="text-gray-700">{filteredEvents.length}</strong> of{" "}
                  <strong className="text-gray-700">{events.length}</strong> events
                  {eventStatusFilter !== "all" && (
                    <button onClick={() => setEventStatusFilter("all")} className="ml-2 text-[#154CB3] hover:underline">
                      Clear filter
                    </button>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  Sorted by {eventSortKey} ({eventSortDir === "asc" ? "ascending" : "descending"})
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading events...</div>
                </div>
              ) : paginatedEvents.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No events found</div>
                  <div className="text-gray-500">Try adjusting your search or filter</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("title", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Event <SortIcon active={eventSortKey === "title"} dir={eventSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                          <th
                            onClick={() => toggleSort("dept", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Department <SortIcon active={eventSortKey === "dept"} dir={eventSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("date", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Date <SortIcon active={eventSortKey === "date"} dir={eventSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("registrations", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Registrations <SortIcon active={eventSortKey === "registrations"} dir={eventSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedEvents.items.map((event) => {
                          const status = getEventStatus(event.event_date);
                          return (
                            <tr key={event.event_id} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">{event.title}</div>
                                <div className="text-xs text-gray-400 mt-0.5">ID: {event.event_id.slice(0, 8)}…</div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 font-medium">{event.organizing_dept}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(event.event_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                  {event.registration_count || 0}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-[140px] truncate">{event.created_by}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={`/edit/event/${event.event_id}`}
                                    className="px-3 py-1.5 bg-[#154CB3] text-white text-xs font-medium rounded-lg hover:bg-[#154cb3df] transition-colors"
                                  >
                                    Edit
                                  </a>
                                  <a
                                    href={`/event/${event.event_id}`}
                                    className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                  >
                                    View
                                  </a>
                                  <button
                                    onClick={() => setShowDeleteEventConfirm(event.event_id)}
                                    className="px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors"
                                  >
                                    Delete
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={eventPage}
                    totalPages={paginatedEvents.totalPages}
                    hasNext={paginatedEvents.hasNext}
                    hasPrev={paginatedEvents.hasPrev}
                    onNext={() => setEventPage(p => p + 1)}
                    onPrev={() => setEventPage(p => p - 1)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Fest Management Tab */}
        {activeTab === "fests" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Fests</label>
              <input
                type="text"
                placeholder="Search fests by title or department..."
                value={festSearchQuery}
                onChange={(e) => setFestSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
              />
              <div className="mt-3 text-sm text-gray-500">
                Showing <strong className="text-gray-700">{sortedFilteredFests.length}</strong> of{" "}
                <strong className="text-gray-700">{fests.length}</strong> fests
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading fests...</div>
                </div>
              ) : paginatedFests.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No fests found</div>
                  <div className="text-gray-500">Try adjusting your search</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("title", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Fest <SortIcon active={festSortKey === "title"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("dept", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Department <SortIcon active={festSortKey === "dept"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("date", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Opening Date <SortIcon active={festSortKey === "date"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("registrations", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Registrations <SortIcon active={festSortKey === "registrations"} dir={festSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedFests.items.map((fest) => (
                          <tr key={fest.fest_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{fest.fest_title}</div>
                              <div className="text-sm text-gray-500">ID: {fest.fest_id}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{fest.organizing_dept}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(fest.opening_date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-6 py-4">
                              <span className="inline-flex items-center px-3 py-1 rounded-md text-sm font-medium bg-blue-100 text-blue-800">
                                {fest.registration_count || 0} Registered
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{fest.created_by}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <a
                                  href={`/edit/fest/${fest.fest_id}`}
                                  className="px-4 py-2 bg-[#154CB3] text-white text-sm font-medium rounded-lg hover:bg-[#154cb3df] transition-colors"
                                >
                                  Edit
                                </a>
                                <a
                                  href={`/fest/${fest.fest_id}`}
                                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => setShowDeleteFestConfirm(fest.fest_id)}
                                  className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={festPage}
                    totalPages={paginatedFests.totalPages}
                    hasNext={paginatedFests.hasNext}
                    hasPrev={paginatedFests.hasPrev}
                    onNext={() => setFestPage(p => p + 1)}
                    onPrev={() => setFestPage(p => p - 1)}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && authToken && (
          <AdminNotifications
            authToken={authToken}
            users={users.map(u => ({ email: u.email, name: u.name }))}
            events={events.map(e => ({ event_id: e.event_id, title: e.title }))}
          />
        )}

        {/* Delete Modals */}
        {showDeleteUserConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete user <strong className="text-gray-900">{showDeleteUserConfirm}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteUserConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteUser(showDeleteUserConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteEventConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteEventConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteEvent(showDeleteEventConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteFestConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete this fest? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteFestConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteFest(showDeleteFestConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Fest
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
