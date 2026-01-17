"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const ITEMS_PER_PAGE = 20;

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

export default function MasterAdminPage() {
  const { userData, isMasterAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "events" | "fests">("dashboard");
  
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
  
  // Fest management state
  const [fests, setFests] = useState<Fest[]>([]);
  const [filteredFests, setFilteredFests] = useState<Fest[]>([]);
  const [festSearchQuery, setFestSearchQuery] = useState("");
  const [showDeleteFestConfirm, setShowDeleteFestConfirm] = useState<string | null>(null);
  const [festPage, setFestPage] = useState(1);
  
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

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
    }
  }, [activeTab, isMasterAdmin, authToken]);

  useEffect(() => {
    let filtered = users;

    if (userSearchQuery) {
      const query = userSearchQuery.toLowerCase();
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
  }, [users, userSearchQuery, roleFilter]);

  useEffect(() => {
    let filtered = events;

    if (eventSearchQuery) {
      const query = eventSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.organizing_dept?.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
    setEventPage(1);
  }, [events, eventSearchQuery]);

  useEffect(() => {
    let filtered = fests;

    if (festSearchQuery) {
      const query = festSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (fest) =>
          fest.fest_title.toLowerCase().includes(query) ||
          fest.organizing_dept?.toLowerCase().includes(query)
      );
    }

    setFilteredFests(filtered);
    setFestPage(1);
  }, [fests, festSearchQuery]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([fetchUsers(), fetchEvents(), fetchFests()]);
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
      alert("Failed to load users. Check console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/api/events`);
      if (!response.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await response.json();
      setEvents(data.events || []);
    } catch (error) {
      console.error("Error fetching events:", error);
      alert("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFests = async () => {
    try {
      setIsLoading(true);
      
      const [festsResponse, registrationsResponse] = await Promise.all([
        fetch(`${API_URL}/api/fests`),
        fetch(`${API_URL}/api/registrations`)
      ]);

      if (!festsResponse.ok) {
        throw new Error("Failed to fetch fests");
      }

      const festsData = await festsResponse.json();
      const festsList = festsData.fests || festsData || [];

      // Get registration counts if available
      let registrationCounts: Record<string, number> = {};
      if (registrationsResponse.ok) {
        const regData = await registrationsResponse.json();
        // Count registrations by fest_id
        if (regData.registrations) {
          regData.registrations.forEach((reg: any) => {
            if (reg.fest_id) {
              registrationCounts[reg.fest_id] = (registrationCounts[reg.fest_id] || 0) + 1;
            }
          });
        }
      }

      // Add registration counts to fests
      const festsWithCounts = festsList.map((fest: Fest) => ({
        ...fest,
        registration_count: registrationCounts[fest.fest_id] || 0
      }));

      setFests(festsWithCounts);
    } catch (error) {
      console.error("Error fetching fests:", error);
      alert("Failed to load fests");
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
      alert("Roles updated successfully");
    } catch (error: any) {
      console.error("Error updating roles:", error);
      alert(error.message || "Failed to update roles");
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
      alert("User deleted successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(error.message || "Failed to delete user");
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
      alert("Event deleted successfully");
    } catch (error: any) {
      console.error("Error deleting event:", error);
      alert(error.message || "Failed to delete event");
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
      alert("Fest deleted successfully");
    } catch (error: any) {
      console.error("Error deleting fest:", error);
      alert(error.message || "Failed to delete fest");
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
    onPrev 
  }: { 
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
  }) => (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
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
              ? "bg-blue-600 text-white hover:bg-blue-700"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );

  const paginatedUsers = paginateArray(filteredUsers, userPage);
  const paginatedEvents = paginateArray(filteredEvents, eventPage);
  const paginatedFests = paginateArray(filteredFests, festPage);

  if (authLoading || !authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
        {/* Header */}
        <div className="mb-8">
          <div className="bg-white border-b border-gray-200 rounded-lg p-6 shadow-sm">
            <h1 className="text-3xl font-bold text-gray-900 mb-1">Master Admin Panel</h1>
            <p className="text-gray-600">System management and oversight</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm mb-6 overflow-hidden border border-gray-200">
          <div className="flex border-b border-gray-200 overflow-x-auto">
            {[
              { id: "dashboard", label: "Dashboard" },
              { id: "users", label: "User Management" },
              { id: "events", label: "Event Management" },
              { id: "fests", label: "Fest Management" }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-6 py-4 font-medium transition-all whitespace-nowrap ${
                  activeTab === tab.id
                    ? "border-b-2 border-blue-600 text-blue-600 bg-blue-50"
                    : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Users</h3>
                <p className="text-4xl font-bold text-gray-900 mb-4">{users.length}</p>
                <div className="space-y-2 text-sm text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span>Organisers:</span>
                    <span className="font-semibold text-gray-900">{users.filter(u => u.is_organiser).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Support:</span>
                    <span className="font-semibold text-gray-900">{users.filter(u => u.is_support).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Admins:</span>
                    <span className="font-semibold text-gray-900">{users.filter(u => u.is_masteradmin).length}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Events</h3>
                <p className="text-4xl font-bold text-gray-900 mb-4">{events.length}</p>
                <button
                  onClick={() => setActiveTab("events")}
                  className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors font-medium"
                >
                  View all events
                </button>
              </div>

              <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">Total Fests</h3>
                <p className="text-4xl font-bold text-gray-900 mb-4">{fests.length}</p>
                <div className="text-sm text-gray-600 border-t border-gray-100 pt-3">
                  <div className="flex justify-between">
                    <span>Registrations:</span>
                    <span className="font-semibold text-gray-900">{fests.reduce((sum, f) => sum + (f.registration_count || 0), 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-bold mb-4 text-gray-900">Quick Actions</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { tab: "users", title: "Manage Users", desc: "Edit roles, permissions, and delete users" },
                  { tab: "events", title: "Manage Events", desc: "View, edit, or delete any event" },
                  { tab: "fests", title: "Manage Fests", desc: "View, edit, or delete any fest" },
                  { href: "/manage", title: "View Manage Page", desc: "See all events and fests in one place" }
                ].map((action, idx) => (
                  action.tab ? (
                    <button
                      key={idx}
                      onClick={() => setActiveTab(action.tab as any)}
                      className="p-5 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left"
                    >
                      <div className="font-semibold text-gray-900 text-base mb-1">{action.title}</div>
                      <div className="text-sm text-gray-600">{action.desc}</div>
                    </button>
                  ) : (
                    <a
                      key={idx}
                      href={action.href}
                      className="p-5 border border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all text-left block"
                    >
                      <div className="font-semibold text-gray-900 text-base mb-1">{action.title}</div>
                      <div className="text-sm text-gray-600">{action.desc}</div>
                    </a>
                  )
                ))}
              </div>
            </div>
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
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Role
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                  >
                    <option value="all">All Users ({users.length})</option>
                    <option value="organiser">Organisers ({users.filter((u) => u.is_organiser).length})</option>
                    <option value="support">Support ({users.filter((u) => u.is_support).length})</option>
                    <option value="masteradmin">Master Admins ({users.filter((u) => u.is_masteradmin).length})</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            User
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
                                      className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_organiser ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_organiser ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_organiser && isEditing && (
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={displayRoles.organiser_expires_at?.split('T')[0] || ""}
                                        onChange={(e) =>
                                          handleExpirationChange(
                                            "organiser_expires_at",
                                            e.target.value ? new Date(e.target.value).toISOString() : null
                                          )
                                        }
                                        className="text-xs px-3 py-1.5 border-2 border-gray-200 rounded-lg focus:border-blue-500"
                                      />
                                      <button
                                        onClick={() => handleExpirationChange("organiser_expires_at", null)}
                                        className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
                                      >
                                        Always
                                      </button>
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
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={displayRoles.support_expires_at?.split('T')[0] || ""}
                                        onChange={(e) =>
                                          handleExpirationChange(
                                            "support_expires_at",
                                            e.target.value ? new Date(e.target.value).toISOString() : null
                                          )
                                        }
                                        className="text-xs px-3 py-1.5 border-2 border-gray-200 rounded-lg focus:border-green-500"
                                      />
                                      <button
                                        onClick={() => handleExpirationChange("support_expires_at", null)}
                                        className="text-xs text-green-600 hover:text-green-700 font-semibold"
                                      >
                                        Always
                                      </button>
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
                                    <div className="flex items-center gap-2">
                                      <input
                                        type="date"
                                        value={displayRoles.masteradmin_expires_at?.split('T')[0] || ""}
                                        onChange={(e) =>
                                          handleExpirationChange(
                                            "masteradmin_expires_at",
                                            e.target.value ? new Date(e.target.value).toISOString() : null
                                          )
                                        }
                                        className="text-xs px-3 py-1.5 border-2 border-gray-200 rounded-lg focus:border-red-500"
                                      />
                                      <button
                                        onClick={() => handleExpirationChange("masteradmin_expires_at", null)}
                                        className="text-xs text-red-600 hover:text-red-700 font-semibold"
                                      >
                                        Always
                                      </button>
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
                                        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <input
                type="text"
                placeholder="Search events by title or department..."
                value={eventSearchQuery}
                onChange={(e) => setEventSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading events...</div>
                </div>
              ) : paginatedEvents.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No events found</div>
                  <div className="text-gray-500">Try adjusting your search</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Event</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {paginatedEvents.items.map((event) => (
                          <tr key={event.event_id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-gray-900">{event.title}</div>
                              <div className="text-sm text-gray-500">ID: {event.event_id}</div>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 font-medium">{event.organizing_dept}</td>
                            <td className="px-6 py-4 text-sm text-gray-600">
                              {new Date(event.event_date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600">{event.created_by}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <a
                                  href={`/edit/event/${event.event_id}`}
                                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
                                >
                                  Edit
                                </a>
                                <a
                                  href={`/event/${event.event_id}`}
                                  className="px-4 py-2 bg-gray-600 text-white text-sm font-medium rounded-lg hover:bg-gray-700 transition-colors"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => setShowDeleteEventConfirm(event.event_id)}
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
              <input
                type="text"
                placeholder="Search fests by title or department..."
                value={festSearchQuery}
                onChange={(e) => setFestSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              />
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
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
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Fest</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Department</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Opening Date</th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Registrations</th>
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
                                  className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
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
