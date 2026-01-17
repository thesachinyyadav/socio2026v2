"use client";

import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";

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

export default function MasterAdminPage() {
  const { userData, isMasterAdmin, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  // Redirect if not master admin
  useEffect(() => {
    if (!authLoading && !isMasterAdmin) {
      router.push("/");
    }
  }, [authLoading, isMasterAdmin, router]);

  // Fetch users
  useEffect(() => {
    if (!isMasterAdmin) return;
    
    fetchUsers();
  }, [isMasterAdmin]);

  // Filter users based on search and role
  useEffect(() => {
    let filtered = users;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (user) =>
          user.email.toLowerCase().includes(query) ||
          user.name?.toLowerCase().includes(query)
      );
    }

    // Apply role filter
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
  }, [users, searchQuery, roleFilter]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem("authToken");
      
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (error) {
      console.error("Error fetching users:", error);
      alert("Failed to load users");
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
      const token = localStorage.getItem("authToken");
      
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}/roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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

      // Update local state
      setUsers((prev) =>
        prev.map((u) => (u.email === user.email ? user : u))
      );
      setEditingUser(null);
      alert("Roles updated successfully");
    } catch (error: any) {
      console.error("Error updating roles:", error);
      alert(error.message || "Failed to update roles");
    }
  };

  const deleteUser = async (email: string) => {
    try {
      const token = localStorage.getItem("authToken");
      
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      // Remove from local state
      setUsers((prev) => prev.filter((u) => u.email !== email));
      setShowDeleteConfirm(null);
      alert("User deleted successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      alert(error.message || "Failed to delete user");
    }
  };

  if (authLoading || isLoading) {
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
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-2">🔐 Master Admin Panel</h1>
        <p className="text-gray-600">Manage all users and their roles</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search Users
            </label>
            <input
              type="text"
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Role Filter */}
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
              <option value="organiser">
                Organisers ({users.filter((u) => u.is_organiser).length})
              </option>
              <option value="support">
                Support ({users.filter((u) => u.is_support).length})
              </option>
              <option value="masteradmin">
                Master Admins ({users.filter((u) => u.is_masteradmin).length})
              </option>
            </select>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
                    {/* User Info */}
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="font-medium text-gray-900">{user.name}</div>
                        <div className="text-sm text-gray-500">{user.email}</div>
                      </div>
                    </td>

                    {/* Organiser Role */}
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

                    {/* Support Role */}
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

                    {/* Master Admin Role */}
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

                    {/* Actions */}
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
                              onClick={() => setShowDeleteConfirm(user.email)}
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
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Confirm Delete</h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete user <strong>{showDeleteConfirm}</strong>?
              This action cannot be undone.
            </p>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteUser(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Delete User
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
