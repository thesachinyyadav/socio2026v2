"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
  department: string;
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
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);
  
  // Event management state
  const [events, setEvents] = useState<Event[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<Event[]>([]);
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState<string | null>(null);
  
  // Fest management state
  const [fests, setFests] = useState<Fest[]>([]);
  const [filteredFests, setFilteredFests] = useState<Fest[]>([]);
  const [festSearchQuery, setFestSearchQuery] = useState("");
  const [showDeleteFestConfirm, setShowDeleteFestConfirm] = useState<string | null>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(null);

  // Get auth token from Supabase
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

  // Redirect if not master admin
  useEffect(() => {
    if (!authLoading && !isMasterAdmin) {
      router.push("/");
    }
  }, [authLoading, isMasterAdmin, router]);

  // Load data when tab changes
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

  // Filter users
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
  }, [users, userSearchQuery, roleFilter]);

  // Filter events
  useEffect(() => {
    let filtered = events;

    if (eventSearchQuery) {
      const query = eventSearchQuery.toLowerCase();
      filtered = filtered.filter(
        (event) =>
          event.title.toLowerCase().includes(query) ||
          event.department?.toLowerCase().includes(query)
      );
    }

    setFilteredEvents(filtered);
  }, [events, eventSearchQuery]);

  // Filter fests
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
      
      const response = await fetch(`${API_URL}/api/fests`);
      if (!response.ok) {
        throw new Error("Failed to fetch fests");
      }

      const data = await response.json();
      setFests(data.fests || data || []);
    } catch (error) {
      console.error("Error fetching fests:", error);
      alert("Failed to load fests");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleToggle = (user: User, role: "is_organiser" | "is_support" | "is_masteradmin") => {
    setEditingUser({
      ...user,
      [role]: !user[role],
    });
  };

  const handleExpirationChange = (
    user: User,
    field: "organiser_expires_at" | "support_expires_at" | "masteradmin_expires_at",
    value: string | null
  ) => {
    setEditingUser({
      ...user,
      [field]: value,
    });
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
          is_organiser: user.is_organiser,
          organiser_expires_at: user.organiser_expires_at || null,
          is_support: user.is_support,
          support_expires_at: user.support_expires_at || null,
          is_masteradmin: user.is_masteradmin,
          masteradmin_expires_at: user.masteradmin_expires_at || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update roles");
      }

      setUsers((prev) => prev.map((u) => (u.email === user.email ? user : u)));
      setEditingUser(null);
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

  if (authLoading || !authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">Master Admin Panel</h1>
        <p className="text-gray-600">Complete system management and control</p>
      </div>

      <div className="bg-white rounded-lg shadow-md mb-6">
        <div className="flex border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === "dashboard"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Dashboard
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === "users"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab("events")}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === "events"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Event Management
          </button>
          <button
            onClick={() => setActiveTab("fests")}
            className={`px-6 py-4 font-medium transition-colors whitespace-nowrap ${
              activeTab === "fests"
                ? "border-b-2 border-blue-600 text-blue-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Fest Management
          </button>
        </div>
      </div>

      {activeTab === "dashboard" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Users</h3>
              <p className="text-3xl font-bold text-gray-900">{users.length}</p>
              <div className="mt-4 text-sm text-gray-600">
                <div>Organisers: {users.filter(u => u.is_organiser).length}</div>
                <div>Support: {users.filter(u => u.is_support).length}</div>
                <div>Master Admins: {users.filter(u => u.is_masteradmin).length}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Events</h3>
              <p className="text-3xl font-bold text-gray-900">{events.length}</p>
              <div className="mt-4">
                <button
                  onClick={() => setActiveTab("events")}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all events
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Total Fests</h3>
              <p className="text-3xl font-bold text-gray-900">{fests.length}</p>
              <div className="mt-4">
                <button
                  onClick={() => setActiveTab("fests")}
                  className="text-sm text-blue-600 hover:underline"
                >
                  View all fests
                </button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">Quick Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <button
                onClick={() => setActiveTab("users")}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
              >
                <div className="font-semibold">Manage Users</div>
                <div className="text-sm text-gray-600">Edit roles, permissions, and delete users</div>
              </button>
              <button
                onClick={() => setActiveTab("events")}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
              >
                <div className="font-semibold">Manage Events</div>
                <div className="text-sm text-gray-600">View, edit, or delete any event</div>
              </button>
              <button
                onClick={() => setActiveTab("fests")}
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left"
              >
                <div className="font-semibold">Manage Fests</div>
                <div className="text-sm text-gray-600">View, edit, or delete any fest</div>
              </button>
              <a
                href="/manage"
                className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-600 hover:bg-blue-50 transition-all text-left block"
              >
                <div className="font-semibold">View Manage Page</div>
                <div className="text-sm text-gray-600">See all events and fests in one place</div>
              </a>
            </div>
          </div>
        </div>
      )}

      {activeTab === "users" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Filter by Role
                </label>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Users ({users.length})</option>
                  <option value="organiser">Organisers ({users.filter((u) => u.is_organiser).length})</option>
                  <option value="support">Support ({users.filter((u) => u.is_support).length})</option>
                  <option value="masteradmin">Master Admins ({users.filter((u) => u.is_masteradmin).length})</option>
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading users...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Organiser
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Support
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Master Admin
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                          No users found
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.email} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="flex flex-col">
                              <div className="font-medium text-gray-900">{user.name}</div>
                              <div className="text-sm text-gray-500">{user.email}</div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editingUser?.email === user.email ? editingUser.is_organiser : user.is_organiser}
                                  onChange={() => handleRoleToggle(user, "is_organiser")}
                                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                                />
                                <span className="text-sm">Enabled</span>
                              </label>
                              {(editingUser?.email === user.email ? editingUser.is_organiser : user.is_organiser) && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={
                                      (editingUser?.email === user.email ? editingUser.organiser_expires_at : user.organiser_expires_at)?.split('T')[0] || ""
                                    }
                                    onChange={(e) =>
                                      handleExpirationChange(
                                        editingUser || user,
                                        "organiser_expires_at",
                                        e.target.value ? new Date(e.target.value).toISOString() : null
                                      )
                                    }
                                    className="text-xs px-2 py-1 border rounded"
                                  />
                                  <button
                                    onClick={() =>
                                      handleExpirationChange(editingUser || user, "organiser_expires_at", null)
                                    }
                                    className="text-xs text-blue-600 hover:underline"
                                  >
                                    Always
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editingUser?.email === user.email ? editingUser.is_support : user.is_support}
                                  onChange={() => handleRoleToggle(user, "is_support")}
                                  className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                />
                                <span className="text-sm">Enabled</span>
                              </label>
                              {(editingUser?.email === user.email ? editingUser.is_support : user.is_support) && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={
                                      (editingUser?.email === user.email ? editingUser.support_expires_at : user.support_expires_at)?.split('T')[0] || ""
                                    }
                                    onChange={(e) =>
                                      handleExpirationChange(
                                        editingUser || user,
                                        "support_expires_at",
                                        e.target.value ? new Date(e.target.value).toISOString() : null
                                      )
                                    }
                                    className="text-xs px-2 py-1 border rounded"
                                  />
                                  <button
                                    onClick={() =>
                                      handleExpirationChange(editingUser || user, "support_expires_at", null)
                                    }
                                    className="text-xs text-green-600 hover:underline"
                                  >
                                    Always
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={editingUser?.email === user.email ? editingUser.is_masteradmin : user.is_masteradmin}
                                  onChange={() => handleRoleToggle(user, "is_masteradmin")}
                                  className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                                />
                                <span className="text-sm">Enabled</span>
                              </label>
                              {(editingUser?.email === user.email ? editingUser.is_masteradmin : user.is_masteradmin) && (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="date"
                                    value={
                                      (editingUser?.email === user.email ? editingUser.masteradmin_expires_at : user.masteradmin_expires_at)?.split('T')[0] || ""
                                    }
                                    onChange={(e) =>
                                      handleExpirationChange(
                                        editingUser || user,
                                        "masteradmin_expires_at",
                                        e.target.value ? new Date(e.target.value).toISOString() : null
                                      )
                                    }
                                    className="text-xs px-2 py-1 border rounded"
                                  />
                                  <button
                                    onClick={() =>
                                      handleExpirationChange(editingUser || user, "masteradmin_expires_at", null)
                                    }
                                    className="text-xs text-red-600 hover:underline"
                                  >
                                    Always
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right space-x-2">
                            {editingUser?.email === user.email ? (
                              <>
                                <button
                                  onClick={() => saveRoleChanges(editingUser)}
                                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => setEditingUser(null)}
                                  className="px-4 py-2 bg-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-400"
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => setEditingUser(user)}
                                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700"
                                >
                                  Edit
                                </button>
                                {user.email !== userData?.email && (
                                  <button
                                    onClick={() => setShowDeleteUserConfirm(user.email)}
                                    className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                                  >
                                    Delete
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "events" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <input
              type="text"
              placeholder="Search events by title or department..."
              value={eventSearchQuery}
              onChange={(e) => setEventSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading events...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Event</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredEvents.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No events found</td>
                      </tr>
                    ) : (
                      filteredEvents.map((event) => (
                        <tr key={event.event_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{event.title}</div>
                            <div className="text-sm text-gray-500">ID: {event.event_id}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{event.department}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(event.event_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{event.created_by}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <a
                              href={`/edit/event/${event.event_id}`}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 inline-block"
                            >
                              Edit
                            </a>
                            <a
                              href={`/event/${event.event_id}`}
                              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 inline-block"
                            >
                              View
                            </a>
                            <button
                              onClick={() => setShowDeleteEventConfirm(event.event_id)}
                              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "fests" && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-md p-6">
            <input
              type="text"
              placeholder="Search fests by title or department..."
              value={festSearchQuery}
              onChange={(e) => setFestSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            {isLoading ? (
              <div className="p-8 text-center text-gray-500">Loading fests...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fest</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Department</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Opening Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created By</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {filteredFests.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No fests found</td>
                      </tr>
                    ) : (
                      filteredFests.map((fest) => (
                        <tr key={fest.fest_id} className="hover:bg-gray-50">
                          <td className="px-6 py-4">
                            <div className="font-medium text-gray-900">{fest.fest_title}</div>
                            <div className="text-sm text-gray-500">ID: {fest.fest_id}</div>
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fest.organizing_dept}</td>
                          <td className="px-6 py-4 text-sm text-gray-600">
                            {new Date(fest.opening_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{fest.created_by}</td>
                          <td className="px-6 py-4 text-right space-x-2">
                            <a
                              href={`/edit/fest/${fest.fest_id}`}
                              className="px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 inline-block"
                            >
                              Edit
                            </a>
                            <a
                              href={`/fest/${fest.fest_id}`}
                              className="px-4 py-2 bg-gray-600 text-white text-sm rounded-lg hover:bg-gray-700 inline-block"
                            >
                              View
                            </a>
                            <button
                              onClick={() => setShowDeleteFestConfirm(fest.fest_id)}
                              className="px-4 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showDeleteUserConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete user <strong>{showDeleteUserConfirm}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteUserConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(showDeleteUserConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteEventConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this event? This action cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteEventConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteEvent(showDeleteEventConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Event
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteFestConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this fest? This action cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteFestConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteFest(showDeleteFestConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete Fest
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
