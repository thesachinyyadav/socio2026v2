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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-[#063168]">Custom Fields</h3>
          <p className="text-sm text-gray-500">
            Add custom fields that participants must fill during registration (e.g., portfolio links, GitHub repos)
          </p>
        </div>
        {fields.length < maxFields && !showAddForm && (
          <button
            type="button"
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors text-sm font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            Add Custom Field
          </button>
        )}
      </div>

      {/* Existing Fields List */}
      {fields.length > 0 && (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div
              key={field.id}
              className="flex items-center justify-between p-3 bg-[#f5f8fe] border border-[#e0e7f1] rounded-lg"
            >
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 bg-[#154CB3] text-white rounded-full flex items-center justify-center text-xs font-bold">
                  {index + 1}
                </span>
                <div>
                  <span className="font-medium text-[#063168]">{field.label}</span>
                  {field.required && (
                    <span className="ml-2 text-xs text-red-500">*Required</span>
                  )}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 bg-white px-2 py-0.5 rounded">
                      {getFieldTypeLabel(field.type)}
                    </span>
                    {field.type === "select" && field.options && (
                      <span className="text-xs text-gray-400">
                        ({field.options.length} options)
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleEditClick(field)}
                  className="p-1.5 text-gray-500 hover:text-[#154CB3] hover:bg-white rounded transition-colors"
                  title="Edit field"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveField(field.id)}
                  className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-white rounded transition-colors"
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
      )}

      {/* Add/Edit Form */}
      {showAddForm && (
        <div className="p-4 bg-white border-2 border-[#154CB3] rounded-lg space-y-4">
          <h4 className="font-semibold text-[#063168]">
            {editingId ? "Edit Custom Field" : "Add Custom Field"}
          </h4>

          {/* Label */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.label || ""}
              onChange={(e) => setFormData({ ...formData, label: e.target.value })}
              placeholder="e.g., Portfolio Link, GitHub Repository"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            />
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Field Type
            </label>
            <select
              value={formData.type || "text"}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as CustomField["type"] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Placeholder Text (Optional)
            </label>
            <input
              type="text"
              value={formData.placeholder || ""}
              onChange={(e) => setFormData({ ...formData, placeholder: e.target.value })}
              placeholder="e.g., https://drive.google.com/..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
            />
          </div>

          {/* Options (for select type) */}
          {formData.type === "select" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dropdown Options
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={optionInput}
                  onChange={(e) => setOptionInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddOption())}
                  placeholder="Enter an option"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Add
                </button>
              </div>
              {formData.options && formData.options.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {formData.options.map((opt, idx) => (
                    <span
                      key={idx}
                      className="flex items-center gap-1 px-2 py-1 bg-[#e9f0fd] text-[#154CB3] rounded text-sm"
                    >
                      {opt}
                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="hover:text-red-500"
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
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="field-required"
              checked={formData.required || false}
              onChange={(e) => setFormData({ ...formData, required: e.target.checked })}
              className="w-4 h-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3]"
            />
            <label htmlFor="field-required" className="text-sm text-gray-700">
              This field is required
            </label>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={editingId ? handleUpdateField : handleAddField}
              disabled={!formData.label?.trim()}
              className="px-4 py-2 bg-[#154CB3] text-white rounded-lg hover:bg-[#063168] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {editingId ? "Update Field" : "Add Field"}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {fields.length === 0 && !showAddForm && (
        <div className="text-center py-6 bg-[#f5f8fe] rounded-lg border-2 border-dashed border-[#e0e7f1]">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-sm">No custom fields added yet</p>
          <p className="text-gray-400 text-xs mt-1">
            Click "Add Custom Field" to create fields participants will fill during registration
          </p>
        </div>
      )}

      {fields.length >= maxFields && (
        <p className="text-sm text-amber-600">
          Maximum {maxFields} custom fields allowed
        </p>
      )}
    </div>
  );
};

export default DynamicCustomFieldBuilder;
