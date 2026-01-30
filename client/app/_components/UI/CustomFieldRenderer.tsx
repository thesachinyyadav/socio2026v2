"use client";
import React from "react";

export interface CustomField {
  id: string;
  label: string;
  type: "text" | "url" | "email" | "number" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[];
}

interface CustomFieldRendererProps {
  fields: CustomField[];
  values: Record<string, string | number>;
  onChange: (fieldId: string, value: string | number) => void;
  errors?: Record<string, string>;
}

export const CustomFieldRenderer: React.FC<CustomFieldRendererProps> = ({
  fields,
  values,
  onChange,
  errors = {},
}) => {
  if (!fields || fields.length === 0) return null;

  const renderField = (field: CustomField) => {
    const value = values[field.id] || "";
    const error = errors[field.id];
    const baseInputClass = `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-colors ${
      error ? "border-red-500" : "border-gray-300"
    }`;

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            rows={3}
            className={baseInputClass}
          />
        );

      case "select":
        return (
          <select
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            className={baseInputClass}
          >
            <option value="">{field.placeholder || "Select an option"}</option>
            {field.options?.map((opt, idx) => (
              <option key={idx} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <input
            type="number"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );

      case "url":
        return (
          <input
            type="url"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || "https://..."}
            className={baseInputClass}
          />
        );

      case "email":
        return (
          <input
            type="email"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || "email@example.com"}
            className={baseInputClass}
          />
        );

      case "text":
      default:
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="border-t border-gray-200 pt-4">
        <h3 className="text-lg font-semibold text-[#063168] mb-3">
          Additional Information
        </h3>
        <p className="text-sm text-gray-500 mb-4">
          The event organizer requires the following information
        </p>
      </div>

      {fields.map((field) => (
        <div key={field.id}>
          <label
            htmlFor={field.id}
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            {field.label}
            {field.required && <span className="text-red-500 ml-1">*</span>}
          </label>
          {renderField(field)}
          {errors[field.id] && (
            <p className="mt-1 text-sm text-red-500">{errors[field.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
};

// Validation helper
export const validateCustomFields = (
  fields: CustomField[],
  values: Record<string, string | number>
): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    const value = values[field.id];
    const stringValue = String(value || "").trim();

    // Required validation
    if (field.required && !stringValue) {
      errors[field.id] = `${field.label} is required`;
      continue;
    }

    // Skip further validation if field is empty and not required
    if (!stringValue) continue;

    // Type-specific validation
    switch (field.type) {
      case "email":
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(stringValue)) {
          errors[field.id] = "Please enter a valid email address";
        }
        break;

      case "url":
        try {
          new URL(stringValue);
        } catch {
          errors[field.id] = "Please enter a valid URL (starting with http:// or https://)";
        }
        break;

      case "number":
        if (isNaN(Number(stringValue))) {
          errors[field.id] = "Please enter a valid number";
        }
        break;

      case "select":
        if (field.options && !field.options.includes(stringValue)) {
          errors[field.id] = "Please select a valid option";
        }
        break;
    }
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export default CustomFieldRenderer;
