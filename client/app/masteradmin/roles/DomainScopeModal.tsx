"use client";

import { useEffect, useMemo, useState } from "react";
import type { DepartmentOption, SchoolOption, VenueOption } from "./types";

export type DomainScopeMode = "hod" | "dean" | "cfo" | "venue_manager";

export type DomainSelection = {
  scopeValue: string | null;
  campusValue: string | null;
};

type DomainScopeModalProps = {
  isOpen: boolean;
  mode: DomainScopeMode;
  userName: string;
  departments: DepartmentOption[];
  schools: SchoolOption[];
  campuses: string[];
  venues: VenueOption[];
  initialScopeValue: string | null;
  initialCampusValue: string | null;
  onCancel: () => void;
  onConfirm: (selection: DomainSelection) => void;
};

type SelectOption = {
  id: string;
  label: string;
};

export default function DomainScopeModal({
  isOpen,
  mode,
  userName,
  departments,
  schools,
  campuses,
  venues,
  initialScopeValue,
  initialCampusValue,
  onCancel,
  onConfirm,
}: DomainScopeModalProps) {
  const options = useMemo<SelectOption[]>(() => {
    if (mode === "hod") {
      return departments.map((department) => ({
        id: department.id,
        label: department.school
          ? `${department.department_name} (${department.school})`
          : department.department_name,
      }));
    }

    if (mode === "dean") {
      return schools.map((school) => ({
        id: school.id,
        label: school.name,
      }));
    }

    if (mode === "cfo") {
      return campuses.map((campus) => ({
        id: campus,
        label: campus,
      }));
    }

    return venues.map((venue) => ({
      id: venue.id,
      label: venue.campus ? `${venue.name} (${venue.campus})` : venue.name,
    }));
  }, [mode, departments, schools, campuses, venues]);

  const [selectedScope, setSelectedScope] = useState<string>("");
  const [selectedCampus, setSelectedCampus] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (mode === "cfo") {
      const cfoCampus = initialCampusValue || initialScopeValue || options[0]?.id || "";
      setSelectedScope(cfoCampus);
      setSelectedCampus(cfoCampus);
      return;
    }

    setSelectedScope(initialScopeValue || options[0]?.id || "");
    setSelectedCampus(initialCampusValue || campuses[0] || "");
  }, [isOpen, initialScopeValue, initialCampusValue, options, campuses, mode]);

  if (!isOpen) {
    return null;
  }

  const titleByMode: Record<DomainScopeMode, string> = {
    hod: "Assign Department & Campus",
    dean: "Assign School & Campus",
    cfo: "Assign Campus",
    venue_manager: "Assign Venue & Campus",
  };

  const helperByMode: Record<DomainScopeMode, string> = {
    hod: `Select department and campus for ${userName} before enabling HOD.`,
    dean: `Select school and campus for ${userName} before enabling Dean.`,
    cfo: `Select a campus for ${userName} before enabling CFO.`,
    venue_manager: `Select venue and campus for ${userName} before enabling Venue Manager.`,
  };

  const labelByMode: Record<DomainScopeMode, string> = {
    hod: "Department",
    dean: "School",
    cfo: "Campus",
    venue_manager: "Venue",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">{titleByMode[mode]}</h2>
        <p className="mt-2 text-sm text-slate-600">{helperByMode[mode]}</p>

        <div className="mt-5">
          <label
            htmlFor="domain-select"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {labelByMode[mode]}
          </label>
          <select
            id="domain-select"
            value={selectedScope}
            onChange={(event) => {
              const nextScope = event.target.value;
              setSelectedScope(nextScope);

              if (mode === "cfo") {
                setSelectedCampus(nextScope);
              }
            }}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#154CB3] focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            {options.length === 0 ? (
              <option value="">No options available</option>
            ) : (
              options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>

        {mode !== "cfo" && (
          <div className="mt-4">
            <label
              htmlFor="campus-select"
              className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Campus
            </label>
            <select
              id="campus-select"
              value={selectedCampus}
              onChange={(event) => setSelectedCampus(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#154CB3] focus:outline-none focus:ring-2 focus:ring-blue-100"
            >
              {campuses.length === 0 ? (
                <option value="">No campuses available</option>
              ) : (
                campuses.map((campus) => (
                  <option key={campus} value={campus}>
                    {campus}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                scopeValue: selectedScope || null,
                campusValue: mode === "cfo" ? selectedScope || null : selectedCampus || null,
              })
            }
            disabled={!selectedScope || (mode !== "cfo" && !selectedCampus)}
            className="rounded-lg bg-[#154CB3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#154cb3df] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
