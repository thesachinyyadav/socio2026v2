"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { assignRoleMatrixEntry, deleteUserAccount, getRolesAnalyticsData, updateUserAccess } from "./actions";
import DomainScopeModal, { type DomainScopeMode, type DomainSelection } from "./DomainScopeModal";
import type {
  RoleMatrixAssignableRole,
  RoleMatrixAssignment,
  RolesAnalytics,
  RolesPageData,
  UserAccessPayload,
  UserRoleRow,
} from "./types";

type RolesManagementTableProps = {
  initialData: RolesPageData;
};

type MatrixRole =
  | "organiser"
  | "student_organiser"
  | "volunteer"
  | "support"
  | "venue_manager"
  | "it_service"
  | "catering_vendors"
  | "stalls_misc"
  | "hod"
  | "dean"
  | "cfo"
  | "finance"
  | "master_admin";

type DomainModalState = {
  isOpen: boolean;
  role: DomainScopeMode;
  userId: string | number;
  userName: string;
  initialScopeValue: string | null;
  initialCampusValue: string | null;
};

const domainRoleSet = new Set<MatrixRole>(["venue_manager", "hod", "dean", "cfo"]);

const ROLE_CODE_MASTER_ADMIN = "MASTER_ADMIN";
const ROLE_CODE_HOD = "HOD";
const ROLE_CODE_DEAN = "DEAN";
const ROLE_CODE_CFO = "CFO";
const ROLE_CODE_ORGANIZER_TEACHER = "ORGANIZER_TEACHER";
const ROLE_CODE_ORGANIZER_STUDENT = "ORGANIZER_STUDENT";
const ROLE_CODE_ORGANIZER_VOLUNTEER = "ORGANIZER_VOLUNTEER";
const ROLE_CODE_SUPPORT = "SUPPORT";
const ROLE_CODE_FINANCE_OFFICER = "FINANCE_OFFICER";
const ROLE_CODE_ACCOUNTS = "ACCOUNTS";
const ROLE_CODE_SERVICE_IT = "SERVICE_IT";
const ROLE_CODE_SERVICE_VENUE = "SERVICE_VENUE";
const ROLE_CODE_SERVICE_CATERING = "SERVICE_CATERING";
const ROLE_CODE_SERVICE_STALLS = "SERVICE_STALLS";

type RoleOption = {
  value: RoleMatrixAssignableRole;
  label: string;
};

type MatrixEntry = {
  role: string;
  scope: string;
  campus: string;
  holder: string;
};

