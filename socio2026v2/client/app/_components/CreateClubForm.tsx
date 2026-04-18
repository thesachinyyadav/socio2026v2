"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import toast from "react-hot-toast";
import { ClubRecord, createClub, updateClub } from "../actions/clubs";
import { christCampuses } from "../lib/eventFormSchema";

const CLUB_TYPES: Array<"club" | "centre" | "cell"> = ["club", "centre", "cell"];
const PREDEFINED_ROLES = [
  "Media",
  "Marketing",
  "Logistics",
  "Documentation",
  "Art and Decor",
  "Operations",
  "Member",
];
const PREDEFINED_CATEGORIES = [
  "Academic",
  "Cultural",
  "Innovation",
  "Leadership",
  "Research",
  "Social",
  "Sports",
  "Student support",
  "Arts",
  "Literary",
  "Technical",
  "Community",
  "Entrepreneurship",
];
const OTHER_ROLE_OPTION = "Others";
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png"];
const MAX_IMAGE_SIZE = 3 * 1024 * 1024;
const REQUIRED_IMAGE_WIDTH = 2048;
const REQUIRED_IMAGE_HEIGHT = 1080;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type FormErrors = {
  type?: string;
  clubName?: string;
  subtitle?: string;
  category?: string;
  description?: string;
  webLink?: string;
  banner?: string;
  campus?: string;
  roles?: string;
  editors?: string;
};

type RoleSelectionRow = {
  id: number;
  value: string;
};

type EditorRow = {
  id: number;
  email: string;
};

type CreateClubFormProps = {
  mode?: "create" | "edit";
  initialClub?: ClubRecord | null;
  hideHeader?: boolean;
  embedded?: boolean;
};

const nextRowId = () => Date.now() + Math.floor(Math.random() * 100000);
const normalize = (value: string) => value.trim();
const normalizeEmail = (value: string) => value.trim().toLowerCase();
const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
const readApiBodySafely = async (response: Response): Promise<any> => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
};

const validateImageDimensions = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      const valid =
        image.naturalWidth === REQUIRED_IMAGE_WIDTH &&
        image.naturalHeight === REQUIRED_IMAGE_HEIGHT;
      URL.revokeObjectURL(objectUrl);
      resolve(
        valid
          ? null
          : `Image must be exactly ${REQUIRED_IMAGE_WIDTH}x${REQUIRED_IMAGE_HEIGHT}px.`
      );
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve("Unable to read image dimensions. Please use a valid JPG/PNG image.");
    };

    image.src = objectUrl;
  });

const toStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean);
};

