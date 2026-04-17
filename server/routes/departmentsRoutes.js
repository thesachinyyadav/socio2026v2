import express from "express";
import supabase from "../config/supabaseClient.js";

const router = express.Router();

// Canonical fallback used when the departments table doesn't exist yet
// (before migration 034 runs). Matches the standardized 24-entry list.
const FALLBACK_DEPARTMENTS = [
  { id: "all_departments",                                        name: "All Departments",                                                    code: "all_departments",                                        school: "ALL" },
  { id: "dept_business_management_bba",                          name: "Department of Business and Management (BBA)",                        code: "dept_business_management_bba",                           school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_business_management_mba",                          name: "Department of Business and Management (MBA)",                        code: "dept_business_management_mba",                           school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_hotel_management",                                 name: "Department of Hotel Management",                                     code: "dept_hotel_management",                                  school: "SCHOOL OF BUSINESS AND MANAGEMENT" },
  { id: "dept_commerce",                                         name: "Department of Commerce",                                             code: "dept_commerce",                                          school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY" },
  { id: "dept_professional_studies",                             name: "Department of Professional Studies",                                 code: "dept_professional_studies",                              school: "SCHOOL OF COMMERCE FINANCE AND ACCOUNTANCY" },
  { id: "dept_english_cultural_studies",                         name: "Department of English and Cultural Studies",                        code: "dept_english_cultural_studies",                          school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_music",                                            name: "Department of Music",                                                code: "dept_music",                                             school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_performing_arts",                                  name: "Department of Performing Arts",                                      code: "dept_performing_arts",                                   school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_philosophy_theology",                              name: "Department of Philosophy and Theology",                             code: "dept_philosophy_theology",                               school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_theatre_studies",                                  name: "Department of Theatre Studies",                                      code: "dept_theatre_studies",                                   school: "SCHOOL OF HUMANITIES AND PERFORMING ARTS" },
  { id: "dept_school_of_law",                                    name: "Department of School of Law",                                        code: "dept_school_of_law",                                     school: "SCHOOL OF LAW" },
  { id: "dept_psychology",                                       name: "Department of Psychology",                                           code: "dept_psychology",                                        school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_school_of_education",                              name: "Department of School of Education",                                  code: "dept_school_of_education",                               school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_social_work",                                      name: "Department of Social Work",                                          code: "dept_social_work",                                       school: "SCHOOL OF PSYCHOLOGICAL SCIENCES, EDUCATION AND SOCIAL WORK" },
  { id: "dept_chemistry",                                        name: "Department of Chemistry",                                            code: "dept_chemistry",                                         school: "SCHOOL OF SCIENCES" },
  { id: "dept_computer_science",                                 name: "Department of Computer Science",                                     code: "dept_computer_science",                                  school: "SCHOOL OF SCIENCES" },
  { id: "dept_life_sciences",                                    name: "Department of Life Sciences",                                        code: "dept_life_sciences",                                     school: "SCHOOL OF SCIENCES" },
  { id: "dept_mathematics",                                      name: "Department of Mathematics",                                          code: "dept_mathematics",                                       school: "SCHOOL OF SCIENCES" },
  { id: "dept_physics_electronics",                              name: "Department of Physics and Electronics",                              code: "dept_physics_electronics",                               school: "SCHOOL OF SCIENCES" },
  { id: "dept_statistics_data_science",                          name: "Department of Statistics and Data Science",                         code: "dept_statistics_data_science",                           school: "SCHOOL OF SCIENCES" },
  { id: "dept_economics",                                        name: "Department of Economics",                                            code: "dept_economics",                                         school: "SCHOOL OF SOCIAL SCIENCES" },
  { id: "dept_international_studies_political_science_history",  name: "Department of International Studies, Political Science and History", code: "dept_international_studies_political_science_history",   school: "SCHOOL OF SOCIAL SCIENCES" },
  { id: "dept_media_studies",                                    name: "Department of Media Studies",                                        code: "dept_media_studies",                                     school: "SCHOOL OF SOCIAL SCIENCES" },
];

/**
 * Resolve a free-text department value (name or code slug) to its UUID.
 * Returns null if no match found.
 * Used by event/fest routes to populate organizing_dept_id on save.
 */
export async function resolveDepartmentId(textValue) {
  if (!textValue || typeof textValue !== "string") return null;
  const normalized = textValue.trim().toLowerCase();
  if (!normalized) return null;

  try {
    const { data, error } = await supabase
      .from("departments")
      .select("id")
      .or(`name.ilike.${normalized},code.ilike.${normalized}`)
      .limit(1)
      .single();

    if (error || !data) {
      // Table may not exist yet (pre-migration). Fall back to slug-id from fallback list.
      const match = FALLBACK_DEPARTMENTS.find(
        (d) => d.name.toLowerCase() === normalized || d.code.toLowerCase() === normalized
      );
      return match ? match.id : null;
    }

    return data.id;
  } catch {
    return null;
  }
}

/**
 * GET /api/departments
 * Returns all active departments ordered by school then name.
 * Falls back to the hardcoded canonical list if the table doesn't exist yet.
 */
router.get("/", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("departments")
      .select("id, name, code, school, is_active")
      .eq("is_active", true)
      .order("school", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      // Table hasn't been created yet — return canonical fallback
      if (
        error.code === "42P01" ||
        error.message?.toLowerCase().includes("does not exist") ||
        error.message?.toLowerCase().includes("relation")
      ) {
        return res.status(200).json({ departments: FALLBACK_DEPARTMENTS });
      }
      throw error;
    }

    const departments = Array.isArray(data) && data.length > 0 ? data : FALLBACK_DEPARTMENTS;
    return res.status(200).json({ departments });
  } catch (err) {
    console.error("GET /api/departments error:", err.message);
    return res.status(500).json({ error: "Failed to fetch departments" });
  }
});

export default router;