type MatrixTableRow = {
  role: string;
  scope: string;
  campus: string;
  holders: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

const ITEMS_PER_PAGE = 5;

const roleOptions: RoleOption[] = [
  { value: "hod", label: "HOD" },
  { value: "dean", label: "Dean" },
  { value: "cfo", label: "CFO" },
  { value: "organiser", label: "Organiser" },
  { value: "student_organiser", label: "Student Organizer" },
  { value: "volunteer", label: "Volunteer" },
  { value: "support", label: "Support" },
  { value: "finance_officer", label: "Finance Officer" },
  { value: "master_admin", label: "Master Admin" },
  { value: "it_service", label: "IT" },
  { value: "venue_service", label: "Venue" },
  { value: "catering_service", label: "Catering" },
  { value: "stalls_service", label: "Stall" },
];

const scopeRequiredRoles = new Set<RoleMatrixAssignableRole>([
  "hod",
  "dean",
  "venue_service",
  "catering_service",
  "stalls_service",
]);

const strictDropdownScopeRoles = new Set<RoleMatrixAssignableRole>(["hod", "dean"]);

const RolesAnalyticsPanel = dynamic(() => import("./RolesAnalyticsPanel"), {
  ssr: false,
  loading: () => (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
      Loading analytics...
    </div>
  ),
});

function isRoleAssignmentActive(assignment: RoleMatrixAssignment): boolean {
  if (!assignment || assignment.is_active === false) {
    return false;
  }

  const now = Date.now();
  const validFrom = assignment.valid_from ? new Date(assignment.valid_from).getTime() : null;
  const validUntil = assignment.valid_until ? new Date(assignment.valid_until).getTime() : null;

  if (Number.isFinite(validFrom) && Number(validFrom) > now) {
    return false;
  }

  if (Number.isFinite(validUntil) && Number(validUntil) <= now) {
    return false;
  }

  return true;
}

function buildMatrixRows(entries: MatrixEntry[]): MatrixTableRow[] {
  const grouped = new Map<
    string,
    {
      role: string;
      scope: string;
      campuses: Set<string>;
      holders: Set<string>;
    }
  >();

  entries.forEach((entry: MatrixEntry) => {
    const key = `${entry.role}::${entry.scope}`;

    if (!grouped.has(key)) {
      grouped.set(key, {
        role: entry.role,
        scope: entry.scope,
        campuses: new Set<string>(),
        holders: new Set<string>(),
      });
    }

    const bucket = grouped.get(key)!;
    if (entry.campus && entry.campus !== "-") {
      bucket.campuses.add(entry.campus);
    }
    bucket.holders.add(entry.holder);
  });

  return Array.from(grouped.values())
    .map((entry) => ({
      role: entry.role,
      scope: entry.scope,
      campus: entry.campuses.size > 0 ? Array.from(entry.campuses.values()).sort().join(", ") : "-",
      holders: entry.holders.size > 0 ? Array.from(entry.holders.values()).sort().join(", ") : "-",
    }))
    .sort((left, right) => {
      const byRole = left.role.localeCompare(right.role);
      if (byRole !== 0) {
        return byRole;
      }
      return left.scope.localeCompare(right.scope);
    });
}

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

function hasAnalyticsData(analytics: RolesAnalytics): boolean {
  return (
    analytics.totalEstimatedRevenue > 0 ||
    analytics.venueUtilizationRate > 0 ||
    analytics.averageApprovalSlaHours > 0 ||
    analytics.revenueByMonth.length > 0 ||
    analytics.venueUsage.length > 0 ||
    analytics.approvalSlaByMonth.length > 0
  );
}

const sameUserId = (left: string | number, right: string | number) => String(left) === String(right);

function isRoleEnabled(access: UserAccessPayload, role: MatrixRole): boolean {
  if (role === "organiser") {
    return access.is_organiser;
  }

  if (role === "student_organiser") {
    return access.is_student_organiser;
  }

  if (role === "volunteer") {
    return access.is_volunteer;
  }

  if (role === "support") {
    return access.is_support;
  }

  if (role === "venue_manager") {
    return access.is_venue_manager;
  }

  if (role === "it_service") {
    return access.is_it_service;
  }

  if (role === "catering_vendors") {
    return access.is_catering_vendors;
  }

  if (role === "stalls_misc") {
    return access.is_stalls_misc;
  }

  if (role === "hod") {
    return access.is_hod;
  }

  if (role === "dean") {
    return access.is_dean;
  }

  if (role === "cfo") {
    return access.is_cfo;
  }

  if (role === "finance") {
    return access.is_finance_officer;
  }

  return access.is_masteradmin;
}

function domainModeFromRole(role: MatrixRole): DomainScopeMode {
  if (role === "hod") {
    return "hod";
  }

  if (role === "dean") {
    return "dean";
  }

  if (role === "cfo") {
    return "cfo";
  }

  return "venue_manager";
}

function roleLabel(role: MatrixRole): string {
  if (role === "organiser") {
    return "Organiser";
  }
  if (role === "student_organiser") {
    return "Student Organizer";
  }
  if (role === "volunteer") {
    return "Volunteer";
  }
  if (role === "support") {
    return "Support";
  }
  if (role === "venue_manager") {
    return "Venue";
  }
  if (role === "it_service") {
    return "IT";
  }
  if (role === "catering_vendors") {
    return "Catering Vendors";
  }
  if (role === "stalls_misc") {
    return "Stalls/Misc";
  }
  if (role === "hod") {
    return "HOD";
  }
  if (role === "dean") {
    return "Dean";
  }
  if (role === "cfo") {
    return "CFO";
  }
  if (role === "finance") {
    return "Finance";
  }
  return "Master Admin";
}

function emptyModalState(): DomainModalState {
  return {
    isOpen: false,
    role: "hod",
    userId: "",
    userName: "",
    initialScopeValue: null,
    initialCampusValue: null,
  };
}

function buildNextAccessPayload(
  current: UserAccessPayload,
  role: MatrixRole,
  domainSelection?: DomainSelection | null
): UserAccessPayload {
  const next: UserAccessPayload = {
    ...current,
  };

  if (role === "organiser") {
    next.is_organiser = !current.is_organiser;
    return next;
  }

  if (role === "student_organiser") {
    next.is_student_organiser = !current.is_student_organiser;
    return next;
  }

  if (role === "volunteer") {
    next.is_volunteer = !current.is_volunteer;
    return next;
  }

  if (role === "support") {
    next.is_support = !current.is_support;
    return next;
  }

  if (role === "it_service") {
    next.is_it_service = !current.is_it_service;
    return next;
  }

  if (role === "catering_vendors") {
    next.is_catering_vendors = !current.is_catering_vendors;
    return next;
  }

  if (role === "stalls_misc") {
    next.is_stalls_misc = !current.is_stalls_misc;
    return next;
  }

  if (role === "finance") {
    next.is_finance_officer = !current.is_finance_officer;
    return next;
  }

  if (role === "master_admin") {
    next.is_masteradmin = !current.is_masteradmin;
    return next;
  }

  const shouldEnable = !isRoleEnabled(current, role);

  if (!shouldEnable) {
    next.is_hod = false;
    next.is_dean = false;
    next.is_cfo = false;
    next.is_venue_manager = false;
    return next;
  }

  next.is_hod = false;
  next.is_dean = false;
  next.is_cfo = false;
  next.is_venue_manager = false;
  next.department_id = null;
  next.school_id = null;
  next.campus = null;
  next.venue_id = null;

  const selectedScope = domainSelection?.scopeValue || null;
  const selectedCampus = domainSelection?.campusValue || null;

  if (role === "hod") {
    next.is_hod = true;
    next.department_id = selectedScope;
    next.campus = selectedCampus;
  }

  if (role === "dean") {
    next.is_dean = true;
    next.school_id = selectedScope;
    next.campus = selectedCampus;
  }

  if (role === "cfo") {
    next.is_cfo = true;
    next.campus = selectedScope || selectedCampus;
  }

  if (role === "venue_manager") {
    next.is_venue_manager = true;
    next.venue_id = selectedScope;
    next.campus = selectedCampus;
  }

  return next;
}

function domainValueForRole(access: UserAccessPayload, role: MatrixRole): DomainSelection {
  if (role === "hod") {
    return {
      scopeValue: access.department_id,
      campusValue: access.campus,
    };
  }

  if (role === "dean") {
    return {
      scopeValue: access.school_id,
      campusValue: access.campus,
    };
  }

  if (role === "cfo") {
    return {
      scopeValue: access.campus,
      campusValue: access.campus,
    };
  }

  if (role === "venue_manager") {
    return {
      scopeValue: access.venue_id,
      campusValue: access.campus,
    };
  }

  return {
    scopeValue: null,
    campusValue: null,
  };
}

function hasScopeOptions(data: RolesPageData, role: MatrixRole): boolean {
  if (role === "hod") {
    return data.departments.length > 0 && data.campuses.length > 0;
  }

  if (role === "dean") {
    return data.schools.length > 0 && data.campuses.length > 0;
  }

  if (role === "cfo") {
    return data.campuses.length > 0;
  }

  if (role === "venue_manager") {
    return data.venues.length > 0 && data.campuses.length > 0;
  }

  return true;
}

function roleMatrixScopeLabel(role: RoleMatrixAssignableRole): string {
  if (role === "hod") {
    return "Department";
  }
  if (role === "dean") {
    return "School";
  }
  if (role === "venue_service") {
    return "Venue";
  }
  if (role === "catering_service") {
    return "Shop";
  }
  if (role === "stalls_service") {
    return "Stall Scope";
  }
  return "Scope";
}

function roleMatrixScopeOptions(data: RolesPageData, role: RoleMatrixAssignableRole): Array<{ value: string; label: string }> {
  if (role === "hod") {
    return data.departments.map((department) => ({
      value: department.id,
      label: department.department_name,
    }));
  }

  if (role === "dean") {
    return data.schools.map((school) => ({
      value: school.id,
      label: school.name,
    }));
  }

  if (role === "venue_service") {
    return data.venues.map((venue) => ({
      value: venue.id,
      label: venue.campus ? `${venue.name} (${venue.campus})` : venue.name,
    }));
  }

  if (role === "catering_service") {
    return data.cateringShops.map((shop) => ({
      value: shop,
      label: shop,
    }));
  }

  if (role === "stalls_service") {
    return data.stallsScopes.map((scope) => ({
      value: scope,
      label: scope,
    }));
  }

  return [];
}

function resolveDomainSummary(user: UserRoleRow, data: RolesPageData): string {
  if (user.access.is_hod && user.access.department_id) {
    const department = data.departments.find((item) => item.id === user.access.department_id);
    return `HOD: ${department?.department_name || user.access.department_id}`;
  }

  if (user.access.is_dean && user.access.school_id) {
    return `Dean: ${user.access.school_id}`;
  }

  if (user.access.is_cfo && user.access.campus) {
    return `CFO: ${user.access.campus}`;
  }

  if (user.access.is_venue_manager && user.access.venue_id) {
    const venue = data.venues.find((item) => item.id === user.access.venue_id);
    return `Venue: ${venue?.name || user.access.venue_id}`;
  }

  return "-";
}

function ToggleCell({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={onChange}
        aria-label={label}
        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-300"
      />
      <span className={`text-xs font-semibold ${checked ? "text-emerald-700" : "text-slate-400"}`}>
        {checked ? "On" : "Off"}
      </span>
    </label>
  );
}

function PaginationControls({
  currentPage,
  totalPages,
  hasNext,
  hasPrev,
  onNext,
  onPrev,
  totalItems,
}: {
  currentPage: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
  totalItems?: number;
}) {
  return (
    <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
        {totalItems !== undefined && <span className="ml-2 text-gray-400">({totalItems} total items)</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            hasPrev
              ? "border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            hasNext ? "bg-[#154CB3] text-white hover:bg-[#154cb3df]" : "cursor-not-allowed bg-gray-100 text-gray-400"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default function RolesManagementTable({ initialData }: RolesManagementTableProps) {
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"users" | "assignments" | "analytics">("users");
  const [data, setData] = useState<RolesPageData>(initialData);
  const [users, setUsers] = useState<UserRoleRow[]>(initialData.users);
  const [searchText, setSearchText] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [campusFilter, setCampusFilter] = useState("all");
  const [pendingDeleteUserId, setPendingDeleteUserId] = useState<string | number | null>(null);
  const [pendingUpdateUserId, setPendingUpdateUserId] = useState<string | number | null>(null);
  const [userPage, setUserPage] = useState(1);
  const [assignmentPage, setAssignmentPage] = useState(1);
  const [assignmentEmail, setAssignmentEmail] = useState("");
  const [assignmentCampus, setAssignmentCampus] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<RoleMatrixAssignableRole>("hod");
  const [assignmentScope, setAssignmentScope] = useState("");
  const [domainModal, setDomainModal] = useState<DomainModalState>(emptyModalState());
  const [pendingModalRole, setPendingModalRole] = useState<MatrixRole | null>(null);
  const [isAnalyticsLoading, setIsAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [hasLoadedAnalytics, setHasLoadedAnalytics] = useState(() => hasAnalyticsData(initialData.analytics));
  const [isPending, startTransition] = useTransition();

  const userById = useMemo(() => {
    return new Map(users.map((user) => [String(user.id), user]));
  }, [users]);

  const departmentNameById = useMemo(() => {
    return new Map(data.departments.map((department) => [department.id, department.department_name]));
  }, [data.departments]);

  const scopeOptions = useMemo(() => {
    return roleMatrixScopeOptions(data, assignmentRole);
  }, [data, assignmentRole]);

  const matrixSections = useMemo(() => {
    const entries: MatrixEntry[] = [];
    const assignmentUserRoleKeys = new Set<string>();

    const resolveHolder = (userId: string) => {
      const user = userById.get(String(userId));
      if (!user) {
        return `Unknown (${userId})`;
      }
      return `${user.name || "Unnamed User"} (${user.email})`;
    };

    const activeAssignments = data.roleAssignments.filter((assignment) => isRoleAssignmentActive(assignment));

    activeAssignments.forEach((assignment) => {
      const roleCodeRaw = String(assignment.role_code || "").toUpperCase();
      const roleCode =
        roleCodeRaw === ROLE_CODE_ACCOUNTS ? ROLE_CODE_FINANCE_OFFICER : roleCodeRaw;
      const holder = resolveHolder(assignment.user_id);
      const campus = assignment.campus_scope || "-";
      const roleKey = `${roleCode}:${assignment.user_id}`;
      const assignedUser = userById.get(String(assignment.user_id));
      assignmentUserRoleKeys.add(roleKey);

      if (roleCode === ROLE_CODE_HOD) {
        if (assignedUser && !assignedUser.access.is_hod) {
          return;
        }
        const scopeId = assignment.department_scope || "-";
        entries.push({
          role: "HOD",
          scope: departmentNameById.get(scopeId) || scopeId,
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_DEAN) {
        if (assignedUser && !assignedUser.access.is_dean) {
          return;
        }
        entries.push({
          role: "Dean",
          scope: assignment.department_scope || "-",
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_CFO) {
        if (assignedUser && !assignedUser.access.is_cfo) {
          return;
        }
        const scope = assignment.campus_scope || "-";
        entries.push({
          role: "CFO",
          scope,
          campus: scope,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_SERVICE_VENUE) {
        if (assignedUser && !assignedUser.access.is_venue_manager) {
          return;
        }
        entries.push({
          role: "Venue",
          scope: assignment.department_scope || "Venue Queue",
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_SERVICE_IT) {
        if (assignedUser && !assignedUser.access.is_it_service) {
          return;
        }
        entries.push({
          role: "IT",
          scope: assignment.department_scope || "Global Queue",
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_SERVICE_CATERING) {
        if (assignedUser && !assignedUser.access.is_catering_vendors) {
          return;
        }
        entries.push({
          role: "Catering",
          scope: assignment.department_scope || "General",
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_SERVICE_STALLS) {
        if (assignedUser && !assignedUser.access.is_stalls_misc) {
          return;
        }
        entries.push({
          role: "Stall",
          scope: assignment.department_scope || "General",
          campus,
          holder,
        });
      }

      if (roleCode === ROLE_CODE_ORGANIZER_TEACHER) {
        if (assignedUser && !assignedUser.access.is_organiser) {
          return;
        }
        entries.push({ role: "Organiser", scope: "Global", campus, holder });
      }

      if (roleCode === ROLE_CODE_ORGANIZER_STUDENT) {
        if (assignedUser && !assignedUser.access.is_student_organiser) {
          return;
        }
        entries.push({ role: "Student Organizer", scope: "Global", campus, holder });
      }

      if (roleCode === ROLE_CODE_ORGANIZER_VOLUNTEER) {
        if (assignedUser && !assignedUser.access.is_volunteer) {
          return;
        }
        entries.push({ role: "Volunteer", scope: "Global", campus, holder });
      }

      if (roleCode === ROLE_CODE_SUPPORT) {
        if (assignedUser && !assignedUser.access.is_support) {
          return;
        }
        entries.push({ role: "Support", scope: "Global", campus, holder });
      }

      if (roleCode === ROLE_CODE_FINANCE_OFFICER) {
        if (assignedUser && !assignedUser.access.is_finance_officer) {
          return;
        }
        entries.push({ role: "Finance Officer", scope: "Global", campus, holder });
      }

      if (roleCode === ROLE_CODE_MASTER_ADMIN) {
        if (assignedUser && !assignedUser.access.is_masteradmin) {
          return;
        }
        entries.push({ role: "Master Admin", scope: "Global", campus, holder });
      }
    });

    users.forEach((user) => {
      const holder = `${user.name || "Unnamed User"} (${user.email})`;
      const userId = String(user.id);

      if (user.access.is_hod && !assignmentUserRoleKeys.has(`${ROLE_CODE_HOD}:${userId}`)) {
        const scopeId = user.access.department_id || "-";
        entries.push({
          role: "HOD",
          scope: departmentNameById.get(scopeId) || scopeId,
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_dean && !assignmentUserRoleKeys.has(`${ROLE_CODE_DEAN}:${userId}`)) {
        entries.push({
          role: "Dean",
          scope: user.access.school_id || "-",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_cfo && !assignmentUserRoleKeys.has(`${ROLE_CODE_CFO}:${userId}`)) {
        const scope = user.access.campus || "-";
        entries.push({
          role: "CFO",
          scope,
          campus: scope,
          holder,
        });
      }

      if (user.access.is_venue_manager && !assignmentUserRoleKeys.has(`${ROLE_CODE_SERVICE_VENUE}:${userId}`)) {
        entries.push({
          role: "Venue",
          scope: user.access.venue_id || "Venue Queue",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_organiser && !assignmentUserRoleKeys.has(`${ROLE_CODE_ORGANIZER_TEACHER}:${userId}`)) {
        entries.push({
          role: "Organiser",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_student_organiser && !assignmentUserRoleKeys.has(`${ROLE_CODE_ORGANIZER_STUDENT}:${userId}`)) {
        entries.push({
          role: "Student Organizer",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_volunteer && !assignmentUserRoleKeys.has(`${ROLE_CODE_ORGANIZER_VOLUNTEER}:${userId}`)) {
        entries.push({
          role: "Volunteer",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_support && !assignmentUserRoleKeys.has(`${ROLE_CODE_SUPPORT}:${userId}`)) {
        entries.push({
          role: "Support",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_it_service && !assignmentUserRoleKeys.has(`${ROLE_CODE_SERVICE_IT}:${userId}`)) {
        entries.push({
          role: "IT",
          scope: "Global Queue",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_catering_vendors && !assignmentUserRoleKeys.has(`${ROLE_CODE_SERVICE_CATERING}:${userId}`)) {
        entries.push({
          role: "Catering",
          scope: "General",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_stalls_misc && !assignmentUserRoleKeys.has(`${ROLE_CODE_SERVICE_STALLS}:${userId}`)) {
        entries.push({
          role: "Stall",
          scope: "General",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_finance_officer && !assignmentUserRoleKeys.has(`${ROLE_CODE_FINANCE_OFFICER}:${userId}`)) {
        entries.push({
          role: "Finance Officer",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }

      if (user.access.is_masteradmin && !assignmentUserRoleKeys.has(`${ROLE_CODE_MASTER_ADMIN}:${userId}`)) {
        entries.push({
          role: "Master Admin",
          scope: "Global",
          campus: user.access.campus || "-",
          holder,
        });
      }
    });

    const rows = buildMatrixRows(entries);

    return {
      academic: rows.filter((row) => row.role === "HOD" || row.role === "Dean" || row.role === "CFO"),
    };
  }, [data.departments, data.roleAssignments, departmentNameById, userById, users]);

  const activeAssignments = useMemo(
    () => data.roleAssignments.filter((assignment) => isRoleAssignmentActive(assignment)),
    [data.roleAssignments]
  );

  const domainRoleHolders = useMemo(() => {
    return users.filter(
      (user) => user.access.is_hod || user.access.is_dean || user.access.is_cfo || user.access.is_venue_manager
    ).length;
  }, [users]);

  const pendingScopeIssues = useMemo(() => {
    return users.filter((user) => {
      if (user.access.is_hod) {
        return !user.access.department_id || !user.access.campus;
      }
      if (user.access.is_dean) {
        return !user.access.school_id || !user.access.campus;
      }
      if (user.access.is_cfo) {
        return !user.access.campus;
      }
      if (user.access.is_venue_manager) {
        return !user.access.venue_id || !user.access.campus;
      }
      return false;
    }).length;
  }, [users]);

  const hasRole = (user: UserRoleRow, normalizedRoleFilter: string) => {
    if (normalizedRoleFilter === "hod") return user.access.is_hod;
    if (normalizedRoleFilter === "dean") return user.access.is_dean;
    if (normalizedRoleFilter === "cfo") return user.access.is_cfo;
    if (normalizedRoleFilter === "organiser") return user.access.is_organiser;
    if (normalizedRoleFilter === "support") return user.access.is_support;
    if (normalizedRoleFilter === "finance") return user.access.is_finance_officer;
    if (normalizedRoleFilter === "master_admin") return user.access.is_masteradmin;
    if (normalizedRoleFilter === "venue") return user.access.is_venue_manager;
    return true;
  };

  const userRoleTags = (user: UserRoleRow): string[] => {
    const tags: string[] = [];
    if (user.access.is_hod) tags.push("HOD");
    if (user.access.is_dean) tags.push("DEAN");
    if (user.access.is_cfo) tags.push("CFO");
    if (user.access.is_finance_officer) tags.push("FINANCE");
    if (user.access.is_masteradmin) tags.push("ADMIN");
    if (user.access.is_organiser) tags.push("ORG");
    if (user.access.is_support) tags.push("SUPPORT");
    if (user.access.is_venue_manager) tags.push("VENUE");
    if (user.access.is_it_service) tags.push("IT");
    if (user.access.is_catering_vendors) tags.push("CATERING");
    if (user.access.is_stalls_misc) tags.push("STALLS");
    return tags;
  };

  const filteredUsers = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    const normalizedRoleFilter = roleFilter.trim().toLowerCase();
    const normalizedCampusFilter = campusFilter.trim().toLowerCase();

    return users.filter((user) => {
      const matchesSearch =
        !normalized ||
        (user.name || "").toLowerCase().includes(normalized) ||
        user.email.toLowerCase().includes(normalized);

      const matchesRole =
        normalizedRoleFilter === "all" || hasRole(user, normalizedRoleFilter);

      const matchesCampus =
        normalizedCampusFilter === "all" ||
        String(user.campus || "").trim().toLowerCase() === normalizedCampusFilter;

      return (
        matchesSearch && matchesRole && matchesCampus
      );
    });
  }, [users, searchText, roleFilter, campusFilter]);

  const filteredAssignmentRows = useMemo(() => {
    const normalized = searchText.trim().toLowerCase();
    if (!normalized) {
      return activeAssignments;
    }

    return activeAssignments.filter((assignment) => {
      const user = userById.get(String(assignment.user_id));
      return (
        String(assignment.role_code || "").toLowerCase().includes(normalized) ||
        String(assignment.campus_scope || "").toLowerCase().includes(normalized) ||
        String(assignment.department_scope || "").toLowerCase().includes(normalized) ||
        String(user?.email || "").toLowerCase().includes(normalized) ||
        String(user?.name || "").toLowerCase().includes(normalized)
      );
    });
  }, [activeAssignments, searchText, userById]);

  const assignmentPagination = useMemo<PaginationState>(() => {
    const totalItems = filteredAssignmentRows.length;
    const totalPages = Math.max(Math.ceil(totalItems / ITEMS_PER_PAGE), 1);
    const page = Math.min(assignmentPage, totalPages);

    return {
      page,
      pageSize: ITEMS_PER_PAGE,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }, [filteredAssignmentRows.length, assignmentPage]);

  const paginatedAssignmentRows = useMemo(() => {
    const startIndex = (assignmentPagination.page - 1) * assignmentPagination.pageSize;
    return filteredAssignmentRows.slice(startIndex, startIndex + assignmentPagination.pageSize);
  }, [filteredAssignmentRows, assignmentPagination.page, assignmentPagination.pageSize]);

  const userPagination = useMemo<PaginationState>(() => {
    const totalItems = filteredUsers.length;
    const totalPages = Math.max(Math.ceil(totalItems / ITEMS_PER_PAGE), 1);
    const page = Math.min(userPage, totalPages);

    return {
      page,
      pageSize: ITEMS_PER_PAGE,
      totalItems,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }, [filteredUsers.length, userPage]);

  const paginatedUsers = useMemo(() => {
    const startIndex = (userPagination.page - 1) * userPagination.pageSize;
    return filteredUsers.slice(startIndex, startIndex + userPagination.pageSize);
  }, [filteredUsers, userPagination.page, userPagination.pageSize]);

  useEffect(() => {
    setUserPage(1);
    setAssignmentPage(1);
  }, [searchText, roleFilter, campusFilter]);

  useEffect(() => {
    if (userPagination.page !== userPage) {
      setUserPage(userPagination.page);
    }
  }, [userPagination.page, userPage]);

  useEffect(() => {
    if (assignmentPagination.page !== assignmentPage) {
      setAssignmentPage(assignmentPagination.page);
    }
  }, [assignmentPagination.page, assignmentPage]);

  const copyUserEmailToAssignment = async (email: string) => {
    const normalized = String(email || "").trim();
    if (!normalized) {
      return;
    }

    setAssignmentEmail(normalized);

    try {
      await navigator.clipboard.writeText(normalized);
      toast.success("Email copied and prefilled in assignment panel.");
    } catch {
      toast.success("Email prefilled in assignment panel.");
    }
  };

  const loadAnalytics = async (force = false) => {
    if (isAnalyticsLoading) {
      return;
    }

    if (!force && hasLoadedAnalytics) {
      return;
    }

    setAnalyticsError(null);
    setIsAnalyticsLoading(true);

    try {
      const analytics = await getRolesAnalyticsData();
      setData((previous) => ({
        ...previous,
        analytics,
      }));
      setHasLoadedAnalytics(true);
    } catch (error: any) {
      const message = error?.message || "Failed to load analytics.";
      setAnalyticsError(message);
      toast.error(message);
    } finally {
      setIsAnalyticsLoading(false);
    }
  };

  const runAccessUpdate = (
    user: UserRoleRow,
    nextAccess: UserAccessPayload,
    successMessage: string,
    changedRole?: MatrixRole
  ) => {
    setPendingUpdateUserId(user.id);

    startTransition(async () => {
      const response = await updateUserAccess(user.id, nextAccess, changedRole);
      setPendingUpdateUserId(null);

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) =>
        previous.map((row) => (sameUserId(row.id, user.id) ? response.user : row))
      );

      setData((previous) => ({
        ...previous,
        users: previous.users.map((row) => (sameUserId(row.id, user.id) ? response.user : row)),
      }));

      toast.success(successMessage);
    });
  };

  const handleAssignRoleMatrix = () => {
    const normalizedEmail = assignmentEmail.trim();
    const normalizedCampus = assignmentCampus.trim();

    if (!normalizedEmail) {
      toast.error("Enter a user email.");
      return;
    }

    if (!normalizedCampus) {
      toast.error("Select a campus.");
      return;
    }

    const requiresScope = scopeRequiredRoles.has(assignmentRole);
    if (requiresScope && !assignmentScope.trim()) {
      toast.error(`Select ${roleMatrixScopeLabel(assignmentRole)}.`);
      return;
    }

    startTransition(async () => {
      const response = await assignRoleMatrixEntry({
        email: normalizedEmail,
        campus: normalizedCampus,
        role: assignmentRole,
        scopeValue: requiresScope ? assignmentScope.trim() : null,
      });

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setData((previous) => ({
        ...previous,
        users: response.data.users,
        roleAssignments: response.data.roleAssignments,
        campuses: Array.from(
          new Set(
            [...previous.campuses, ...response.data.users.map((user) => String(user.campus || "").trim())]
              .filter((campus) => campus.length > 0)
          )
        ),
      }));
      setUsers(response.data.users);
      setAssignmentScope("");

      if (activeTab === "analytics") {
        void loadAnalytics(true);
      }

      toast.success(response.message);
    });
  };

  const handleRoleToggle = (user: UserRoleRow, role: MatrixRole) => {
    const currentlyEnabled = isRoleEnabled(user.access, role);

    if (domainRoleSet.has(role) && !currentlyEnabled) {
      if (!hasScopeOptions(data, role)) {
        toast.error(`No scope options available for ${roleLabel(role)}.`);
        return;
      }

      const mode = domainModeFromRole(role);
      setPendingModalRole(role);
      setDomainModal({
        isOpen: true,
        role: mode,
        userId: user.id,
        userName: user.name || user.email,
        initialScopeValue: domainValueForRole(user.access, role).scopeValue,
        initialCampusValue: domainValueForRole(user.access, role).campusValue,
      });
      return;
    }

    const nextAccess = buildNextAccessPayload(user.access, role);
    runAccessUpdate(user, nextAccess, `${roleLabel(role)} access updated.`, role);
  };

  const handleDomainConfirm = (selection: DomainSelection) => {
    if (!domainModal.isOpen || !pendingModalRole) {
      return;
    }

    const user = users.find((row) => sameUserId(row.id, domainModal.userId));
    if (!user) {
      setDomainModal(emptyModalState());
      setPendingModalRole(null);
      toast.error("User not found for role update.");
      return;
    }

    const nextAccess = buildNextAccessPayload(user.access, pendingModalRole, selection);
    setDomainModal(emptyModalState());
    setPendingModalRole(null);
    runAccessUpdate(user, nextAccess, `${roleLabel(pendingModalRole)} access updated.`, pendingModalRole);
  };

  const requestDelete = (user: UserRoleRow) => {
    const proceed = window.confirm(`Delete ${user.email}? This cannot be undone.`);
    if (!proceed) {
      return;
    }

    setPendingDeleteUserId(user.id);

    startTransition(async () => {
      const response = await deleteUserAccount(user.id);
      setPendingDeleteUserId(null);

      if (!response.ok) {
        toast.error(response.error);
        return;
      }

      setUsers((previous) => previous.filter((row) => !sameUserId(row.id, user.id)));
      setData((previous) => ({
        ...previous,
        users: previous.users.filter((row) => !sameUserId(row.id, user.id)),
      }));
      toast.success("User deleted successfully.");
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Role Matrix</h2>
          <p className="mt-1 text-sm text-slate-600">Manage scoped roles and user access across all campuses.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.refresh()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Refresh
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Export
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Total Users</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{users.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Active Assignments</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{activeAssignments.length}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Pending Scope Issues</p>
          <p className="mt-2 text-3xl font-black text-rose-600">{pendingScopeIssues}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Domain Role Holders</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{domainRoleHolders}</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="rounded-t-2xl border-b border-slate-200 bg-slate-100 px-5 py-4">
            <h3 className="text-lg font-bold text-slate-900">Assignment Panel</h3>
            <p className="mt-1 text-xs text-slate-600">Create new scoped user permissions</p>
          </div>
          <div className="space-y-4 p-5">
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">User Email</span>
              <input
                type="email"
                value={assignmentEmail}
                onChange={(event) => setAssignmentEmail(event.target.value)}
                placeholder="e.g. alex.smith@christuniversity.in"
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Role Profile</span>
              <select
                value={assignmentRole}
                onChange={(event) => {
                  setAssignmentRole(event.target.value as RoleMatrixAssignableRole);
                  setAssignmentScope("");
                }}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                {roleOptions.map((roleOption) => (
                  <option key={roleOption.value} value={roleOption.value}>
                    {roleOption.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Campus</span>
              <select
                value={assignmentCampus}
                onChange={(event) => setAssignmentCampus(event.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
              >
                <option value="">Select campus</option>
                {data.campuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))}
              </select>
            </label>

            {scopeRequiredRoles.has(assignmentRole) && (
              <label className="block space-y-2">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {roleMatrixScopeLabel(assignmentRole)}
                </span>
                {(scopeOptions.length > 0 || strictDropdownScopeRoles.has(assignmentRole)) ? (
                  <select
                    value={assignmentScope}
                    onChange={(event) => setAssignmentScope(event.target.value)}
                    disabled={scopeOptions.length === 0}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    <option value="">Select {roleMatrixScopeLabel(assignmentRole)}</option>
                    {scopeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={assignmentScope}
                    onChange={(event) => setAssignmentScope(event.target.value)}
                    placeholder={`Enter ${roleMatrixScopeLabel(assignmentRole).toLowerCase()}`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  />
                )}
              </label>
            )}

            <button
              type="button"
              disabled={isPending}
              onClick={handleAssignRoleMatrix}
              className="w-full rounded-lg bg-[#154CB3] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#154cb3df] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {isPending ? "Assigning..." : "Assign Role"}
            </button>
            <button
              type="button"
              onClick={() => {
                setAssignmentEmail("");
                setAssignmentCampus("");
                setAssignmentScope("");
              }}
              className="w-full rounded-lg bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-300"
            >
              Clear Fields
            </button>
          </div>
        </aside>

        <section className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveTab("users")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "users"
                    ? "bg-[#154CB3] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Users
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("assignments")}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "assignments"
                    ? "bg-[#154CB3] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Role Assignments
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("analytics");
                  void loadAnalytics();
                }}
                className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                  activeTab === "analytics"
                    ? "bg-[#154CB3] text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Analytics
              </button>
            </div>
          </div>

          {(activeTab === "users" || activeTab === "assignments") && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  type="text"
                  value={searchText}
                  onChange={(event) => setSearchText(event.target.value)}
                  placeholder={activeTab === "users" ? "Filter by name or email..." : "Search assignments..."}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                />
                {activeTab === "users" && (
                  <>
                    <select
                      value={roleFilter}
                      onChange={(event) => setRoleFilter(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="all">All Roles</option>
                      <option value="hod">HOD</option>
                      <option value="dean">Dean</option>
                      <option value="cfo">CFO</option>
                      <option value="organiser">Organiser</option>
                      <option value="support">Support</option>
                      <option value="finance">Finance Officer</option>
                      <option value="master_admin">Master Admin</option>
                      <option value="venue">Venue</option>
                    </select>
                    <select
                      value={campusFilter}
                      onChange={(event) => setCampusFilter(event.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-200"
                    >
                      <option value="all">All Campuses</option>
                      {data.campuses.map((campus) => (
                        <option key={campus} value={campus}>
                          {campus}
                        </option>
                      ))}
                    </select>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === "users" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Name & Email</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Campus</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Role Tags</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Updated</th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((user) => {
                      const isUpdating = pendingUpdateUserId !== null && sameUserId(pendingUpdateUserId, user.id);
                      const isDeleting = pendingDeleteUserId !== null && sameUserId(pendingDeleteUserId, user.id);
                      const disabled = isPending || isUpdating || isDeleting;

                      return (
                        <tr key={`${user.id}-${user.email}`} className="border-t border-slate-200 align-top">
                          <td className="px-4 py-4">
                            <p className="text-sm font-semibold text-slate-900">{user.name || "Unnamed User"}</p>
                            <button
                              type="button"
                              onClick={() => copyUserEmailToAssignment(user.email)}
                              className="text-left text-xs text-[#154CB3] underline-offset-2 transition hover:underline"
                              title="Copy email and prefill assignment panel"
                            >
                              {user.email}
                            </button>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-700">
                            <p>{user.campus || "-"}</p>
                            <p className="text-xs text-slate-500">{resolveDomainSummary(user, data)}</p>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-1.5">
                              {userRoleTags(user).map((tag) => (
                                <span
                                  key={`${user.id}-${tag}`}
                                  className="rounded-full bg-[#154CB3]/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#154CB3]"
                                >
                                  {tag}
                                </span>
                              ))}
                              {userRoleTags(user).length === 0 && (
                                <span className="text-xs text-slate-400">No active tags</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-slate-600">{formatDate(user.created_at)}</td>
                          <td className="px-4 py-4">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleRoleToggle(user, "hod")}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                HOD
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleRoleToggle(user, "dean")}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                DEAN
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => handleRoleToggle(user, "cfo")}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                CFO
                              </button>
                              <button
                                type="button"
                                disabled={disabled}
                                onClick={() => requestDelete(user)}
                                className="rounded-md border border-rose-200 px-2.5 py-1 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:cursor-not-allowed disabled:bg-slate-100"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {filteredUsers.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                          No users matched your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredUsers.length > 0 && (
                <PaginationControls
                  currentPage={userPagination.page}
                  totalPages={userPagination.totalPages}
                  hasNext={userPagination.hasNext}
                  hasPrev={userPagination.hasPrev}
                  onNext={() => setUserPage((previous) => previous + 1)}
                  onPrev={() => setUserPage((previous) => previous - 1)}
                  totalItems={userPagination.totalItems}
                />
              )}
            </div>
          )}

          {activeTab === "assignments" && (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full border-collapse">
                  <thead className="bg-slate-100 text-left">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">User</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Role Code</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Department Scope</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Campus Scope</th>
                      <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-slate-600">Valid From</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedAssignmentRows.map((assignment) => {
                      const user = userById.get(String(assignment.user_id));
                      return (
                        <tr
                          key={`${assignment.user_id}-${assignment.role_code}-${assignment.valid_from || ""}`}
                          className="border-t border-slate-200"
                        >
                          <td className="px-4 py-3 text-sm text-slate-700">{user?.email || assignment.user_id}</td>
                          <td className="px-4 py-3 text-sm font-semibold text-slate-900">{assignment.role_code}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{assignment.department_scope || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-700">{assignment.campus_scope || "-"}</td>
                          <td className="px-4 py-3 text-sm text-slate-600">{formatDate(assignment.valid_from)}</td>
                        </tr>
                      );
                    })}

                    {filteredAssignmentRows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-4 py-12 text-center text-sm font-medium text-slate-500">
                          No assignments matched your search.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {filteredAssignmentRows.length > 0 && (
                <PaginationControls
                  currentPage={assignmentPagination.page}
                  totalPages={assignmentPagination.totalPages}
                  hasNext={assignmentPagination.hasNext}
                  hasPrev={assignmentPagination.hasPrev}
                  onNext={() => setAssignmentPage((previous) => previous + 1)}
                  onPrev={() => setAssignmentPage((previous) => previous - 1)}
                  totalItems={assignmentPagination.totalItems}
                />
              )}
            </div>
          )}

          {activeTab === "analytics" && (
            <RolesAnalyticsPanel analytics={data.analytics} isLoading={isAnalyticsLoading} error={analyticsError} />
          )}
        </section>
      </div>

      <DomainScopeModal
        isOpen={domainModal.isOpen}
        mode={domainModal.role}
        userName={domainModal.userName}
        departments={data.departments}
        schools={data.schools}
        campuses={data.campuses}
        venues={data.venues}
        initialScopeValue={domainModal.initialScopeValue}
        initialCampusValue={domainModal.initialCampusValue}
        onCancel={() => {
          setDomainModal(emptyModalState());
          setPendingModalRole(null);
        }}
        onConfirm={handleDomainConfirm}
      />
    </div>
  );
}
