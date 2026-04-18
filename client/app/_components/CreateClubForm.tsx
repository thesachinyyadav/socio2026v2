"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { christCampuses } from "../lib/eventFormSchema";
import { createClub } from "../actions/clubs";
import { useAuth } from "../../context/AuthContext";
import { buildServerApiUrl } from "../../lib/apiBase";

type ClubType = "club" | "centre" | "cell";

const PREDEFINED_ROLES = [
  "Media",
  "Marketing",
  "Logistics",
  "Documentation",
  "Art and Decor",
  "Operations",
  "Member",
];

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const MAX_BANNER_FILE_SIZE = 3 * 1024 * 1024;
const ALLOWED_BANNER_FILE_TYPES = ["image/jpeg", "image/png"];

interface ClubEditor {
  email: string;
  _uiKey: string;
}

interface ClubFormState {
  type: ClubType;
  clubName: string;
  subtitle: string;
  detailedDescription: string;
  clubRegistrations: boolean;
  clubCampus: string[];
  clubEditors: ClubEditor[];
  rolesAvailable: string[];
  officialWebsiteLink: string;
}

const createUiKey = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const validateBannerResolution = (file: File): Promise<string | null> =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth !== 2048 || image.naturalHeight !== 1080) {
        resolve("Banner must be exactly 2048x1080.");
        return;
      }
      resolve(null);
    };
    image.onerror = () => resolve("Could not read the selected banner image.");
    image.src = URL.createObjectURL(file);
  });

