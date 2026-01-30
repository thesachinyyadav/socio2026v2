"use client";
import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";

export interface CustomField {
  id: string;
  label: string;
  type: "text" | "url" | "email" | "number" | "select" | "textarea";
  required: boolean;
  placeholder?: string;
  options?: string[]; // For select type
}

interface DynamicCustomFieldBuilderProps {
  fields: CustomField[];
  onChange: (fields: CustomField[]) => void;
  maxFields?: number;
}

const fieldTypes = [
  { value: "text", label: "Text" },
  { value: "url", label: "URL / Link" },
  { value: "email", label: "Email" },
  { value: "number", label: "Number" },
  { value: "select", label: "Dropdown" },
  { value: "textarea", label: "Long Text" },
];

export const DynamicCustomFieldBuilder: React.FC<DynamicCustomFieldBuilderProps> = ({
  fields,
  onChange,
  maxFields = 10,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form state for adding/editing
  const [formData, setFormData] = useState<Partial<CustomField>>({
    label: "",
    type: "text",
    required: false,
    placeholder: "",
    options: [],
  });
  const [optionInput, setOptionInput] = useState("");

  const resetForm = () => {
    setFormData({
      label: "",
      type: "text",
      required: false,
      placeholder: "",
      options: [],
    });
    setOptionInput("");
    setShowAddForm(false);
    setEditingId(null);
  };

  const handleAddField = () => {
    if (!formData.label?.trim()) return;

    const newField: CustomField = {
      id: uuidv4(),
      label: formData.label.trim(),
      type: formData.type as CustomField["type"],
      required: formData.required || false,
      placeholder: formData.placeholder?.trim() || undefined,
      options: formData.type === "select" ? formData.options : undefined,
    };

    onChange([...fields, newField]);
    resetForm();
  };

  const handleUpdateField = () => {
    if (!editingId || !formData.label?.trim()) return;

    const updatedFields = fields.map((f) =>
      f.id === editingId
        ? {
            ...f,
            label: formData.label!.trim(),
            type: formData.type as CustomField["type"],
            required: formData.required || false,
            placeholder: formData.placeholder?.trim() || undefined,
            options: formData.type === "select" ? formData.options : undefined,
          }
        : f
    );

    onChange(updatedFields);
    resetForm();
  };

  const handleEditClick = (field: CustomField) => {
    setFormData({
      label: field.label,
      type: field.type,
      required: field.required,
      placeholder: field.placeholder || "",
      options: field.options || [],
    });
    setEditingId(field.id);
    setShowAddForm(true);
  };

  const handleRemoveField = (id: string) => {
    onChange(fields.filter((f) => f.id !== id));
  };

  const handleAddOption = () => {
    if (!optionInput.trim()) return;
    setFormData((prev) => ({
      ...prev,
      options: [...(prev.options || []), optionInput.trim()],
    }));
    setOptionInput("");
  };

  const handleRemoveOption = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      options: prev.options?.filter((_, i) => i !== index) || [],
    }));
  };

  const getFieldTypeLabel = (type: string) => {
    return fieldTypes.find((t) => t.value === type)?.label || type;
  };

  return (
    <div className="bg-gradient-to-br from-slate-50 to-blue-50/30 rounded-2xl border border-slate-200/60 overflow-hidden">
      {/* Header Section */}
      <div className="p-6 pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 bg-gradient-to-br from-[#154CB3] to-[#063168] rounded-xl flex items-center justify-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#063168]">Custom Fields</h3>
                <span className="inline-flex items-center text-xs bg-amber-100/80 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Optional
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed">
              Add custom questions for participants during registration.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              E.g., Portfolio link, T-shirt size, dietary requirements
            </p>
          </div>
        </div>
        
        {/* Add Button - Prominent placement below header */}
        {fields.length < maxFields && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="mt-5 w-full flex items-center justify-center gap-2 px-5 py-3 bg-white border-2 border-dashed border-[#154CB3]/30 text-[#154CB3] rounded-xl hover:bg-[#154CB3] hover:text-white hover:border-solid hover:border-[#154CB3] transition-all duration-200 text-sm font-medium group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            <span>Add Custom Field</span>
            <span className="text-xs opacity-60 group-hover:opacity-80">({fields.length}/{maxFields})</span>
          </button>
        )}
      </div>

      {/* Existing Fields List */}
      {fields.length > 0 && (
        <div className="px-6 pb-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Your Custom Fields</span>
            <span className="text-xs text-gray-400">({fields.length})</span>
          </div>
          <div className="space-y-2">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="flex items-center justify-between p-3.5 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-3">
                  <span className="w-7 h-7 bg-gradient-to-br from-[#154CB3] to-[#063168] text-white rounded-lg flex items-center justify-center text-xs font-bold shadow-sm">
                    {index + 1}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#063168]">{field.label}</span>
                      {field.required && (
                        <span className="text-[10px] bg-red-50 text-red-500 px-1.5 py-0.5 rounded font-medium">Required</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-gray-500 bg-slate-100 px-2 py-0.5 rounded-md">
                        {getFieldTypeLabel(field.type)}
                      </span>
                      {field.type === "select" && field.options && (
                        <span className="text-xs text-gray-400">
                          {field.options.length} options
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => handleEditClick(field)}
                    className="p-2 text-gray-400 hover:text-[#154CB3] hover:bg-blue-50 rounded-lg transition-colors"
                    title="Edit field"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveField(field.id)}
                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove field"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="mx-6 mb-6 p-5 bg-white border-2 border-[#154CB3]/20 rounded-xl space-y-4 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <div className="w-8 h-8 bg-[#154CB3]/10 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#154CB3]" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold text-[#063168]">
              {editingId ? "Edit Custom Field" : "New Custom Field"}
            </h4>
          </div>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Field Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label || ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Portfolio Link, GitHub Repository"
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] transition-colors"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Field Type
            </label>
            <select
              value={formData.type || "text"}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomField["type"] })}
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] transition-colors bg-white"
            >
              {fieldTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Placeholder */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Placeholder Text <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={formData.placeholder || ""}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="e.g., https://drive.google.com/..."
              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] transition-colors"
            />
          </div>

          {/* Options (for select type) */}
          {formData.type === "select" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Dropdown Options
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                  placeholder="Enter an option"
                  className="flex-1 px-3.5 py-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#154CB3]/20 focus:border-[#154CB3] transition-colors"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-4 py-2.5 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
                >
                  Add
                </button>
              </div>
              {formData.options && formData.options.length > 0 && (
                <div className="flex flex-wrap gap-2 p-3 bg-slate-50 rounded-lg">
                  {formData.options.map((opt, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 text-[#063168] rounded-lg text-sm shadow-sm"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Required toggle */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
            <input
              type="checkbox"
              id="field-required"
              checked={formData.required || false}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="w-4 h-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3]"
            />
            <label htmlFor="field-required" className="text-sm text-gray-700">
              Make this field <span className="font-medium">required</span>
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={editingId ? handleUpdateField : handleAddField}
              disabled={!formData.label?.trim()}
              className="flex-1 px-4 py-2.5 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm"
            >
              {editingId ? "Update Field" : "Add This Field"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2.5 bg-slate-100 text-gray-700 rounded-lg hover:bg-slate-200 transition-colors font-medium text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {fields.length === 0 && !showAddForm && (
        <div className="mx-6 mb-6 text-center py-8 bg-white/50 rounded-xl border border-dashed border-slate-300">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto mb-3">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-600 font-medium">No custom fields yet</p>
          <p className="text-gray-400 text-sm mt-1">
            Add fields to collect extra info from participants
          </p>
        </div>
      )}

      {fields.length >= maxFields && (
        <p className="mx-6 mb-4 text-sm text-amber-600 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          Maximum {maxFields} custom fields reached
        </p>
      )}
    </div>
  );
};

export default DynamicCustomFieldBuilder;
