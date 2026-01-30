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

// Type icons for different field types
const TypeIcon: React.FC<{ type: CustomField["type"] }> = ({ type }) => {
  const iconClass = "w-4 h-4 text-[#154CB3]";
  
  switch (type) {
    case "email":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
          <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
        </svg>
      );
    case "url":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
        </svg>
      );
    case "number":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.578a18.87 18.87 0 01-1.724 4.78c.29.354.596.696.914 1.026a1 1 0 11-1.44 1.389c-.188-.196-.373-.396-.554-.6a19.098 19.098 0 01-3.107 3.567 1 1 0 01-1.334-1.49 17.087 17.087 0 003.13-3.733 18.992 18.992 0 01-1.487-2.494 1 1 0 111.79-.89c.234.47.489.928.764 1.372.417-.934.752-1.913.997-2.927H3a1 1 0 110-2h3V3a1 1 0 011-1zm6 6a1 1 0 01.894.553l2.991 5.982a.869.869 0 01.02.037l.99 1.98a1 1 0 11-1.79.895L15.383 16h-4.764l-.724 1.447a1 1 0 11-1.788-.894l.99-1.98.019-.038 2.99-5.982A1 1 0 0113 8zm-1.382 6h2.764L13 11.236 11.618 14z" />
        </svg>
      );
    case "select":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      );
    case "textarea":
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
        </svg>
      );
    default:
      return (
        <svg xmlns="http://www.w3.org/2000/svg" className={iconClass} viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm3 1h6v4H7V5zm6 6H7v2h6v-2z" clipRule="evenodd" />
        </svg>
      );
  }
};

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
    const baseInputClass = `w-full px-4 py-3 border-2 rounded-xl focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] transition-all duration-200 text-gray-800 placeholder-gray-400 ${
      error 
        ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-200" 
        : "border-gray-200 bg-white hover:border-gray-300"
    }`;

    switch (field.type) {
      case "textarea":
        return (
          <textarea
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            rows={4}
            className={`${baseInputClass} resize-none`}
          />
        );

      case "select":
        return (
          <div className="relative">
            <select
              id={field.id}
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              className={`${baseInputClass} appearance-none cursor-pointer pr-10`}
            >
              <option value="">{field.placeholder || "Select an option..."}</option>
              {field.options?.map((opt, idx) => (
                <option key={idx} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        );

      case "number":
        return (
          <input
            type="number"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || "Enter a number..."}
            className={baseInputClass}
          />
        );

      case "url":
        return (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              type="url"
              id={field.id}
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || "https://example.com"}
              className={`${baseInputClass} pl-10`}
            />
          </div>
        );

      case "email":
        return (
          <div className="relative">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <svg className="w-5 h-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <input
              type="email"
              id={field.id}
              value={value}
              onChange={(e) => onChange(field.id, e.target.value)}
              placeholder={field.placeholder || "your@email.com"}
              className={`${baseInputClass} pl-10`}
            />
          </div>
        );

      case "text":
      default:
        return (
          <input
            type="text"
            id={field.id}
            value={value}
            onChange={(e) => onChange(field.id, e.target.value)}
            placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}...`}
            className={baseInputClass}
          />
        );
    }
  };

  return (
    <div className="space-y-5">
      {fields.map((field, index) => (
        <div 
          key={field.id} 
          className={`bg-white rounded-xl p-4 sm:p-5 border-2 transition-all duration-200 ${
            errors[field.id] 
              ? 'border-red-200 shadow-sm shadow-red-100' 
              : 'border-gray-100 hover:border-[#154CB3]/30 hover:shadow-md'
          }`}
        >
          {/* Field Header */}
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-[#154CB3]/10 flex items-center justify-center">
                <TypeIcon type={field.type} />
              </div>
              <label
                htmlFor={field.id}
                className="text-sm sm:text-base font-semibold text-gray-800"
              >
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-1 font-bold">*</span>
                )}
              </label>
            </div>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${
              field.required 
                ? 'bg-red-100 text-red-600' 
                : 'bg-gray-100 text-gray-500'
            }`}>
              {field.required ? 'Required' : 'Optional'}
            </span>
          </div>
          
          {/* Field Type Hint */}
          <p className="text-xs text-gray-400 mb-3 capitalize">
            {field.type === 'url' ? 'Website Link' : field.type} field
            {field.options && field.options.length > 0 && ` • ${field.options.length} options`}
          </p>
          
          {/* Input Field */}
          {renderField(field)}
          
          {/* Error Message */}
          {errors[field.id] && (
            <div className="flex items-center gap-2 mt-2">
              <svg className="w-4 h-4 text-red-500 flex-shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <p className="text-sm text-red-500 font-medium">{errors[field.id]}</p>
            </div>
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