export default function CreateClubForm() {
  const router = useRouter();
  const { session } = useAuth();

  const [formData, setFormData] = useState<ClubFormState>({
    type: "club",
    clubName: "",
    subtitle: "",
    detailedDescription: "",
    clubRegistrations: false,
    clubCampus: [],
    clubEditors: [],
    rolesAvailable: [],
    officialWebsiteLink: "",
  });
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);
  const [showOtherRoleInput, setShowOtherRoleInput] = useState(false);
  const [otherRoleInput, setOtherRoleInput] = useState("");

  const normalizedRoles = useMemo(
    () => new Set(formData.rolesAvailable.map((role) => role.trim().toLowerCase())),
    [formData.rolesAvailable]
  );

  const addRole = (role: string) => {
    const normalized = role.trim();
    if (!normalized) return;
    if (normalizedRoles.has(normalized.toLowerCase())) return;

    setFormData((prev) => ({
      ...prev,
      rolesAvailable: [...prev.rolesAvailable, normalized],
    }));
    setErrors((prev) => ({ ...prev, rolesAvailable: undefined }));
  };

  const removeRole = (role: string) => {
    setFormData((prev) => ({
      ...prev,
      rolesAvailable: prev.rolesAvailable.filter((item) => item !== role),
    }));
  };

  const addClubEditor = () => {
    if (formData.clubEditors.length >= 5) return;
    setFormData((prev) => ({
      ...prev,
      clubEditors: [...prev.clubEditors, { email: "", _uiKey: createUiKey("club-editor") }],
    }));
  };

  const removeClubEditor = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      clubEditors: prev.clubEditors.filter((_, i) => i !== index),
    }));

    setErrors((prev) => {
      const next = { ...prev };
      delete next[`clubEditor_${index}`];
      return next;
    });
  };

  const toggleCampus = (campus: string, enabled: boolean) => {
    setFormData((prev) => ({
      ...prev,
      clubCampus: enabled
        ? [...prev.clubCampus, campus]
        : prev.clubCampus.filter((item) => item !== campus),
    }));
  };

  const handleBannerFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setImageFile(null);
      setErrors((prev) => ({ ...prev, imageFile: "Club banner is required." }));
      return;
    }

    setImageFile(file);
    if (file.size > MAX_BANNER_FILE_SIZE) {
      setErrors((prev) => ({ ...prev, imageFile: "Max 3MB" }));
      return;
    }

    if (!ALLOWED_BANNER_FILE_TYPES.includes(file.type)) {
      setErrors((prev) => ({ ...prev, imageFile: "JPG/PNG only" }));
      return;
    }

    setErrors((prev) => {
      const next = { ...prev };
      delete next.imageFile;
      return next;
    });
  };

  const validateForm = async (): Promise<boolean> => {
    const nextErrors: Record<string, string | undefined> = {};

    if (formData.type !== "club") {
      nextErrors.submit = "Centre and Cell forms are pending. Select Club to continue.";
    }

    if (!formData.clubName.trim()) {
      nextErrors.clubName = "Club name is required.";
    }

    if (!formData.detailedDescription.trim()) {
      nextErrors.detailedDescription = "Detailed description is required.";
    }

    if (!imageFile) {
      nextErrors.imageFile = "Club banner is required.";
    } else if (imageFile.size > MAX_BANNER_FILE_SIZE) {
      nextErrors.imageFile = "Image file must be less than 3MB";
    } else if (!ALLOWED_BANNER_FILE_TYPES.includes(imageFile.type)) {
      nextErrors.imageFile = "Invalid file type. JPG/PNG only.";
    } else {
      const resolutionError = await validateBannerResolution(imageFile);
      if (resolutionError) {
        nextErrors.imageFile = resolutionError;
      }
    }

    if (formData.clubCampus.length === 0) {
      nextErrors.clubCampus = "Select at least one campus under Who can register.";
    }

    if (formData.rolesAvailable.length === 0) {
      nextErrors.rolesAvailable = "Add at least one role.";
    }

    const websiteUrl = formData.officialWebsiteLink.trim();
    if (websiteUrl && !websiteUrl.startsWith("https://")) {
      nextErrors.officialWebsiteLink = "Official website must start with https://";
    }

    formData.clubEditors.forEach((editor, index) => {
      const email = editor.email.trim().toLowerCase();
      if (!email) return;
      if (!EMAIL_REGEX.test(email)) {
        nextErrors[`clubEditor_${index}`] = "Enter a valid email address.";
      }
    });

    setErrors(nextErrors);
    return Object.values(nextErrors).every((value) => !value);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting) return;

    const isValid = await validateForm();
    if (!isValid) return;

    setIsSubmitting(true);
    try {
      if (!session?.access_token) {
        setErrors((prev) => ({ ...prev, submit: "You must be logged in." }));
        return;
      }

      if (!imageFile) {
        setErrors((prev) => ({ ...prev, imageFile: "Club banner is required." }));
        return;
      }

      setIsUploadingImage(true);
      const uploadFormData = new FormData();
      uploadFormData.append("file", imageFile);
      const uploadResponse = await fetch(buildServerApiUrl("/upload/fest-image"), {
        method: "POST",
        body: uploadFormData,
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const uploadData = await uploadResponse.json().catch(() => null);
      if (!uploadResponse.ok || !uploadData?.url) {
        setErrors((prev) => ({
          ...prev,
          submit:
            uploadData?.error ||
            uploadData?.message ||
            "Image upload failed. Please try again.",
        }));
        return;
      }

      const result = await createClub({
        type: formData.type,
        club_name: formData.clubName.trim(),
        subtitle: formData.subtitle.trim() || null,
        club_description: formData.detailedDescription.trim(),
        club_banner_url: uploadData.url,
        club_registrations: formData.clubRegistrations,
        club_campus: formData.clubCampus,
        club_editors: formData.clubEditors
          .map((editor) => editor.email.trim().toLowerCase())
          .filter(Boolean),
        club_roles_available: formData.rolesAvailable,
        club_web_link: formData.officialWebsiteLink.trim() || null,
      });

      if (!result.ok) {
        setErrors((prev) => ({
          ...prev,
          submit: result.error || "Failed to create club.",
        }));
        return;
      }

      toast.success("Club created successfully.");
      router.push("/masteradmin");
      router.refresh();
    } finally {
      setIsUploadingImage(false);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f5f8fe] via-white to-[#f5f8fe] pb-16">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 md:px-10 pt-8 sm:pt-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8 md:p-10 shadow-sm">
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-full border bg-blue-50 text-[#154CB3] border-blue-200 mb-3">
              1. Club details
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#063168]">Create Club</h1>
            <p className="text-sm text-gray-500 mt-1">
              Fill the details below to create a new club record.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-7" noValidate>
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">
                Type of Club <span className="text-red-500">*</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {(["club", "centre", "cell"] as ClubType[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() =>
                      setFormData((prev) => ({
                        ...prev,
                        type: option,
                        subtitle: option === "club" ? prev.subtitle : "",
                      }))
                    }
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                      formData.type === option
                        ? "bg-[#154CB3] text-white border-[#154CB3]"
                        : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {option === "club" ? "Club" : option === "centre" ? "Centre" : "Cell"}
                  </button>
                ))}
              </div>
            </div>

            {formData.type !== "club" ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                Centre and Cell creation forms will be added next. Select <strong>Club</strong> to
                use the current creation flow.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Club name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.clubName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, clubName: e.target.value }))
                      }
                      className={`w-full px-4 py-3 rounded-lg border ${
                        errors.clubName ? "border-red-500" : "border-gray-300"
                      } focus:outline-none focus:ring-2 focus:ring-[#154CB3]`}
                      placeholder="Enter club name"
                    />
                    {errors.clubName && <p className="text-red-500 text-xs mt-1">{errors.clubName}</p>}
                  </div>

                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      Subtitle <span className="text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={formData.subtitle}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, subtitle: e.target.value }))
                      }
                      className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                      placeholder="Enter subtitle"
                    />
                  </div>
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Detailed description <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    rows={5}
                    value={formData.detailedDescription}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, detailedDescription: e.target.value }))
                    }
                    className={`w-full px-4 py-3 rounded-lg border ${
                      errors.detailedDescription ? "border-red-500" : "border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-[#154CB3]`}
                    placeholder="Provide club description"
                  />
                  {errors.detailedDescription && (
                    <p className="text-red-500 text-xs mt-1">{errors.detailedDescription}</p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Club banner: <span className="text-red-500">*</span> (max 3MB, JPG/PNG)
                  </label>
                  <div className="border border-dashed border-gray-400 rounded-xl p-6 sm:p-8 text-center hover:border-gray-500 transition-colors">
                    {imageFile ? (
                      <p className="text-gray-700 font-medium mb-3 text-sm sm:text-base">
                        New file selected: {imageFile.name}
                      </p>
                    ) : (
                      <p className="text-gray-500 mb-4 text-sm sm:text-base">
                        JPEG, PNG (max 3MB) - 2048x1080 required
                      </p>
                    )}

                    <input
                      type="file"
                      id="image-upload-input"
                      accept="image/jpeg,image/png"
                      onChange={handleBannerFileChange}
                      className="hidden"
                      required
                      aria-describedby={errors.imageFile ? "imageFile-error" : undefined}
                    />
                    <label
                      htmlFor="image-upload-input"
                      className="bg-[#154CB3] cursor-pointer text-white text-sm py-2 px-4 rounded-full font-medium hover:bg-[#154cb3eb] transition-colors focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2"
                    >
                      {imageFile ? "Change Image" : "Choose File"}
                    </label>
                    {errors.imageFile && (
                      <p id="imageFile-error" className="text-red-500 text-xs mt-2">
                        {errors.imageFile}
                      </p>
                    )}
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-semibold text-gray-900 block">
                        Club Registrations
                      </label>
                      <div className="mt-1">
                        {formData.clubRegistrations ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            ● OPEN
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700">
                            ● CLOSED
                          </span>
                        )}
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formData.clubRegistrations}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            clubRegistrations: e.target.checked,
                          }))
                        }
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#154CB3] rounded-full peer peer-checked:bg-[#154CB3] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full" />
                    </label>
                  </div>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <label className="text-sm font-semibold text-gray-900 block mb-2">
                    Campus Availability
                  </label>
                  <p className="text-xs text-gray-500 mb-3">Who can register?</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {christCampuses.map((campus) => (
                      <label key={campus} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={formData.clubCampus.includes(campus)}
                          onChange={(e) => toggleCampus(campus, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-[#154CB3] focus:ring-[#154CB3]"
                        />
                        <span>{campus}</span>
                      </label>
                    ))}
                  </div>
                  {errors.clubCampus && <p className="text-red-500 text-xs mt-2">{errors.clubCampus}</p>}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-[#063168]">Club Editors</h3>
                      <p className="text-xs text-gray-500">Add editor emails only</p>
                    </div>
                    <button
                      type="button"
                      onClick={addClubEditor}
                      disabled={formData.clubEditors.length >= 5}
                      className="bg-[#063168] px-4 py-2 rounded-full text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      + Add Club Editor
                    </button>
                  </div>

                  {formData.clubEditors.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-4 text-sm text-slate-500">
                      No club editors added yet.
                    </div>
                  )}

                  <div className="space-y-3">
                    {formData.clubEditors.map((editor, index) => (
                      <div key={editor._uiKey} className="rounded-xl border border-slate-200 bg-white p-4">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Editor {index + 1}
                          </p>
                          <button
                            type="button"
                            onClick={() => removeClubEditor(index)}
                            className="text-xs font-medium text-red-600 hover:underline"
                          >
                            Remove
                          </button>
                        </div>
                        <input
                          type="email"
                          value={editor.email}
                          onChange={(e) => {
                            const next = [...formData.clubEditors];
                            next[index] = { ...next[index], email: e.target.value };
                            setFormData((prev) => ({ ...prev, clubEditors: next }));
                          }}
                          placeholder="name@christuniversity.in"
                          className={`w-full px-4 py-2.5 rounded-lg border ${
                            errors[`clubEditor_${index}`] ? "border-red-500" : "border-gray-300"
                          } focus:outline-none focus:ring-2 focus:ring-[#154CB3]`}
                        />
                        {errors[`clubEditor_${index}`] && (
                          <p className="text-red-500 text-xs mt-1">{errors[`clubEditor_${index}`]}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <label className="block text-sm font-semibold text-gray-900">Roles Available</label>
                    </div>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowRoleDropdown((prev) => !prev)}
                        className="px-3 py-1.5 text-sm font-medium text-[#154CB3] border border-[#154CB3] rounded-full hover:bg-blue-50"
                      >
                        + Add Role
                      </button>
                      {showRoleDropdown && (
                        <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                          {PREDEFINED_ROLES.map((role) => (
                            <button
                              key={role}
                              type="button"
                              onClick={() => {
                                addRole(role);
                                setShowRoleDropdown(false);
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              {role}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setShowOtherRoleInput(true);
                              setShowRoleDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#154CB3] hover:bg-blue-50 border-t border-gray-100"
                          >
                            Others
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {showOtherRoleInput && (
                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={otherRoleInput}
                        onChange={(e) => setOtherRoleInput(e.target.value)}
                        placeholder="Enter custom role"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3]"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          addRole(otherRoleInput);
                          setOtherRoleInput("");
                          setShowOtherRoleInput(false);
                        }}
                        className="px-3 py-2 text-sm font-medium rounded-lg bg-[#154CB3] text-white hover:bg-[#0f3f95]"
                      >
                        Add
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {formData.rolesAvailable.map((role) => (
                      <span
                        key={role}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-blue-50 text-[#154CB3] border border-blue-200"
                      >
                        {role}
                        <button
                          type="button"
                          onClick={() => removeRole(role)}
                          className="text-blue-500 hover:text-red-600"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  {errors.rolesAvailable && (
                    <p className="text-red-500 text-xs mt-2">{errors.rolesAvailable}</p>
                  )}
                </div>

                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    Official Website Link
                  </label>
                  <input
                    type="url"
                    value={formData.officialWebsiteLink}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, officialWebsiteLink: e.target.value }))
                    }
                    placeholder="https://official-website.example"
                    className={`w-full px-4 py-3 rounded-lg border ${
                      errors.officialWebsiteLink ? "border-red-500" : "border-gray-300"
                    } focus:outline-none focus:ring-2 focus:ring-[#154CB3]`}
                  />
                  {errors.officialWebsiteLink && (
                    <p className="text-red-500 text-xs mt-1">{errors.officialWebsiteLink}</p>
                  )}
                </div>
              </>
            )}

            {errors.submit && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {errors.submit}
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => router.back()}
                className="px-4 py-2.5 rounded-lg border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || formData.type !== "club"}
                className="px-5 py-2.5 rounded-lg bg-[#154CB3] text-white text-sm font-semibold hover:bg-[#0f3f95] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting || isUploadingImage ? "Creating..." : "Create Club"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

