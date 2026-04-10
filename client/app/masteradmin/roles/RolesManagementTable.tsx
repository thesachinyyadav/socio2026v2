"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { assignRoleAction, deleteUserAccount } from "./actions";
import type { AssignableRole, RolesPageData, UserRoleRow } from "./types";

type RolesManagementTableProps = {
  initialData: RolesPageData;
};

type AssignmentDraft = {
  role: AssignableRole;
  domainId: string | null;
};

const ROLE_OPTIONS: Array<{ value: AssignableRole; label: string }> = [
  { value: "HOD", label: "HOD" },
  { value: "DEAN", label: "DEAN" },
  { value: "CFO", label: "CFO" },
  { value: "FINANCE_OFFICER", label: "FINANCE_OFFICER" },
];

const formatDate = (value: string | null) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const sameUserId = (left: string | number, right: string | number) =>
  String(left) === String(right);

function normalizeRoleKey(
  rawRole: string | null,
  flags: { is_hod: boolean; is_dean: boolean }
): "hod" | "dean" | "cfo" | "finance_officer" | null {
  const normalized = String(rawRole || "").trim().toLowerCase();
  if (
    normalized === "hod" ||
    normalized === "dean" ||
    normalized === "cfo" ||
    normalized === "finance_officer"
  ) {
    return normalized;
  }

  if (flags.is_hod) {
    return "hod";
  }

  if (flags.is_dean) {
    return "dean";
  }

  return null;
}

function roleKeyToAssignable(roleKey: "hod" | "dean" | "cfo" | "finance_officer" | null): AssignableRole {
  if (roleKey === "hod") {
    return "HOD";
  }

  if (roleKey === "dean") {
    return "DEAN";
  }

  if (roleKey === "cfo") {
    return "CFO";
  }

  return "FINANCE_OFFICER";
}

function roleNeedsDomain(role: AssignableRole): boolean {
  return role === "HOD" || role === "DEAN" || role === "CFO";
}

function assignmentFromUser(user: UserRoleRow, data: RolesPageData): AssignmentDraft {
  const roleKey = normalizeRoleKey(user.university_role, {
    is_hod: user.is_hod,
    is_dean: user.is_dean,
  });
  const role = roleKeyToAssignable(roleKey);

  if (role === "HOD") {
    return {
      role,
      domainId: user.department_id || data.departments[0]?.id || null,
    };
  }

  if (role === "DEAN") {
    return {
      role,
      domainId: user.school_id || data.schools[0]?.id || null,
    };
  }

  if (role === "CFO") {
    return {
      role,
      domainId: user.campus || data.campuses[0] || null,
    };
  }

  return {
    role,
    domainId: null,
  };
}

