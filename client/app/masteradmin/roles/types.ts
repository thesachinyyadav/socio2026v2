export type UserRoleRow = {
  id: string | number;
  name: string | null;
  email: string;
  created_at: string | null;
  is_organiser: boolean;
  is_support: boolean;
  is_hod: boolean;
  is_dean: boolean;
  is_masteradmin: boolean;
  department_id: string | null;
  school_id: string | null;
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
};

export type RolesPayload = {
  isOrganiser: boolean;
  isSupport: boolean;
  isMasterAdmin: boolean;
  isHod: boolean;
  isDean: boolean;
  department_id?: string | null;
  school_id?: string | null;
};

export type UpdateRolesActionResult =
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
