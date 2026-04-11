export type ServiceRoleSlug =
  | "it"
  | "venue"
  | "catering-vendors"
  | "stalls-misc"
  | "security";

export interface ServiceRoleDashboardConfig {
  slug: ServiceRoleSlug;
  label: string;
  roleCodes: string[];
  aliases: string[];
  userFlagKeys: string[];
}

export const SERVICE_ROLE_DASHBOARDS: ServiceRoleDashboardConfig[] = [
  {
    slug: "it",
    label: "IT",
    roleCodes: ["SERVICE_IT"],
    aliases: ["it", "it service", "it services", "information technology"],
    userFlagKeys: ["is_it", "is_it_service", "is_service_it"],
  },
  {
    slug: "venue",
    label: "Venue",
    roleCodes: ["SERVICE_VENUE"],
    aliases: ["venue", "venues"],
    userFlagKeys: ["is_venue", "is_venue_manager", "is_service_venue"],
  },
  {
    slug: "catering-vendors",
    label: "Catering Vendors",
    roleCodes: ["SERVICE_CATERING"],
    aliases: [
      "catering vendors",
      "catering vendor",
      "catering",
      "cateringvendors",
    ],
    userFlagKeys: [
      "is_catering_vendor",
      "is_catering_vendors",
      "is_service_catering",
      "is_catering",
    ],
  },
  {
    slug: "stalls-misc",
    label: "Stalls/Misc",
    roleCodes: ["SERVICE_STALLS"],
    aliases: ["stalls misc", "stall misc", "stalls", "stallsmisc"],
    userFlagKeys: [
      "is_stalls_misc",
      "is_stall_misc",
      "is_stalls",
      "is_service_stalls",
    ],
  },
  {
    slug: "security",
    label: "Security",
    roleCodes: ["SERVICE_SECURITY"],
    aliases: ["security", "security service", "security services"],
    userFlagKeys: ["is_security", "is_security_service", "is_service_security"],
  },
];

function normalizeRoleCode(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function parseRoleCodeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    const uniqueRoleCodes = new Set(
      value
        .map((entry) => normalizeRoleCode(entry))
        .filter((entry) => entry.length > 0)
    );

    return Array.from(uniqueRoleCodes);
  }

  if (typeof value === "string") {
    const uniqueRoleCodes = new Set(
      value
        .split(",")
        .map((entry) => normalizeRoleCode(entry))
        .filter((entry) => entry.length > 0)
    );

    return Array.from(uniqueRoleCodes);
  }

  return [];
}

export function getRoleCodes(
  userLike: Record<string, unknown> | null | undefined
): string[] {
  if (!userLike) {
    return [];
  }

  return parseRoleCodeList(userLike.role_codes);
}

export function getActiveRoleCodesFromAssignments(
  assignments: Array<Record<string, unknown>>,
  nowDate: Date = new Date()
): string[] {
  const now = nowDate.getTime();

  const uniqueRoleCodes = new Set(
    assignments
      .filter((assignment) => {
        if (!assignment || assignment.is_active === false) {
          return false;
        }

        const validFrom = assignment.valid_from
          ? new Date(String(assignment.valid_from)).getTime()
          : null;
        const validUntil = assignment.valid_until
          ? new Date(String(assignment.valid_until)).getTime()
          : null;

        if (Number.isFinite(validFrom) && (validFrom as number) > now) {
          return false;
        }

        if (Number.isFinite(validUntil) && (validUntil as number) <= now) {
          return false;
        }

        return true;
      })
      .map((assignment) => normalizeRoleCode(assignment.role_code))
      .filter((roleCode) => roleCode.length > 0)
  );

  return Array.from(uniqueRoleCodes);
}

export function mergeRoleCodes(...groups: Array<string[]>): string[] {
  const uniqueRoleCodes = new Set(
    groups
      .flatMap((group) => group)
      .map((roleCode) => normalizeRoleCode(roleCode))
      .filter((roleCode) => roleCode.length > 0)
  );

  return Array.from(uniqueRoleCodes);
}

export function hasAnyRoleCode(
  userLike: Record<string, unknown> | null | undefined,
  requiredRoleCodes: string[]
): boolean {
  if (!userLike || requiredRoleCodes.length === 0) {
    return false;
  }

  const userRoleCodes = new Set(getRoleCodes(userLike));
  if (userRoleCodes.size === 0) {
    return false;
  }

  return requiredRoleCodes.some((requiredRoleCode) =>
    userRoleCodes.has(normalizeRoleCode(requiredRoleCode))
  );
}

export function normalizeRoleValue(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function hasRoleAlias(rawRole: unknown, aliases: string[]): boolean {
  const normalizedRole = normalizeRoleValue(rawRole);
  if (!normalizedRole) {
    return false;
  }

  return aliases.some((alias) => normalizeRoleValue(alias) === normalizedRole);
}

export function getServiceRoleConfigBySlug(
  slug: string | null | undefined
): ServiceRoleDashboardConfig | null {
  const normalizedSlug = String(slug || "").trim().toLowerCase();
  return (
    SERVICE_ROLE_DASHBOARDS.find((roleConfig) => roleConfig.slug === normalizedSlug) ||
    null
  );
}

export function hasServiceRoleAccess(
  userLike: Record<string, unknown> | null | undefined,
  roleConfig: ServiceRoleDashboardConfig
): boolean {
  if (!userLike) {
    return false;
  }

  if (hasAnyRoleCode(userLike, roleConfig.roleCodes)) {
    return true;
  }

  const hasFlag = roleConfig.userFlagKeys.some((key) => Boolean(userLike[key]));
  if (hasFlag) {
    return true;
  }

  return hasRoleAlias(userLike.university_role, roleConfig.aliases);
}

export function getAccessibleServiceRoleDashboards(
  userLike: Record<string, unknown> | null | undefined,
  isMasterAdmin: boolean
): ServiceRoleDashboardConfig[] {
  if (isMasterAdmin) {
    return SERVICE_ROLE_DASHBOARDS;
  }

  return SERVICE_ROLE_DASHBOARDS.filter((roleConfig) =>
    hasServiceRoleAccess(userLike, roleConfig)
  );
}
