"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import toast from "react-hot-toast";
import { ClubRecord, createClub, updateClub } from "../actions/clubs";
import { toClubCategories } from "../lib/clubCategory";
import { christCampuses } from "../lib/eventFormSchema";

const CLUB_TYPES: Array<"club" | "centre" | "cell"> = ["club", "centre", "cell"];
const PREDEFINED_ROLES = [
  "Media",
  "Marketing",
  "Logistics",
  "Documentation",
  "Art and Decor",
  "Operations",
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
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type FormErrors = {
  type?: string;
  clubName?: string;
  subtitle?: string;
  category?: string;
  description?: string;
  webLink?: string;
  banner?: string;
  image?: string;
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
  const [selectedCategories, setSelectedCategories] = useState<string[]>(
    toClubCategories(initialClub?.category)
  );
  const [description, setDescription] = useState(initialClub?.club_description ?? "");
  const [webLink, setWebLink] = useState(initialClub?.club_web_link ?? "");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerUrlInput, setBannerUrlInput] = useState(initialClub?.club_banner_url ?? "");
  const [isDraggingBanner, setIsDraggingBanner] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrlInput, setImageUrlInput] = useState(initialClub?.club_image_url ?? "");
  const [isDraggingImage, setIsDraggingImage] = useState(false);
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
    return roles.map((value) => ({ id: nextRowId(), value }));
  });
  const [showRolesMenu, setShowRolesMenu] = useState(false);
  const [showOtherRoleInput, setShowOtherRoleInput] = useState(false);
  const [otherRoleInput, setOtherRoleInput] = useState("");
  const [showCategoriesMenu, setShowCategoriesMenu] = useState(false);
  const [editorRows, setEditorRows] = useState<EditorRow[]>(() => {
    const editors = toStringArray(initialClub?.club_editors);
    return editors.length > 0
      ? editors.map((email) => ({ id: nextRowId(), email }))
      : [{ id: nextRowId(), email: "" }];
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const rolesDropdownRef = useRef<HTMLDivElement | null>(null);
  const categoriesDropdownRef = useRef<HTMLDivElement | null>(null);

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
    setSelectedCategories(toClubCategories(initialClub.category));
    setDescription(initialClub.club_description ?? "");
    setWebLink(initialClub.club_web_link ?? "");
    setBannerUrlInput(initialClub.club_banner_url ?? "");
    setBannerFile(null);
    setImageUrlInput(initialClub.club_image_url ?? "");
    setImageFile(null);
    setRegistrationsOpen(Boolean(initialClub.club_registrations));
    setSelectedCampuses(toStringArray(initialClub.club_campus));
    const roles = toStringArray(initialClub.club_roles_available).filter(
      (role) => role.toLowerCase() !== "member"
    );
    setRoleRows(roles.map((value) => ({ id: nextRowId(), value })));
    const editors = toStringArray(initialClub.club_editors);
    setEditorRows(
      editors.length > 0
        ? editors.map((email) => ({ id: nextRowId(), email }))
        : [{ id: nextRowId(), email: "" }]
    );
  }, [initialClub]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      if (
        showRolesMenu &&
        rolesDropdownRef.current &&
        !rolesDropdownRef.current.contains(target)
      ) {
        setShowRolesMenu(false);
      }

      if (
        showCategoriesMenu &&
        categoriesDropdownRef.current &&
        !categoriesDropdownRef.current.contains(target)
      ) {
        setShowCategoriesMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showCategoriesMenu, showRolesMenu]);

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
      toast.error("Provide a valid custom role.", { duration: 3000 });
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
    const hasEmptyEmailField = editorRows.some((row) => !normalizeEmail(row.email));
    if (hasEmptyEmailField) {
      toast.error("Please fill in the current email field before adding another.", { duration: 3000 });
      return;
    }
    setEditorRows((prev) => [...prev, { id: nextRowId(), email: "" }]);
  };

  const updateEditorRow = (id: number, email: string) => {
    setEditorRows((prev) => prev.map((row) => (row.id === id ? { ...row, email } : row)));
  };

  const removeEditorRow = (id: number) => {
    setEditorRows((prev) => prev.filter((row) => row.id !== id));
  };

  const getResolvedRoles = () => {
    const seen = new Set<string>();
    const dynamicRoles = roleRows
      .map((row) => normalize(row.value))
      .filter(Boolean)
      .filter((role) => {
        const key = role.toLowerCase();
        if (key === "member" || seen.has(key)) return false;
        seen.add(key);
        return true;
      });

    return dynamicRoles;
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
    if (selectedCategories.length === 0) {
      nextErrors.category = "Select at least one category.";
    } else if (selectedCategories.length > 3) {
      nextErrors.category = "You can select a maximum of 3 categories.";
    }
    if (!normalize(description)) nextErrors.description = "Description is required.";

    const normalizedWebLink = normalize(webLink);
    if (!normalizedWebLink) nextErrors.webLink = "Official website is required.";
    else if (!/^https:\/\/.+/i.test(normalizedWebLink))
      nextErrors.webLink = "Website must start with https://";

    const normalizedBannerUrl = normalize(bannerUrlInput);
    if (normalizedBannerUrl && !/^https:\/\/.+/i.test(normalizedBannerUrl)) {
      nextErrors.banner = "Banner URL must start with https://";
    }

    const normalizedImageUrl = normalize(imageUrlInput);
    let imageMissingError = false;
    if (!imageFile && !normalizedImageUrl) {
      nextErrors.image = `${entityLabel} image is required.`;
      imageMissingError = true;
    } else if (normalizedImageUrl && !/^https:\/\/.+/i.test(normalizedImageUrl)) {
      nextErrors.image = "Image URL must start with https://";
    }
    if (selectedCampuses.length === 0) nextErrors.campus = "Select at least one campus.";

    if (showOtherRoleInput && !normalize(otherRoleInput)) {
      nextErrors.roles = "Provide a custom role for Others.";
    }
    if (registrationsOpen && resolvedRoles.length === 0) {
      nextErrors.roles = "Add at least one role before publishing registrations.";
    }

    if (resolvedEditors.length === 0) {
      nextErrors.editors = `Add at least one ${entityLabelLower} editor email.`;
    } else if (resolvedEditors.some((email) => !EMAIL_REGEX.test(email))) {
      nextErrors.editors = `All ${entityLabelLower} editor emails must be valid.`;
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      if (imageMissingError) {
        toast.error(`${entityLabel} image is required.`, { duration: 3000 });
      }
      const uniqueMessages = Array.from(
        new Set(
          Object.entries(nextErrors)
            .filter(([key]) => !(key === "image" && imageMissingError))
            .map(([, message]) => message)
            .filter((message): message is string => Boolean(message))
        )
      );
      uniqueMessages.forEach((message) => toast.error(message, { duration: 3000 }));
      return false;
    }

    return true;
  };

  const handleBannerChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setBannerFile(null);
      const message = "Only JPG and PNG files are allowed.";
      setErrors((prev) => ({ ...prev, banner: message }));
      toast.error(message, { duration: 3000 });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setBannerFile(null);
      const message = "Banner size must be under 3MB.";
      setErrors((prev) => ({ ...prev, banner: message }));
      toast.error(message, { duration: 3000 });
      return;
    }
    setBannerFile(file);
    setErrors((prev) => { const e = { ...prev }; delete e.banner; return e; });
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setImageFile(null);
      const message = "Only JPG and PNG files are allowed.";
      setErrors((prev) => ({ ...prev, image: message }));
      toast.error(message, { duration: 3000 });
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setImageFile(null);
      const message = "Image size must be under 3MB.";
      setErrors((prev) => ({ ...prev, image: message }));
      toast.error(message, { duration: 3000 });
      return;
    }

    setImageFile(file);
    setErrors((prev) => {
      const nextErrors = { ...prev };
      delete nextErrors.image;
      return nextErrors;
    });
  };

  const handleBannerDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingBanner(true); };
  const handleBannerDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingBanner(false); };
  const handleBannerDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingBanner(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleBannerChange({ target: { files: [file] } } as any);
  };

  const handleImageDragOver = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingImage(true); };
  const handleImageDragLeave = (e: React.DragEvent<HTMLDivElement>) => { e.preventDefault(); setIsDraggingImage(false); };
  const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImage(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageChange({ target: { files: [file] } } as any);
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

    try {
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

      let bannerUrl = normalize(bannerUrlInput) || null;
      let imageUrl = normalize(imageUrlInput) || null;

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
          toast.error(
            uploadData?.error || uploadData?.message || `Failed to upload ${entityLabelLower} banner.`
          );
          return;
        }

        bannerUrl = uploadData.url;
      }

      if (imageFile) {
        const uploadFormData = new FormData();
        uploadFormData.append("file", imageFile);

        const uploadResponse = await fetch(`${API_URL}/api/upload/fest-image`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: uploadFormData,
        });

        const uploadData = await readApiBodySafely(uploadResponse);
        if (!uploadResponse.ok || !uploadData?.url) {
          toast.error(
            uploadData?.error || uploadData?.message || `Failed to upload ${entityLabelLower} image.`
          );
          return;
        }

        imageUrl = uploadData.url;
      }

      setIsUploadingImage(false);

      const resolvedRoles = getResolvedRoles();
      const resolvedEditors = getResolvedEditors();
      const payload = {
        type: (initialClub?.type ?? clubType) as "club" | "centre" | "cell",
        club_name: clubName,
        subtitle,
        category: selectedCategories,
        club_description: description,
        club_banner_url: bannerUrl,
        club_image_url: imageUrl,
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

      if (!result.ok) {
        toast.error(result.error || `Failed to save ${entityLabelLower}.`);
        return;
      }

      toast.success(
        isEditMode
          ? `${entityLabel} updated successfully`
          : `${entityLabel} created successfully`
      );
      const savedClubId = result.club?.club_id ?? (isEditMode ? initialClub?.club_id : null);
      router.push(savedClubId ? `/club/${savedClubId}` : "/clubs");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Failed to save ${entityLabelLower}.`;
      toast.error(message.includes("Failed to fetch")
        ? `Server unreachable. Make sure the backend is running.`
        : message
      );
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
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

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
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
                      className={`cursor-pointer rounded-full border px-3 py-1 text-[11px] font-semibold transition-colors duration-200 ${
                        active
                          ? "border-[#1f57c3] bg-[#1f57c3] text-white hover:bg-[#184cae]"
                          : "border-[#9cacbf] bg-white text-[#4b5f79] hover:border-[#1f57c3]/60 hover:bg-[#f3f7ff]"
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

          <div className="relative" ref={categoriesDropdownRef}>
            <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
              Categories <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setShowCategoriesMenu((prev) => !prev)}
              className={`flex h-10 w-full cursor-pointer items-center justify-between rounded-md border bg-white px-3 text-left text-sm transition-colors duration-200 hover:bg-[#f6f9ff] focus:outline-none focus:ring-1 focus:ring-[#1f57c3] ${
                errors.category ? "border-red-500" : "border-[#bcc8d6]"
              }`}
            >
              <span className={selectedCategories.length > 0 ? "text-[#1f2f46]" : "text-[#6a7b92]"}>
                {selectedCategories.length > 0
                  ? `${selectedCategories.length} categor${selectedCategories.length === 1 ? "y" : "ies"} selected`
                  : "Select one or more categories"}
              </span>
              <span className="text-xs text-[#4f6482]">{showCategoriesMenu ? "▲" : "▼"}</span>
            </button>

            {showCategoriesMenu && (
              <div className="absolute left-0 right-0 top-16 z-30 max-h-60 overflow-y-auto rounded-md border border-[#c7d0db] bg-white shadow-md">
                {PREDEFINED_CATEGORIES.map((item) => (
                  <label
                    key={item}
                    className="flex cursor-pointer items-center gap-2 border-b border-[#edf1f5] px-3 py-2 text-xs text-[#2f435c] last:border-b-0 hover:bg-[#f3f7ff]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedCategories.includes(item)}
                      onChange={() => {
                        if (selectedCategories.includes(item)) {
                          setSelectedCategories(selectedCategories.filter((c) => c !== item));
                        } else if (selectedCategories.length >= 3) {
                          toast.error("You can only select up to 3 categories.", { duration: 3000 });
                        } else {
                          setSelectedCategories([...selectedCategories, item]);
                        }
                      }}
                      className="h-3.5 w-3.5 accent-[#1f57c3]"
                    />
                    {item}
                  </label>
                ))}
              </div>
            )}

            {selectedCategories.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedCategories.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-[#c4ceda] bg-white px-2.5 py-1 text-[10px] font-medium text-[#2f435c]"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}
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

          <div className="mb-6 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                {entityLabel} image: (max 3MB) - JPG/PNG <span className="text-red-500">*</span>
              </label>
              <div
                className={`flex h-full flex-col justify-between rounded-md border border-dashed bg-white px-4 py-5 text-center transition-colors ${
                  isDraggingImage ? "border-[#1f57c3] bg-blue-50" : "border-[#8da1bb]"
                }`}
                onDragOver={handleImageDragOver}
                onDragLeave={handleImageDragLeave}
                onDrop={handleImageDrop}
              >
                <div>
                  {isDraggingImage ? (
                    <p className="mb-2 text-[11px] font-semibold text-[#1f57c3]">Drop image here</p>
                  ) : (
                    <p className="mb-2 text-[11px] text-[#5a6d84]">Drag & drop or click · JPEG, PNG (max 3MB)</p>
                  )}
                  {!imageFile && imageUrlInput ? (
                    <a
                      href={imageUrlInput.startsWith("https://") ? imageUrlInput : "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mb-2 block text-xs font-medium text-[#1f57c3] underline"
                    >
                      View current image
                    </a>
                  ) : null}
                  {imageFile && (
                    <p className="mb-2 text-xs font-medium text-[#2e4560] break-all">{imageFile.name}</p>
                  )}
                  <input
                    type="file"
                    id="club-image-upload-input"
                    accept="image/jpeg,image/png"
                    onChange={handleImageChange}
                    className="hidden"
                    required={!imageUrlInput}
                  />
                  <label
                    htmlFor="club-image-upload-input"
                    className="inline-flex cursor-pointer rounded-full bg-[#1f57c3] px-4 py-1 text-[11px] font-semibold text-white"
                  >
                    {imageFile || imageUrlInput ? "Change Image" : "Choose File"}
                  </label>
                </div>
                <div className="mt-4 text-left">
                  <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                    Or paste image URL
                  </label>
                  <input
                    value={imageUrlInput}
                    onChange={(e) => {
                      setImageUrlInput(e.target.value);
                      if (normalize(e.target.value)) {
                        setImageFile(null);
                      }
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="h-9 w-full rounded-md border border-[#bcc8d6] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3]"
                  />
                </div>
                {errors.image && <p className="text-red-500 text-xs mt-2">{errors.image}</p>}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                {entityLabel} banner: (max 3MB) - JPG/PNG (optional)
              </label>
              <div
                className={`flex h-full flex-col justify-between rounded-md border border-dashed bg-white px-4 py-5 text-center transition-colors ${
                  isDraggingBanner ? "border-[#1f57c3] bg-blue-50" : "border-[#8da1bb]"
                }`}
                onDragOver={handleBannerDragOver}
                onDragLeave={handleBannerDragLeave}
                onDrop={handleBannerDrop}
              >
                <div>
                  {isDraggingBanner ? (
                    <p className="mb-2 text-[11px] font-semibold text-[#1f57c3]">Drop image here</p>
                  ) : (
                    <p className="mb-2 text-[11px] text-[#5a6d84]">Drag & drop or click · JPEG, PNG (max 3MB)</p>
                  )}
                  {!bannerFile && bannerUrlInput ? (
                    <a
                      href={bannerUrlInput.startsWith("https://") ? bannerUrlInput : "#"}
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
                    id="club-banner-upload-input"
                    accept="image/jpeg,image/png"
                    onChange={handleBannerChange}
                    className="hidden"
                  />
                  <label
                    htmlFor="club-banner-upload-input"
                    className="inline-flex cursor-pointer rounded-full bg-[#1f57c3] px-4 py-1 text-[11px] font-semibold text-white"
                  >
                    {bannerFile || bannerUrlInput ? "Change Banner" : "Choose File"}
                  </label>
                </div>
                <div className="mt-4 text-left">
                  <label className="mb-1 block text-[11px] font-semibold text-[#29364a]">
                    Or paste banner URL
                  </label>
                  <input
                    value={bannerUrlInput}
                    onChange={(e) => {
                      setBannerUrlInput(e.target.value);
                      if (normalize(e.target.value)) {
                        setBannerFile(null);
                      }
                    }}
                    placeholder="https://example.com/banner.jpg"
                    className="h-9 w-full rounded-md border border-[#bcc8d6] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#1f57c3]"
                  />
                </div>
                {errors.banner && <p className="text-red-500 text-xs mt-2">{errors.banner}</p>}
              </div>
            </div>
          </div>

          <div className="mt-6 mb-6 rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold text-[#29364a]">{entityLabel} Registrations</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-semibold ${
                    registrationsOpen ? "text-green-700" : "text-red-600"
                  }`}
                >
                  {registrationsOpen ? "OPEN" : "CLOSED"}
                </span>
                <button
                  type="button"
                  onClick={() => setRegistrationsOpen((prev) => !prev)}
                  aria-label={`Registrations ${registrationsOpen ? "open" : "closed"}`}
                  aria-pressed={registrationsOpen}
                  className={`relative h-6 w-11 cursor-pointer rounded-full border transition-colors duration-200 focus:outline-none focus:ring-2 ${
                    registrationsOpen
                      ? "border-green-600 bg-green-600 focus:ring-green-500/40"
                      : "border-red-500 bg-red-500 focus:ring-red-500/40"
                  }`}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                      registrationsOpen ? "translate-x-5" : "translate-x-0"
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
                <p className="text-[10px] text-[#6d7f95]">
                  {entityLabel} editors can edit the {entityLabel.toLowerCase()} information and
                  view applicant lists.
                </p>
              </div>
              <button
                type="button"
                onClick={addEditorRow}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-[#0d3b85] px-3 py-1 text-[10px] font-semibold text-white transition-colors duration-200 hover:bg-[#0b3272]"
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
                      className="cursor-pointer text-[10px] font-semibold text-red-500 transition-colors duration-200 hover:text-red-600"
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

          <div
            ref={rolesDropdownRef}
            className="relative rounded-md border border-[#d3dbe6] bg-[#f4f6f8] px-3 py-2"
          >
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <label className="text-[11px] font-semibold text-[#29364a]">
                  Roles Available {registrationsOpen ? <span className="text-red-500">*</span> : null}
                </label>
                <p className="mt-0.5 text-[10px] text-[#6d7f95]">
                  Add the roles members can apply for. These show up on the club application form.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRolesMenu((prev) => !prev)}
                className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-[#1f57c3] bg-white px-3 py-1 text-[10px] font-semibold text-[#1f57c3] transition-colors duration-200 hover:bg-[#f3f7ff]"
              >
                <Plus className="h-3 w-3" />
                Add Role
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {roleRows.length === 0 ? (
                <span className="text-[10px] font-medium text-[#5d708a]">No roles added yet.</span>
              ) : null}
              {roleRows.map((row) => (
                <span
                  key={row.id}
                  className="inline-flex items-center gap-1 rounded-full border border-[#c7d0db] bg-white px-2.5 py-1 text-[10px] font-semibold text-[#1f2f46]"
                >
                  {row.value}
                  <button
                    type="button"
                    onClick={() => removeRoleRow(row.id)}
                    className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full border border-red-500/40 bg-red-500/10 text-sm font-bold leading-none text-red-800 transition-colors duration-200 hover:border-red-600/60 hover:bg-red-600/20 hover:text-red-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/50"
                    aria-label={`Remove role ${row.value}`}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>

            {showRolesMenu && (
              <div className="absolute right-3 top-14 z-20 max-h-52 w-44 overflow-y-auto rounded-md border border-[#c7d0db] bg-white shadow-md">
                {PREDEFINED_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    onClick={() => addRole(role)}
                    className="block w-full cursor-pointer border-b border-[#edf1f5] px-3 py-1.5 text-left text-[10px] text-[#2f435c] transition-colors duration-200 last:border-b-0 hover:bg-[#f3f7ff]"
                  >
                    {role}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => addRole(OTHER_ROLE_OPTION)}
                  className="block w-full cursor-pointer px-3 py-1.5 text-left text-[10px] text-[#2f435c] transition-colors duration-200 hover:bg-[#f3f7ff]"
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
                  className="cursor-pointer rounded-md bg-[#1f57c3] px-3 py-1 text-[10px] font-semibold text-white transition-colors duration-200 hover:bg-[#184cae]"
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
              className="inline-flex cursor-pointer rounded-md bg-[#1f57c3] px-5 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#184cae] disabled:cursor-not-allowed disabled:opacity-60"
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
