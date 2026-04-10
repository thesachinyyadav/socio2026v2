"use client";

import { useEffect, useMemo, useState } from "react";
import type { DepartmentOption, SchoolOption } from "./types";

type DomainScopeModalProps = {
  isOpen: boolean;
  mode: "hod" | "dean";
  userName: string;
  departments: DepartmentOption[];
  schools: SchoolOption[];
  initialValue: string | null;
  onCancel: () => void;
  onConfirm: (selectedValue: string) => void;
};

export default function DomainScopeModal({
  isOpen,
  mode,
  userName,
  departments,
  schools,
  initialValue,
  onCancel,
  onConfirm,
}: DomainScopeModalProps) {
  const options = useMemo(() => {
    if (mode === "hod") {
      return departments.map((department) => ({
        id: department.id,
        label: department.school
          ? `${department.department_name} (${department.school})`
          : department.department_name,
      }));
    }

    return schools.map((school) => ({
      id: school.id,
      label: school.name,
    }));
  }, [mode, departments, schools]);

  const [selectedValue, setSelectedValue] = useState<string>("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (initialValue) {
      setSelectedValue(initialValue);
      return;
    }

    setSelectedValue(options[0]?.id || "");
  }, [isOpen, initialValue, options]);

  if (!isOpen) {
    return null;
  }

  const title = mode === "hod" ? "Assign Department" : "Assign School";
  const helperText =
    mode === "hod"
      ? `Select a department for ${userName} before enabling HOD.`
      : `Select a school for ${userName} before enabling Dean.`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/55 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="mt-2 text-sm text-slate-600">{helperText}</p>

        <div className="mt-5">
          <label
            htmlFor="domain-select"
            className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500"
          >
            {mode === "hod" ? "Department" : "School"}
          </label>
          <select
            id="domain-select"
            value={selectedValue}
            onChange={(event) => setSelectedValue(event.target.value)}
            className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200"
          >
            {options.length === 0 ? (
              <option value="">
                {mode === "hod"
                  ? "No departments available"
                  : "No schools available"}
              </option>
            ) : (
              options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))
            )}
          </select>
        </div>

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
            onClick={() => onConfirm(selectedValue)}
            disabled={!selectedValue}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
