export type UserRoleRow = {
  id: string | number;
  name: string | null;
  email: string;
  created_at: string | null;
  is_masteradmin: boolean;
  is_hod: boolean;
  is_dean: boolean;
  department_id: string | null;
  school_id: string | null;
  campus: string | null;
  university_role: string | null;
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

export type RolesPageData = {
  users: UserRoleRow[];
  departments: DepartmentOption[];
  schools: SchoolOption[];
  campuses: string[];
};

export type AssignableRole = "HOD" | "DEAN" | "CFO" | "FINANCE_OFFICER";

export type AssignRoleActionResult =
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
