"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import DomainScopeModal from "./DomainScopeModal";
import { deleteUserAccount, updateUserRoles } from "./actions";
import type { RolesPageData, RolesPayload, UserRoleRow } from "./types";

type RolesManagementTableProps = {
  initialData: RolesPageData;
};

type DomainModalState = {
  isOpen: boolean;
  mode: "hod" | "dean";
  previousDraft: RolesPayload | null;
};

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

const mapRowToDraft = (row: UserRoleRow): RolesPayload => ({
  isOrganiser: Boolean(row.is_organiser),
  isSupport: Boolean(row.is_support),
  isMasterAdmin: Boolean(row.is_masteradmin),
  isHod: Boolean(row.is_hod),
  isDean: Boolean(row.is_dean),
  department_id: row.department_id,
  school_id: row.school_id,
});

const statusClass = (enabled: boolean) =>
  enabled ? "text-emerald-600" : "text-slate-500";

function RoleToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <label className="inline-flex items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        className="h-4 w-4 rounded border-slate-300 accent-emerald-600 disabled:cursor-not-allowed"
      />
      <span className={`text-xs font-semibold ${statusClass(checked)}`}>
        {checked ? "Enabled" : "Disabled"}
      </span>
    </label>
  );
}

export default function RolesManagementTable({ initialData }: RolesManagementTableProps) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRoleRow[]>(initialData.users);
  const [searchText, setSearchText] = useState("");
  const [editingUserId, setEditingUserId] = useState<string | number | null>(null);
  const [draftRoles, setDraftRoles] = useState<RolesPayload | null>(null);
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | number | null>(null);
  const [modalState, setModalState] = useState<DomainModalState>({
    isOpen: false,
    mode: "hod",
    previousDraft: null,
  });

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

  const currentEditingUser = useMemo(
    () => users.find((row) => sameUserId(row.id, editingUserId || "")) || null,
    [users, editingUserId]
  );

  const beginEdit = (user: UserRoleRow) => {
    setEditingUserId(user.id);
    setDraftRoles(mapRowToDraft(user));
  };

  const cancelEdit = () => {
    setEditingUserId(null);
    setDraftRoles(null);
    setModalState({ isOpen: false, mode: "hod", previousDraft: null });
  };

  const toggleSimpleRole = (key: "isOrganiser" | "isSupport" | "isMasterAdmin") => {
    setDraftRoles((previous) => {
      if (!previous) {
        return previous;
      }

      return {
        ...previous,
        [key]: !previous[key],
      };
    });
  };

  const enableHodRole = () => {
    if (initialData.departments.length === 0) {
      toast.error("No departments available for HOD assignment.");
      return;
    }

    setDraftRoles((previous) => {
      if (!previous) {
        return previous;
      }

      const snapshot = { ...previous };
      const nextDraft: RolesPayload = {
        ...previous,
        isHod: true,
        isDean: false,
        school_id: null,
      };

      setModalState({
        isOpen: true,
        mode: "hod",
        previousDraft: snapshot,
      });

      return nextDraft;
    });
  };

  const enableDeanRole = () => {
    if (initialData.schools.length === 0) {
      toast.error("No schools available for Dean assignment.");
      return;
    }

    setDraftRoles((previous) => {
      if (!previous) {
        return previous;
      }

      const snapshot = { ...previous };
      const nextDraft: RolesPayload = {
        ...previous,
        isDean: true,
        isHod: false,
        department_id: null,
      };

      setModalState({
        isOpen: true,
        mode: "dean",
        previousDraft: snapshot,
      });

      return nextDraft;
    });
  };

  const toggleHod = () => {
    if (!draftRoles) {
      return;
    }

    if (draftRoles.isHod) {
      setDraftRoles({
        ...draftRoles,
        isHod: false,
        department_id: null,
      });
      return;
    }

    enableHodRole();
  };

  const toggleDean = () => {
    if (!draftRoles) {
      return;
    }

    if (draftRoles.isDean) {
      setDraftRoles({
        ...draftRoles,
        isDean: false,
        school_id: null,
      });
      return;
    }

    enableDeanRole();
  };

  const handleDomainCancel = () => {
    if (modalState.previousDraft) {
      setDraftRoles(modalState.previousDraft);
    }

    setModalState({ isOpen: false, mode: "hod", previousDraft: null });
  };

  const handleDomainConfirm = (selectedValue: string) => {
    if (!selectedValue) {
      toast.error("Select a value before continuing.");
      return;
    }

    setDraftRoles((previous) => {
      if (!previous) {
        return previous;
      }

      if (modalState.mode === "hod") {
        return {
          ...previous,
          department_id: selectedValue,
          school_id: null,
          isHod: true,
          isDean: false,
        };
      }

      return {
        ...previous,
        school_id: selectedValue,
        department_id: null,
        isDean: true,
        isHod: false,
      };
    });

    setModalState({ isOpen: false, mode: "hod", previousDraft: null });
  };

  const saveRoles = (userId: string | number) => {
    if (!draftRoles) {
      return;
    }

    startTransition(async () => {
      const response = await updateUserRoles(userId, draftRoles);

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) =>
        previous.map((row) =>
          sameUserId(row.id, userId) ? response.user : row
        )
      );

      toast.success("Roles updated successfully.");
      cancelEdit();
      router.refresh();
    });
  };

  const requestDelete = (user: UserRoleRow) => {
    const proceed = window.confirm(
      `Delete ${user.email}? This cannot be undone.`
    );

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

      setUsers((previous) =>
        previous.filter((row) => !sameUserId(row.id, user.id))
      );
      setPendingDeleteUserId(null);
      toast.success("User deleted successfully.");
      router.refresh();
    });
  };

  const resolveDepartmentName = (departmentId: string | null) => {
    if (!departmentId) {
      return "No department selected";
    }

    return (
      initialData.departments.find((row) => row.id === departmentId)
        ?.department_name || "Unknown department"
    );
  };

  const resolveSchoolName = (schoolId: string | null) => {
    if (!schoolId) {
      return "No school selected";
    }

    return (
      initialData.schools.find((row) => row.id === schoolId)?.name ||
      schoolId ||
      "Unknown school"
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900">User Role Matrix</h2>
            <p className="mt-1 text-sm text-slate-600">
              Toggle roles with domain scoping for HOD and Dean.
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
          <table className="min-w-[1200px] w-full border-collapse">
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
                  ORGANISER
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  SUPPORT
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  HOD
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  DEAN
                </th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">
                  MASTER ADMIN
                </th>
                <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => {
                const isEditing = editingUserId !== null && sameUserId(editingUserId, user.id);
                const roles = isEditing && draftRoles ? draftRoles : mapRowToDraft(user);

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
                      <RoleToggle
                        checked={roles.isOrganiser}
                        disabled={!isEditing || isPending}
                        onChange={() => toggleSimpleRole("isOrganiser")}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <RoleToggle
                        checked={roles.isSupport}
                        disabled={!isEditing || isPending}
                        onChange={() => toggleSimpleRole("isSupport")}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <RoleToggle
                        checked={roles.isHod}
                        disabled={!isEditing || isPending || roles.isDean}
                        onChange={toggleHod}
                      />
                      {roles.isHod && (
                        <p className="mt-1 text-xs text-slate-500">
                          {resolveDepartmentName(roles.department_id || null)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <RoleToggle
                        checked={roles.isDean}
                        disabled={!isEditing || isPending || roles.isHod}
                        onChange={toggleDean}
                      />
                      {roles.isDean && (
                        <p className="mt-1 text-xs text-slate-500">
                          {resolveSchoolName(roles.school_id || null)}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <RoleToggle
                        checked={roles.isMasterAdmin}
                        disabled={!isEditing || isPending}
                        onChange={() => toggleSimpleRole("isMasterAdmin")}
                      />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              disabled={isPending}
                              onClick={() => saveRoles(user.id)}
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
                              {pendingDeleteUserId !== null &&
                              sameUserId(pendingDeleteUserId, user.id)
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

      <DomainScopeModal
        isOpen={modalState.isOpen}
        mode={modalState.mode}
        userName={currentEditingUser?.name || currentEditingUser?.email || "this user"}
        departments={initialData.departments}
        schools={initialData.schools}
        initialValue={
          modalState.mode === "hod"
            ? draftRoles?.department_id || null
            : draftRoles?.school_id || null
        }
        onCancel={handleDomainCancel}
        onConfirm={handleDomainConfirm}
      />
    </div>
  );
}