export default function RolesManagementTable({ initialData }: RolesManagementTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRoleRow[]>(initialData.users);
  const [searchText, setSearchText] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null);
  const [draft, setDraft] = useState<AssignmentDraft | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | number | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return users;
    }

    return users.filter((user) => {
      return (
        (user.name || "").toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized)
      );
    });
  }, [users, searchText]);

  const beginEdit = (user: UserRoleRow) => {
    setEditingUserId(user.id);
    setDraft(assignmentFromUser(user, initialData));
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setDraft(null);
  };

  const resolveDepartmentName = (departmentId: string | null) => {
    if (!departmentId) {
      return "-";
    }

    return (
      initialData.departments.find((row) => row.id === departmentId)?.department_name ||
      departmentId
    );
  };

  const resolveSchoolName = (schoolId: string | null) => {
    if (!schoolId) {
      return "-";
    }

    return initialData.schools.find((row) => row.id === schoolId)?.name || schoolId;
  };

  const getDefaultDomainForRole = (role: AssignableRole): string | null => {
    if (role === "HOD") {
      return initialData.departments[0]?.id || null;
    }

    if (role === "DEAN") {
      return initialData.schools[0]?.id || null;
    }

    if (role === "CFO") {
      return initialData.campuses[0] || null;
    }

    return null;
  };

  const handleRoleChange = (nextRole: AssignableRole) => {
    setDraft((previous) => {
      if (!previous) {
        return previous;
      }

      const nextDomain = roleNeedsDomain(nextRole)
        ? previous.role === nextRole
          ? previous.domainId
          : getDefaultDomainForRole(nextRole)
        : null;

      return {
        role: nextRole,
        domainId: nextDomain,
      };
    });
  };

  const saveAssignment = (userId: string | number) => {
    if (!draft) {
      return;
    }

    if (roleNeedsDomain(draft.role) && !String(draft.domainId || "").trim()) {
      toast.error("Please select a scope before saving.");
      return;
    }

    startTransition(async () => {
      const response = await assignRoleAction(userId, draft.role, draft.domainId);

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) =>
        previous.map((row) => (sameUserId(row.id, userId) ? response.user : row))
      );

      toast.success("Role assignment updated.");
      cancelEdit();
      router.refresh();
    });
  };

  const requestDelete = (user: UserRoleRow) => {
    const proceed = window.confirm(`Delete ${user.email}? This cannot be undone.`);
    if (!proceed) {
      return;
    }

    setPendingDeleteUserId(user.id);

    startTransition(async () => {
      const response = await deleteUserAccount(user.id);

      if (!response.ok) {
        toast.error(response.error);
        setPendingDeleteUserId(null);
        return;
      }

      setUsers((previous) => previous.filter((row) => !sameUserId(row.id, user.id)));
      setPendingDeleteUserId(null);
      toast.success("User deleted successfully.");
      router.refresh();
    });
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">User Role Matrix</h2>
            <p className="mt-1 text-sm text-slate-600">
              Assign HOD, DEAN, CFO, or FINANCE_OFFICER with strict domain scoping.
            </p>
          </div>

          <div className="w-full md:w-80">
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Search name or email"
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
            />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[1500px] w-full border-collapse">
            <thead className="bg-slate-100/80 text-left">
              <tr>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Name
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Email
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Joined Date
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  HOD
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  DEAN
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  CFO
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  FINANCE OFFICER
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  Assignment Form
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const roleKey = normalizeRoleKey(user.university_role, {
                  is_hod: user.is_hod,
                  is_dean: user.is_dean,
                });
                const isHod = roleKey === "hod";
                const isDean = roleKey === "dean";
                const isCfo = roleKey === "cfo";
                const isFinance = roleKey === "finance_officer";
                const isEditing = editingUserId !== null && sameUserId(editingUserId, user.id);

                return (
                  <tr key={`${user.id}-${user.email}`} className="border-t border-slate-200 align-top">
                    <td className="px-4 py-4">
                      <span className="text-sm font-semibold text-slate-900">{user.name || "Unnamed User"}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{user.email}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-sm text-slate-700">{formatDate(user.created_at)}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isHod ? "text-emerald-700" : "text-slate-400"}`}>
                        {isHod ? resolveDepartmentName(user.department_id) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isDean ? "text-sky-700" : "text-slate-400"}`}>
                        {isDean ? resolveSchoolName(user.school_id) : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isCfo ? "text-amber-700" : "text-slate-400"}`}>
                        {isCfo ? user.campus || "Unassigned campus" : "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`text-sm font-medium ${isFinance ? "text-violet-700" : "text-slate-400"}`}>
                        {isFinance ? "Global" : "-"}
                      </span>
                    </td>

                    <td className="px-4 py-4">
                      {isEditing && draft ? (
                        <div className="space-y-2">
                          <div>
                            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                              Role Select
                            </label>
                            <select
                              value={draft.role}
                              onChange={(event) => handleRoleChange(event.target.value as AssignableRole)}
                              disabled={isPending}
                              aria-label="Role Select"
                              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                            >
                              {ROLE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          {draft.role === "HOD" && (
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Department Select
                              </label>
                              <select
                                value={draft.domainId || ""}
                                onChange={(event) =>
                                  setDraft((previous) =>
                                    previous
                                      ? { ...previous, domainId: event.target.value || null }
                                      : previous
                                  )
                                }
                                disabled={isPending}
                                aria-label="Department Select"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              >
                                {initialData.departments.map((department) => (
                                  <option key={department.id} value={department.id}>
                                    {department.department_name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {draft.role === "DEAN" && (
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                School Select
                              </label>
                              <select
                                value={draft.domainId || ""}
                                onChange={(event) =>
                                  setDraft((previous) =>
                                    previous
                                      ? { ...previous, domainId: event.target.value || null }
                                      : previous
                                  )
                                }
                                disabled={isPending}
                                aria-label="School Select"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              >
                                {initialData.schools.map((school) => (
                                  <option key={school.id} value={school.id}>
                                    {school.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {draft.role === "CFO" && (
                            <div>
                              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                                Campus Select
                              </label>
                              <select
                                value={draft.domainId || ""}
                                onChange={(event) =>
                                  setDraft((previous) =>
                                    previous
                                      ? { ...previous, domainId: event.target.value || null }
                                      : previous
                                  )
                                }
                                disabled={isPending}
                                aria-label="Campus Select"
                                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                              >
                                {initialData.campuses.map((campus) => (
                                  <option key={campus} value={campus}>
                                    {campus}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {draft.role === "FINANCE_OFFICER" && (
                            <div className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                              Global Platform Access
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Click Edit to assign role</span>
                      )}
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => saveAssignment(user.id)}
                              className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={cancelEdit}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => beginEdit(user)}
                              className="rounded-lg bg-sky-700 px-3 py-2 text-xs font-semibold text-white transition hover:bg-sky-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => requestDelete(user)}
                              className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                            >
                              {pendingDeleteUserId !== null && sameUserId(pendingDeleteUserId, user.id)
                                ? "Deleting..."
                                : "Delete"}
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredUsers.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-12 text-center text-sm font-medium text-slate-500"
                  >
                    No users matched your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