export default function CreateClubForm({
  mode = "create",
  initialClub = null,
  hideHeader = false,
  embedded = false,
}: CreateClubFormProps) {
  const isEditMode = mode === "edit";
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [clubType, setClubType] = useState<"club" | "centre" | "cell">(
    initialClub?.type ?? "club"
  );
  const [clubName, setClubName] = useState(initialClub?.club_name ?? "");
  const [subtitle, setSubtitle] = useState(initialClub?.subtitle ?? "");
  const [category, setCategory] = useState(initialClub?.category ?? "");
  const [description, setDescription] = useState(initialClub?.club_description ?? "");
  const [webLink, setWebLink] = useState(initialClub?.club_web_link ?? "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [existingBannerUrl, setExistingBannerUrl] = useState(
    initialClub?.club_banner_url ?? ""
  );
  const [registrationsOpen, setRegistrationsOpen] = useState(
    Boolean(initialClub?.club_registrations)
  );
  const [selectedCampuses, setSelectedCampuses] = useState<string[]>(
    toStringArray(initialClub?.club_campus)
  );
  const [roleRows, setRoleRows] = useState<RoleSelectionRow[]>(() => {
    const roles = toStringArray(initialClub?.club_roles_available).filter(
      (role) => role.toLowerCase() !== "member"
    );
    return roles.length > 0
      ? roles.map((value) => ({ id: nextRowId(), value }))
      : [{ id: nextRowId(), value: "Media" }];
  });
  const [showRolesMenu, setShowRolesMenu] = useState(false);
  const [showOtherRoleInput, setShowOtherRoleInput] = useState(false);
  const [otherRoleInput, setOtherRoleInput] = useState("");
  const [editorRows, setEditorRows] = useState<EditorRow[]>(() => {
    const editors = toStringArray(initialClub?.club_editors);
    return editors.length > 0
      ? editors.map((email) => ({ id: nextRowId(), email }))
      : [{ id: nextRowId(), email: "" }];
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const API_URL = (process.env.NEXT_PUBLIC_API_URL || "").replace(/\/api\/?$/, "");
  const supabase = useMemo(() => {
    if (!supabaseUrl || !supabaseAnonKey) return null;
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
  }, [supabaseAnonKey, supabaseUrl]);
  const entityLabel = clubType === "centre" ? "Centre" : clubType === "cell" ? "Cell" : "Club";
  const entityLabelLower = entityLabel.toLowerCase();
  const isCentreOrCell = clubType !== "club";

  useEffect(() => {
    if (!initialClub) return;
    setClubType(initialClub.type);
    setClubName(initialClub.club_name ?? "");
    setSubtitle(initialClub.subtitle ?? "");
    setCategory(initialClub.category ?? "");
    setDescription(initialClub.club_description ?? "");
    setWebLink(initialClub.club_web_link ?? "");
    setExistingBannerUrl(initialClub.club_banner_url ?? "");
    setBannerFile(null);
    setRegistrationsOpen(Boolean(initialClub.club_registrations));
    setSelectedCampuses(toStringArray(initialClub.club_campus));
    const roles = toStringArray(initialClub.club_roles_available).filter(
      (role) => role.toLowerCase() !== "member"
    );
    setRoleRows(
      roles.length > 0
        ? roles.map((value) => ({ id: nextRowId(), value }))
        : [{ id: nextRowId(), value: "Media" }]
    );
    const editors = toStringArray(initialClub.club_editors);
    setEditorRows(
      editors.length > 0
        ? editors.map((email) => ({ id: nextRowId(), email }))
        : [{ id: nextRowId(), email: "" }]
    );
  }, [initialClub]);

  const toggleFromArray = (
    value: string,
    source: string[],
    setter: (next: string[]) => void
  ) => {
    if (source.includes(value)) setter(source.filter((item) => item !== value));
    else setter([...source, value]);
  };

  const addRole = (roleValue: string) => {
    if (roleValue === OTHER_ROLE_OPTION) {
      setShowOtherRoleInput(true);
      setShowRolesMenu(false);
      return;
    }

    const role = normalize(roleValue);
    if (!role || role.toLowerCase() === "member") {
      setShowRolesMenu(false);
      return;
    }

    setRoleRows((prev) =>
      prev.some((row) => row.value.toLowerCase() === role.toLowerCase())
        ? prev
        : [...prev, { id: nextRowId(), value: role }]
    );
    setShowRolesMenu(false);
  };

  const addOtherRole = () => {
    const custom = normalize(otherRoleInput);
    if (!custom || custom.toLowerCase() === "member") {
      setOtherRoleInput("");
      setShowOtherRoleInput(false);
      return;
    }
    setRoleRows((prev) =>
      prev.some((row) => row.value.toLowerCase() === custom.toLowerCase())
        ? prev
        : [...prev, { id: nextRowId(), value: custom }]
    );
    setOtherRoleInput("");
    setShowOtherRoleInput(false);
  };

  const removeRoleRow = (id: number) => {
    setRoleRows((prev) => prev.filter((row) => row.id !== id));
  };

  const addEditorRow = () => {
    setEditorRows((prev) => [...prev, { id: nextRowId(), email: "" }]);
  };

  const updateEditorRow = (id: number, email: string) => {
    setEditorRows((prev) => prev.map((row) => (row.id === id ? { ...row, email } : row)));
  };

  const removeEditorRow = (id: number) => {
    setEditorRows((prev) => prev.filter((row) => row.id !== id));
  };

  const getResolvedRoles = () => {
    const dynamicRoles = roleRows.map((row) => normalize(row.value)).filter(Boolean);
    return Array.from(new Set(["Member", ...dynamicRoles]));
  };

  const getResolvedEditors = () =>
    editorRows.map((row) => normalizeEmail(row.email)).filter(Boolean);

  const validateForm = (): boolean => {
    const nextErrors: FormErrors = {};
    const resolvedRoles = getResolvedRoles();
    const resolvedEditors = getResolvedEditors();

    if (!CLUB_TYPES.includes(clubType)) nextErrors.type = "Type is required.";
    if (!normalize(clubName)) nextErrors.clubName = `${entityLabel} name is required.`;
    if (isCentreOrCell && !normalize(subtitle)) {
      nextErrors.subtitle = `${entityLabel} subtitle is required.`;
    }
    if (!normalize(category)) nextErrors.category = "Category is required.";
    if (!normalize(description)) nextErrors.description = "Description is required.";

    const normalizedWebLink = normalize(webLink);
    if (!normalizedWebLink) nextErrors.webLink = "Official website is required.";
    else if (!/^https:\/\/.+/i.test(normalizedWebLink))
      nextErrors.webLink = "Website must start with https://";

    if (!bannerFile && !existingBannerUrl) nextErrors.banner = `${entityLabel} image is required.`;
    if (selectedCampuses.length === 0) nextErrors.campus = "Select at least one campus.";

    if (showOtherRoleInput && !normalize(otherRoleInput)) {
      nextErrors.roles = "Provide a custom role for Others.";
    }
    if (resolvedRoles.length === 0) nextErrors.roles = "Add at least one role.";

    if (resolvedEditors.length === 0) {
      nextErrors.editors = `Add at least one ${entityLabelLower} editor email.`;
    } else if (resolvedEditors.some((email) => !EMAIL_REGEX.test(email))) {
      nextErrors.editors = `All ${entityLabelLower} editor emails must be valid.`;
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setBannerFile(null);
      setErrors((prev) => ({ ...prev, banner: "Only JPG and PNG files are allowed." }));
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setBannerFile(null);
      setErrors((prev) => ({ ...prev, banner: "Image size must be under 3MB." }));
      return;
    }

    const dimensionError = await validateImageDimensions(file);
    if (dimensionError) {
      setBannerFile(null);
      setErrors((prev) => ({ ...prev, banner: dimensionError }));
      return;
    }

    setBannerFile(file);
    setExistingBannerUrl("");
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.banner;
      return nextErrors;
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!validateForm()) return;

    if (!supabase || !API_URL) {
      toast.error("Missing app configuration. Please contact support.");
      return;
    }

    setIsSubmitting(true);
    setIsUploadingImage(true);

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError || !session?.access_token) {
      setIsSubmitting(false);
      setIsUploadingImage(false);
      toast.error("Please log in again and retry.");
      return;
    }

    let bannerUrl = existingBannerUrl || null;
    if (bannerFile) {
      const uploadFormData = new FormData();
      uploadFormData.append("file", bannerFile);

      const uploadResponse = await fetch(`${API_URL}/api/upload/fest-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: uploadFormData,
      });

      const uploadData = await readApiBodySafely(uploadResponse);
      if (!uploadResponse.ok || !uploadData?.url) {
        setIsSubmitting(false);
        setIsUploadingImage(false);
        toast.error(
          uploadData?.error || uploadData?.message || `Failed to upload ${entityLabelLower} image.`
        );
        return;
      }

      bannerUrl = uploadData.url;
    }

    setIsUploadingImage(false);

    const resolvedRoles = getResolvedRoles();
    const resolvedEditors = getResolvedEditors();
    const payload = {
      type: (initialClub?.type ?? clubType) as "club" | "centre" | "cell",
      club_name: clubName,
      subtitle,
      category,
      club_description: description,
      club_banner_url: bannerUrl,
      club_registrations: registrationsOpen,
      club_campus: selectedCampuses,
      club_roles_available: resolvedRoles,
      club_editors: resolvedEditors,
      club_web_link: webLink,
    };
    const result =
      isEditMode && initialClub?.club_id
        ? await updateClub(initialClub.club_id, payload)
        : await createClub(payload);
    setIsSubmitting(false);

    if (!result.ok) {
      toast.error(result.error || `Failed to save ${entityLabelLower}.`);
      return;
    }

    toast.success(
      isEditMode
        ? `${entityLabel} updated successfully`
        : `${entityLabel} created successfully`
    );
    router.push("/masteradmin");
  };

  return (
    <div className={embedded ? "py-10 px-3 sm:px-4" : "min-h-screen bg-[#f3f5f9] py-10 px-3 sm:px-4"}>
      <div className="mx-auto w-full max-w-3xl rounded-xl border border-[#ced6e0] bg-[#f8fafc] p-4 sm:p-6">
        {!hideHeader && (
      <>
            <span className="inline-flex rounded-full border border-[#93a4bd] px-2 py-0.5 text-[10px] font-medium text-[#4f647f]">
              {entityLabel} details
            </span>
            <h1 className="mt-3 text-3xl font-semibold text-[#0e3f84]">
              {isEditMode ? `Edit ${entityLabel}` : `Create ${entityLabel}`}
            </h1>
            <p className="mt-1 text-xs text-[#56657a]">
              {isEditMode
                ? `Fill the details below to edit this ${entityLabelLower} record`
                : `Fill the details below to create a new ${entityLabelLower} record`}
            </p>
          </>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {!isEditMode ? (
            <div>
              <label className="mb-2 block text-[11px] font-semibold text-[#29364a]">
                Type <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                {CLUB_TYPES.map((type) => {
                  const active = clubType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setClubType(type)}
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors ${
                        active
                          ? "border-[#1f57c3] bg-[#1f57c3] text-white"
                          : "border-[#9cacbf] bg-white text-[#4b5f79]"
                      }`}
                    >
                      {titleCase(type)}
                    </button>
                  );
                })}
              </div>
              {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type}</p>}
            </div>
          ) : (
            <div>
              <label className="mb-2 block text-[11px] font-semibold text-[#29364a]">Type</label>
              <div className="inline-flex rounded-full border border-[#1f57c3] bg-[#1f57c3] px-3 py-1 text-[11px] font-semibold text-white">
                {titleCase(clubType)}
              </div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                {entityLabel} name <span className="text-red-500">*</span>
              </label>
              <input
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
                placeholder={`Enter ${entityLabelLower} name`}
                required
                className={`h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3] ${
                  errors.clubName ? "border-red-500" : "border-[#bcc8d6]"
                }`}
              />
              {errors.clubName && <p className="text-red-500 text-xs mt-1">{errors.clubName}</p>}
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                Subtitle {isCentreOrCell ? <span className="text-red-500">*</span> : "(optional)"}
              </label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Enter subtitle"
                required={isCentreOrCell}
                className="h-10 w-full rounded-md border border-[#bcc8d6] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3]"
              />
              {errors.subtitle && <p className="text-red-500 text-xs mt-1">{errors.subtitle}</p>}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
              className={`h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3] ${
                errors.category ? "border-red-500" : "border-[#bcc8d6]"
              }`}
            >
              <option value="">Select category</option>
              {PREDEFINED_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
              Detailed description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Provide ${entityLabelLower} description`}
              required
              rows={4}
              className={`w-full rounded-md border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3] ${
                errors.description ? "border-red-500" : "border-[#bcc8d6]"
              }`}
            />
            {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description}</p>}
          </div>

          <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
              {entityLabel} banner: (max 3MB) - JPG/PNG <span className="text-red-500">*</span>
            </label>
            <div className="rounded-md border border-dashed border-[#8da1bb] bg-white px-4 py-5 text-center">
              <p className="mb-2 text-[11px] text-[#5a6d84]">JPEG, PNG (max 3MB) - 2048x1080 required</p>
              {!bannerFile && existingBannerUrl ? (
                <a
                  href={existingBannerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-2 block text-xs font-medium text-[#1f57c3] underline"
                >
                  View current banner
                </a>
              ) : null}
              {bannerFile && (
                <p className="mb-2 text-xs font-medium text-[#2e4560] break-all">{bannerFile.name}</p>
              )}
              <input
                type="file"
                id="club-image-upload-input"
                accept="image/jpeg,image/png"
                onChange={handleImageChange}
                className="hidden"
                required={!existingBannerUrl}
              />
              <label
                htmlFor="club-image-upload-input"
                className="inline-flex cursor-pointer rounded-full bg-[#1f57c3] px-4 py-1 text-[11px] font-semibold text-white"
              >
                {bannerFile || existingBannerUrl ? "Change Image" : "Choose File"}
              </label>
              {errors.banner && <p className="text-red-500 text-xs mt-2">{errors.banner}</p>}
            </div>
          </div>

          <div className="rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[#29364a]">{entityLabel} Registrations</p>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    registrationsOpen ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"
                  }`}
                >
                  {registrationsOpen ? "open" : "closed"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold text-[#4d6078]">
                  {registrationsOpen ? "ON" : "OFF"}
                </span>
                <button
                  type="button"
                  onClick={() => setRegistrationsOpen((prev) => !prev)}
                  aria-label={`Registrations ${registrationsOpen ? "on" : "off"}`}
                  aria-pressed={registrationsOpen}
                  className={`relative h-5 w-10 rounded-full transition-colors ${
                    registrationsOpen ? "bg-[#1f57c3]" : "bg-[#c2ccda]"
                  }`}
                >
                  <span
                    className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                      registrationsOpen ? "translate-x-5" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2">
            <label className="block text-[11px] font-semibold text-[#29364a]">
              Campus Availability <span className="text-red-500">*</span>
            </label>
            <p className="mt-0.5 text-[10px] text-[#6d7f95]">Who can register?</p>
            <div className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {christCampuses.map((campus) => (
                <label key={campus} className="flex items-center gap-2 text-[11px] text-[#334963]">
                  <input
                    type="checkbox"
                    checked={selectedCampuses.includes(campus)}
                    onChange={() =>
                      toggleFromArray(campus, selectedCampuses, setSelectedCampuses)
                    }
                    className="h-3 w-3"
                  />
                  {campus}
                </label>
              ))}
            </div>
            {errors.campus && <p className="text-red-500 text-xs mt-1">{errors.campus}</p>}
          </div>

          <div className="rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <label className="block text-[11px] font-semibold text-[#29364a]">
                  {entityLabel} Editors <span className="text-red-500">*</span>
                </label>
                <p className="text-[10px] text-[#6d7f95]">Add editor emails only</p>
              </div>
              <button
                type="button"
                onClick={addEditorRow}
                className="inline-flex items-center gap-1 rounded-full bg-[#0d3b85] px-3 py-1 text-[10px] font-semibold text-white"
              >
                <Plus className="h-3 w-3" />
                Add {entityLabel} Editors
              </button>
            </div>
            <div className="space-y-2">
              {editorRows.map((row, index) => (
                <div key={row.id}>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-[10px] font-semibold text-[#5b6f88]">EDITOR {index + 1}</label>
                    <button
                      type="button"
                      onClick={() => removeEditorRow(row.id)}
                      className="text-[10px] font-semibold text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                  <input
                    type="email"
                    value={row.email}
                    onChange={(e) => updateEditorRow(row.id, e.target.value)}
                    placeholder="name@christuniversity.in"
                    className="h-9 w-full rounded-md border border-[#bcc8d6] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3]"
                  />
                </div>
              ))}
            </div>
            {errors.editors && <p className="text-red-500 text-xs mt-1">{errors.editors}</p>}
          </div>

          <div className="relative rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2">
            <div className="mb-2 flex items-center justify-between">
              <label className="text-[11px] font-semibold text-[#29364a]">
                Roles Available <span className="text-red-500">*</span>
              </label>
              <button
                type="button"
                onClick={() => setShowRolesMenu((prev) => !prev)}
                className="inline-flex items-center gap-1 rounded-full border border-[#1f57c3] bg-white px-3 py-1 text-[10px] font-semibold text-[#1f57c3]"
              >
                <Plus className="h-3 w-3" />
                Add Role
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full border border-[#1f57c3] bg-[#1f57c3] px-2 py-0.5 text-[10px] font-semibold text-white">
                Member
              </span>
              {roleRows.map((row) => (
                <span
                  key={row.id}
                  className="inline-flex items-center gap-2 rounded-full border border-[#c4ceda] bg-white px-2 py-0.5 text-[10px] font-medium text-[#2f435c]"
                >
                  {row.value}
                  <button type="button" onClick={() => removeRoleRow(row.id)} className="text-red-500">
                    ×
                  </button>
                </span>
              ))}
            </div>

            {showRolesMenu && (
              <div className="absolute right-3 top-14 z-20 max-h-52 w-36 overflow-y-auto rounded-md border border-[#c7d0db] bg-white shadow-md">
                {PREDEFINED_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => addRole(role)}
                    className="block w-full border-b border-[#edf1f5] px-3 py-1.5 text-left text-[10px] text-[#2f435c] last:border-b-0 hover:bg-[#f3f7ff]"
                  >
                    {role}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addRole(OTHER_ROLE_OPTION)}
                  className="block w-full px-3 py-1.5 text-left text-[10px] text-[#2f435c] hover:bg-[#f3f7ff]"
                >
                  Others
                </button>
              </div>
            )}

            {showOtherRoleInput && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  value={otherRoleInput}
                  onChange={(e) => setOtherRoleInput(e.target.value)}
                  placeholder="Enter custom role"
                  className="h-8 flex-1 rounded-md border border-[#bcc8d6] bg-white px-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#1f57c3]"
                />
                <button
                  type="button"
                  onClick={addOtherRole}
                  className="rounded-md bg-[#1f57c3] px-3 py-1 text-[10px] font-semibold text-white"
                >
                  Add
                </button>
              </div>
            )}
            {errors.roles && <p className="text-red-500 text-xs mt-1">{errors.roles}</p>}
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
              Official Website Link <span className="text-red-500">*</span>
            </label>
            <input
              value={webLink}
              onChange={(e) => setWebLink(e.target.value)}
              placeholder="https://official_website.example"
              required
              className={`h-10 w-full rounded-md border bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3] ${
                errors.webLink ? "border-red-500" : "border-[#bcc8d6]"
              }`}
            />
            {errors.webLink && <p className="text-red-500 text-xs mt-1">{errors.webLink}</p>}
          </div>

          <div className="pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex rounded-md bg-[#1f57c3] px-5 py-2 text-sm font-semibold text-white hover:bg-[#184cae] disabled:opacity-60"
            >
              {isSubmitting
                ? isUploadingImage
                  ? "Uploading image..."
                  : isEditMode
                    ? "Updating..."
                    : "Creating..."
                : isEditMode
                  ? `Update ${entityLabel}`
                  : `Create ${entityLabel}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
