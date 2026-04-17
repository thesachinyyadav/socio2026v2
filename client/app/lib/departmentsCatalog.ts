"use server";

import { resolveBackendApiBase } from "@/lib/backendApi";

export interface DepartmentEntry {
  id: string;
  name: string;
  code: string | null;
  school: string;
  is_active?: boolean;
}

export interface SchoolEntry {
  id: string;
  name: string;
}

/** Hardcoded fallback — identical to the 034 migration seed list. */
const FALLBACK_DEPARTMENTS: DepartmentEntry[] = [
  { id: "all_departments",                                       name: "All Departments",                                                    code: "all_departments",                                       school: "ALL" },
  { id: "dept_business_management_bba",                         name: "Department of Business and Management (BBA)",                        code: "dept_business_management_bba",                          school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_business_management_mba",                         name: "Department of Business and Management (MBA)",                        code: "dept_business_management_mba",                          school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_hotel_management",                                name: "Department of Hotel Management",                                     code: "dept_hotel_management",                                 school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_commerce",                                        name: "Department of Commerce",                                             code: "dept_commerce",                                         school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY" },
  { id: "dept_professional_studies",                            name: "Department of Professional Studies",                                 code: "dept_professional_studies",                             school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY" },
  { id: "dept_english_cultural_studies",                        name: "Department of English and Cultural Studies",                        code: "dept_english_cultural_studies",                         school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_music",                                           name: "Department of Music",                                                code: "dept_music",                                            school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_performing_arts",                                 name: "Department of Performing Arts",                                      code: "dept_performing_arts",                                  school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_philosophy_theology",                             name: "Department of Philosophy and Theology",                             code: "dept_philosophy_theology",                              school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_theatre_studies",                                 name: "Department of Theatre Studies",                                      code: "dept_theatre_studies",                                  school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_school_of_law",                                   name: "Department of School of Law",                                        code: "dept_school_of_law",                                    school: "SCHOOL OF LAW" },
  { id: "dept_psychology",                                      name: "Department of Psychology",                                           code: "dept_psychology",                                       school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_school_of_education",                             name: "Department of School of Education",                                  code: "dept_school_of_education",                              school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_social_work",                                     name: "Department of Social Work",                                          code: "dept_social_work",                                      school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_chemistry",                                       name: "Department of Chemistry",                                            code: "dept_chemistry",                                        school: "SCHOOL OF SCIENCES" },
  { id: "dept_computer_science",                                name: "Department of Computer Science",                                     code: "dept_computer_science",                                 school: "SCHOOL OF SCIENCES" },
  { id: "dept_life_sciences",                                   name: "Department of Life Sciences",                                        code: "dept_life_sciences",                                    school: "SCHOOL OF SCIENCES" },
  { id: "dept_mathematics",                                     name: "Department of Mathematics",                                          code: "dept_mathematics",                                      school: "SCHOOL OF SCIENCES" },
  { id: "dept_physics_electronics",                             name: "Department of Physics and Electronics",                              code: "dept_physics_electronics",                              school: "SCHOOL OF SCIENCES" },
  { id: "dept_statistics_data_science",                         name: "Department of Statistics and Data Science",                         code: "dept_statistics_data_science",                          school: "SCHOOL OF SCIENCES" },
  { id: "dept_economics",                                       name: "Department of Economics",                                            code: "dept_economics",                                        school: "SCHOOL OF SOCIAL SCIENCES" },
  { id: "dept_international_studies_political_science_history", name: "Department of International Studies, Political Science and History", code: "dept_international_studies_political_science_history",  school: "SCHOOL OF SOCIAL SCIENCES" },
  { id: "dept_media_studies",                                   name: "Department of Media Studies",                                        code: "dept_media_studies",                                    school: "SCHOOL OF SOCIAL SCIENCES" },
];

const FALLBACK_SCHOOLS: SchoolEntry[] = [
  { id: "SCHOOL OF BUSINESS AND MANAGEMENT",                        name: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY",               name: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY" },
  { id: "SCHOOL OF HUMANITIES AND PERFORMING ARTS",                 name: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "SCHOOL OF LAW",                                            name: "SCHOOL OF LAW" },
  { id: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK", name: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "SCHOOL OF SCIENCES",                                       name: "SCHOOL OF SCIENCES" },
  { id: "SCHOOL OF SOCIAL SCIENCES",                                name: "SCHOOL OF SOCIAL SCIENCES" },
  { id: "CLUBS AND CENTERS",                                        name: "CLUBS AND CENTERS" },
];

/**
 * Fetch the canonical departments list from the Express API.
 * Falls back to the hardcoded list if the API is unreachable or the DB
 * table hasn't been migrated yet.
 */
export async function fetchDepartments(): Promise<DepartmentEntry[]> {
  try {
    const base = resolveBackendApiBase({});
    if (!base) return FALLBACK_DEPARTMENTS;

    const res = await fetch(`${base}/api/departments`, {
      next: { revalidate: 3600 },
    });

    if (!res.ok) return FALLBACK_DEPARTMENTS;

    const json = await res.json();
    const rows: DepartmentEntry[] = Array.isArray(json?.departments) ? json.departments : [];
    return rows.length > 0 ? rows : FALLBACK_DEPARTMENTS;
  } catch {
    return FALLBACK_DEPARTMENTS;
  }
}

/**
 * Derive the unique schools from a departments list.
 * Merges DB-derived schools with the canonical fallback list so nothing is lost.
 */
export function deriveSchools(departments: DepartmentEntry[]): SchoolEntry[] {
  const seen = new Set<string>(FALLBACK_SCHOOLS.map((s) => s.id));
  const schools: SchoolEntry[] = [...FALLBACK_SCHOOLS];

  for (const dept of departments) {
    const school = dept.school?.trim();
    if (school && school !== "ALL" && !seen.has(school)) {
      seen.add(school);
      schools.push({ id: school, name: school });
    }
  }

  return schools.sort((a, b) => a.name.localeCompare(b.name));
}

/** Convert DepartmentEntry[] into the {value, label} shape used by form dropdowns. */
export function toDepartmentOptions(departments: DepartmentEntry[]) {
  return departments.map((d) => ({ value: d.id, label: d.name }));
}

/** Convert SchoolEntry[] into the {value, label} shape used by form dropdowns. */
export function toSchoolOptions(schools: SchoolEntry[]) {
  return schools.map((s) => ({ value: s.id, label: s.name }));
}
