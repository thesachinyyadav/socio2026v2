"use client";

import { useState, useRef, useEffect } from "react";
import { Clock, X } from "lucide-react";

interface DateTimePickerAdminProps {
  value: string | null;
  onChange: (isoString: string | null) => void;
  onClear?: () => void;
  colorScheme?: "blue" | "green" | "red";
  label?: string;
}

export default function DateTimePickerAdmin({
  value,
  onChange,
  onClear,
  colorScheme = "blue",
  label = "Set expiration date & time",
}: DateTimePickerAdminProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<"bottom" | "top">("bottom");

  // Calculate position when opening
  useEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      const dropdownHeight = 420; // Approximate height of dropdown
      
      // If not enough space below but enough above, open upward
      if (spaceBelow < dropdownHeight && spaceAbove > dropdownHeight) {
        setPosition("top");
      } else {
        setPosition("bottom");
      }
    }
  }, [isOpen]);

  // Parse ISO string to get date and time separately
  const parseDateTime = (isoString: string | null) => {
    if (!isoString) return { date: "", time: "00:00" };
    const date = new Date(isoString);
    const dateStr = date.toISOString().split("T")[0];
    const timeStr = date.toTimeString().slice(0, 5);
    return { date: dateStr, time: timeStr };
  };

  const { date: currentDate, time: currentTime } = parseDateTime(value);

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    const time = currentTime || "00:00";
    if (newDate) {
      const isoString = new Date(`${newDate}T${time}`).toISOString();
      onChange(isoString);
    }
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    const date = currentDate;
    if (date) {
      const isoString = new Date(`${date}T${newTime}`).toISOString();
      onChange(isoString);
    }
  };

  const handleClear = () => {
    onChange(null);
    if (onClear) onClear();
    setIsOpen(false);
  };

  const colorClasses = {
    blue: {
      btn: "border-[#154CB3] hover:bg-blue-50",
      text: "text-[#154CB3]",
      focus: "focus:border-[#154CB3]",
      icon: "text-[#154CB3]",
    },
    green: {
      btn: "border-green-500 hover:bg-green-50",
      text: "text-green-600",
      focus: "focus:border-green-500",
      icon: "text-green-600",
    },
    red: {
      btn: "border-red-500 hover:bg-red-50",
      text: "text-red-600",
      focus: "focus:border-red-500",
      icon: "text-red-600",
    },
  };

  const colors = colorClasses[colorScheme];

  return (
    <div className="relative">
      <div
        ref={triggerRef}
        className={`flex items-center gap-2 px-3 py-2 border-2 rounded-lg cursor-pointer transition-all ${colors.btn} ${colors.focus}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <Clock className={`w-4 h-4 ${colors.icon}`} />
        {value ? (
          <div className="flex flex-col">
            <span className={`text-xs font-medium ${colors.text}`}>
              {new Date(value).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span className={`text-xs ${colors.text}`}>
              {new Date(value).toLocaleTimeString("en-IN", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        ) : (
          <span className="text-xs text-gray-500">{label}</span>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className={`absolute ${position === "top" ? "bottom-full mb-2" : "top-full mt-2"} left-0 bg-white border-2 border-gray-200 rounded-lg shadow-xl z-[100] p-4 w-72 max-h-[400px] overflow-y-auto`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className={`w-5 h-5 ${colors.icon}`} />
              <h3 className="font-semibold text-gray-800">{label}</h3>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Date & Time Selection */}
          <div className="space-y-3 mb-4">
            {/* Date Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Date
              </label>
              <input
                type="date"
                value={currentDate}
                onChange={handleDateChange}
                className={`w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm ${colors.focus} focus:ring-1 focus:ring-offset-0`}
              />
            </div>

            {/* Time Input */}
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                Time (24-hour format)
              </label>
              <input
                type="time"
                value={currentTime}
                onChange={handleTimeChange}
                className={`w-full px-3 py-2 border-2 border-gray-200 rounded-lg text-sm ${colors.focus} focus:ring-1 focus:ring-offset-0`}
              />
            </div>

            {/* Display preview */}
            {value && (
              <div className="bg-gray-50 p-2 rounded-lg text-xs text-gray-600">
                <strong>Expires:</strong>{" "}
                {new Date(value).toLocaleDateString("en-IN", {
                  weekday: "short",
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                IST
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            {value && (
              <button
                onClick={handleClear}
                className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${colors.text} border border-gray-200 hover:bg-gray-50`}
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setIsOpen(false)}
              className={`flex-1 px-3 py-2 text-xs font-semibold rounded-lg text-white transition-colors ${
                colorScheme === "blue"
                  ? "bg-[#154CB3] hover:bg-blue-700"
                  : colorScheme === "green"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
              }`}
            >
              Set
            </button>
          </div>

          {/* Preset buttons */}
          <div className="mt-3 pt-3 border-t border-gray-200 space-y-2">
            <p className="text-xs font-semibold text-gray-600">Quick presets:</p>
            <div className="grid grid-cols-2 gap-2">
              {["1 week", "1 month", "3 months", "6 months"].map((preset) => (
                <button
                  key={preset}
                  onClick={() => {
                    const date = new Date();
                    if (preset === "1 week") date.setDate(date.getDate() + 7);
                    else if (preset === "1 month") date.setMonth(date.getMonth() + 1);
                    else if (preset === "3 months") date.setMonth(date.getMonth() + 3);
                    else if (preset === "6 months") date.setMonth(date.getMonth() + 6);

                    onChange(date.toISOString());
                    setIsOpen(false);
                  }}
                  className={`px-2 py-1 text-xs font-medium rounded border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-gray-700`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Overlay to close picker when clicking outside */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
