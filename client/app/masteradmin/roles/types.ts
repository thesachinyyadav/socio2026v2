export type UserRoleRow = {
  id: string | number;
  name: string | null;
  email: string;
  created_at: string | null;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
  venue_id: string | null;
  university_role: string | null;
  access: UserAccessPayload;
};

export type DepartmentOption = {
  id: string;
  department_name: string;
  school: string | null;
};

export type SchoolOption = {
  id: string;
  name: string;
};

export type VenueOption = {
  id: string;
  name: string;
  campus: string | null;
};

export type UserAccessPayload = {
  is_organiser: boolean;
  is_student_organiser: boolean;
  is_volunteer: boolean;
  is_support: boolean;
  is_venue_manager: boolean;
  is_it_service: boolean;
  is_catering_vendors: boolean;
  is_stalls_misc: boolean;
  is_hod: boolean;
  is_dean: boolean;
  is_cfo: boolean;
  is_finance_officer: boolean;
  is_masteradmin: boolean;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
  venue_id: string | null;
};

export type RolesAnalytics = {
  totalEstimatedRevenue: number;
  venueUtilizationRate: number;
  averageApprovalSlaHours: number;
  revenueByMonth: Array<{
    month: string;
    revenue: number;
  }>;
  venueUsage: Array<{
    venue: string;
    events: number;
  }>;
  approvalSlaByMonth: Array<{
    month: string;
    hours: number;
  }>;
};

export type RolesPageData = {
  users: UserRoleRow[];
  departments: DepartmentOption[];
  schools: SchoolOption[];
  campuses: string[];
  venues: VenueOption[];
  cateringShops: string[];
  stallsScopes: string[];
  roleAssignments: RoleMatrixAssignment[];
  analytics: RolesAnalytics;
};

export type RoleMatrixAssignment = {
  user_id: string;
  role_code: string;
  department_scope: string | null;
  campus_scope: string | null;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
};

export type RoleMatrixAssignableRole =
  | "hod"
  | "dean"
  | "cfo"
  | "organiser"
  | "student_organiser"
  | "volunteer"
  | "support"
  | "finance_officer"
  | "master_admin"
  | "it_service"
  | "venue_service"
  | "catering_service"
  | "stalls_service";

export type RoleMatrixAssignPayload = {
  email: string;
  campus: string;
  role: RoleMatrixAssignableRole;
  scopeValue?: string | null;
};

export type UpdateUserAccessActionResult =
  | {
      ok: true;
      user: UserRoleRow;
    }
  | {
      ok: false;
      error: string;
    };

export type DeleteUserActionResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      error: string;
    };

export type AssignRoleMatrixActionResult =
  | {
      ok: true;
      data: {
        users: UserRoleRow[];
        roleAssignments: RoleMatrixAssignment[];
      };
      message: string;
    }
  | {
      ok: false;
      error: string;
    };
