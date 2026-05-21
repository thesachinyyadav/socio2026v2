"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Download, Sparkles, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import {
  CHECKLIST_ITEMS,
  deriveDefaultsFromEvent,
  generateIQACDocx,
  IQACReportEventData,
  IQACReportInput,
} from "@/lib/iqacReport";

const LS_PREFIX = "iqac_report_draft_";

type Props = {
  open: boolean;
  onClose: () => void;
  // Pass an array; the panel renders one event at a time with Next/Back nav.
  events: IQACReportEventData[];
};

type FieldSpec = {
  key: keyof IQACReportInput;
  label: string;
  multiline?: boolean;
  rows?: number;
  hint?: string;
  autoFilled?: boolean;
};

const EVENT_INFO_FIELDS: FieldSpec[] = [
  { key: "department", label: "Department", autoFilled: true },
  { key: "campus", label: "Campus", autoFilled: true, hint: "Used in header/footer of the doc" },
  { key: "eventTitle", label: "Event Title", autoFilled: true },
  { key: "noOfActivities", label: "No of Activities", hint: "Sub-events / sessions under this event" },
  { key: "dateAndTime", label: "Date and Time", autoFilled: true },
  { key: "venue", label: "Venue", autoFilled: true },
  { key: "academicYear", label: "Academic Year", autoFilled: true, hint: "e.g. 2025-2026" },
  { key: "eventTypeFocus", label: "Event Type (Focus)", hint: "Workshop, Seminar, Guest Lecture, Fest, etc." },
  { key: "blogLink", label: "Blog Link" },
];

const PARTICIPANT_FIELDS: FieldSpec[] = [
  { key: "targetAudience", label: "Target Audience", hint: "Students / Faculty / External / Open to Public" },
  { key: "externalAgencies", label: "External Agencies, Speakers, Guests with Affiliation", multiline: true, rows: 3 },
  { key: "externalContact", label: "Website / Contact of External Members", multiline: true, rows: 2 },
  { key: "eventCoordinators", label: "Event Coordinators", autoFilled: true },
  { key: "noOfStudentVolunteers", label: "No of Student Volunteers" },
  { key: "noOfAttendees", label: "No of Attendees / Participants", autoFilled: true, hint: "Auto-filled from attendance data" },
];

const SUMMARY_FIELDS: FieldSpec[] = [
  { key: "summary", label: "Summary of the Overall Event", multiline: true, rows: 8 },
];

const OUTCOME_FIELDS: FieldSpec[] = [
  { key: "outcome1", label: "Outcome 1", multiline: true, rows: 2 },
  { key: "outcome2", label: "Outcome 2", multiline: true, rows: 2 },
  { key: "goalAchievement", label: "Goal Achievement", multiline: true, rows: 3, hint: "Were event objectives met? How and to what extent?" },
  { key: "keyTakeaways", label: "Key Takeaways", multiline: true, rows: 3 },
];

const ANALYSIS_FIELDS: FieldSpec[] = [
  { key: "impactOnStakeholders", label: "Impact on Stakeholders", multiline: true, rows: 3, hint: "Students, staff, industry, etc." },
  { key: "innovationsBestPractices", label: "Innovations / Best Practices", multiline: true, rows: 3 },
];

const RELEVANCE_FIELDS: FieldSpec[] = [
  { key: "posAndPsos", label: "PO's & PSO's", multiline: true, rows: 3, hint: "POs/PSOs the activity maps to" },
  { key: "needsOrGraduateAttributes", label: "Local / Regional / National / Global Needs OR Graduate Attributes", multiline: true, rows: 3 },
  { key: "contemporaryRequirements", label: "Contemporary Requirements", multiline: true, rows: 3, hint: "Employability / Entrepreneurship / Skill Development / Professional Requirements" },
  { key: "valueSystems", label: "Support to Value Systems", multiline: true, rows: 3, hint: "Gender, Environment, SDGs, Social Commitment, etc." },
];

const FINAL_FIELDS: FieldSpec[] = [
  { key: "suggestionsForImprovement", label: "Suggestions for Improvement / Feedback from IQAC", multiline: true, rows: 6 },
  { key: "signOffDate", label: "Date (Sign-off)", autoFilled: true },
  {
    key: "footerAddress",
    label: "Footer Address Line",
    autoFilled: true,
    hint: "Auto-filled from campus. Appears under the campus name on page 1.",
  },
];

const ALL_SECTIONS: { title: string; fields: FieldSpec[] }[] = [
  { title: "Event Information", fields: EVENT_INFO_FIELDS },
  { title: "Participants Information", fields: PARTICIPANT_FIELDS },
  { title: "Summary of the Event", fields: SUMMARY_FIELDS },
  { title: "Outcomes of the Event", fields: OUTCOME_FIELDS },
  { title: "Analysis", fields: ANALYSIS_FIELDS },
  { title: "Relevance of the Event", fields: RELEVANCE_FIELDS },
  { title: "Suggestions & Sign-off", fields: FINAL_FIELDS },
];

export default function IQACReportPanel({ open, onClose, events }: Props) {
  const [input, setInput] = useState<IQACReportInput | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Stable localStorage key based on the event-set so the cursor persists
  // across refresh for the same set of events.
  const indexLsKey = useMemo(() => {
    if (events.length === 0) return null;
    return `iqac_panel_index_${events.map((e) => e.event_id).sort().join("_")}`;
  }, [events]);

  // On open (or when the event list changes), restore the saved cursor.
  useEffect(() => {
    if (!open) return;
    if (!indexLsKey) {
      setCurrentIndex(0);
      return;
    }
    try {
      const saved = localStorage.getItem(indexLsKey);
      const idx = saved !== null ? parseInt(saved, 10) : 0;
      if (Number.isFinite(idx) && idx >= 0 && idx < events.length) {
        setCurrentIndex(idx);
      } else {
        setCurrentIndex(0);
      }
    } catch {
      setCurrentIndex(0);
    }
  }, [open, indexLsKey, events.length]);

  // Persist the cursor on every change.
  useEffect(() => {
    if (!open || !indexLsKey) return;
    try {
      localStorage.setItem(indexLsKey, String(currentIndex));
    } catch {
      // ignore
    }
  }, [open, indexLsKey, currentIndex]);

  const event = events[currentIndex] || null;
  const totalEvents = events.length;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < totalEvents - 1;

  const lsKey = useMemo(
    () => (event ? `${LS_PREFIX}${event.event_id}` : null),
    [event]
  );

  useEffect(() => {
    if (!event) {
      setInput(null);
      return;
    }
    const defaults = deriveDefaultsFromEvent(event);
    if (lsKey) {
      try {
        const raw = localStorage.getItem(lsKey);
        if (raw) {
          const saved = JSON.parse(raw) as Partial<IQACReportInput>;
          setInput({ ...defaults, ...saved, checklist: { ...defaults.checklist, ...(saved.checklist || {}) } });
          return;
        }
      } catch {
        // ignore corrupt draft
      }
    }
    setInput(defaults);
  }, [event, lsKey]);

  // Persist on every change
  useEffect(() => {
    if (!input || !lsKey) return;
    try {
      localStorage.setItem(lsKey, JSON.stringify(input));
    } catch {
      // quota or unavailable
    }
  }, [input, lsKey]);

  if (!open || !event || !input) return null;

  const setField = (key: keyof IQACReportInput, value: string) => {
    setInput((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggleChecklist = (key: string) => {
    setInput((prev) =>
      prev ? { ...prev, checklist: { ...prev.checklist, [key]: !prev.checklist[key] } } : prev
    );
  };

  const allChecked = input
    ? CHECKLIST_ITEMS.every((item) => !!input.checklist[item.key])
    : false;

  const toggleAllChecklist = () => {
    setInput((prev) => {
      if (!prev) return prev;
      const target = !allChecked;
      const next: Record<string, boolean> = {};
      CHECKLIST_ITEMS.forEach((item) => {
        next[item.key] = target;
      });
      return { ...prev, checklist: next };
    });
  };

  const resetToAutoFilled = () => {
    if (!event) return;
    if (!confirm("Reset all fields to auto-filled defaults? Your manual entries for this event will be cleared.")) return;
    const defaults = deriveDefaultsFromEvent(event);
    setInput(defaults);
    if (lsKey) localStorage.removeItem(lsKey);
  };

  const handleDownload = async () => {
    if (!input) return;
    setIsGenerating(true);
    try {
      await generateIQACDocx(input);
      // After a successful download, auto-advance to the next event if there
      // are more to fill. Stay on the last one when finished.
      if (hasNext) {
        setCurrentIndex((i) => i + 1);
      }
    } catch (e) {
      console.error("Failed to generate docx", e);
      alert("Failed to generate the document. Check the console for details.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Centered modal panel */}
      <aside className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col animate-[modalIn_180ms_ease-out] overflow-hidden">
        <style>{`@keyframes modalIn { from { transform: scale(0.96); opacity: 0; } to { transform: scale(1); opacity: 1; } }`}</style>

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-[#0f2557] to-[#154cb3] text-white">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide opacity-80">
                <Sparkles className="w-3.5 h-3.5" />
                IQAC Activity Report
                {totalEvents > 1 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded bg-white/15 text-[10px]">
                    Event {currentIndex + 1} of {totalEvents}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold mt-1">{event.title}</h2>
              <p className="text-xs opacity-80 mt-0.5">
                Fill blanks below. Auto-filled fields are editable. Saved as draft in your browser.
              </p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          {totalEvents > 1 && (
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/15">
              <button
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                disabled={!hasPrev}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  hasPrev ? "bg-white/15 hover:bg-white/25" : "opacity-40 cursor-not-allowed"
                }`}
              >
                <ChevronLeft className="w-3.5 h-3.5" /> Back
              </button>
              <span className="text-[11px] opacity-80">
                Each event downloads as its own .docx
              </span>
              <button
                onClick={() => setCurrentIndex((i) => Math.min(totalEvents - 1, i + 1))}
                disabled={!hasNext}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  hasNext ? "bg-white/15 hover:bg-white/25" : "opacity-40 cursor-not-allowed"
                }`}
              >
                Next <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
          {ALL_SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-sm font-bold text-[#0f2557] uppercase tracking-wide mb-3 pb-1.5 border-b border-slate-200">
                {section.title}
              </h3>
              <div className="space-y-3">
                {section.fields.map((f) => {
                  const value = (input[f.key] as string) || "";
                  return (
                    <div key={String(f.key)}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-semibold text-slate-700">
                          {f.label}
                        </label>
                      </div>
                      {f.multiline ? (
                        <textarea
                          rows={f.rows ?? 3}
                          value={value}
                          onChange={(e) => setField(f.key, e.target.value)}
                          placeholder={f.hint || ""}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#154cb3]/30 resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={value}
                          onChange={(e) => setField(f.key, e.target.value)}
                          placeholder={f.hint || ""}
                          className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#154cb3]/30"
                        />
                      )}
                      {f.hint && !f.multiline && (
                        <p className="text-[11px] text-slate-400 mt-0.5">{f.hint}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}

          {/* Checklist */}
          <section>
            <div className="flex items-center justify-between mb-3 pb-1.5 border-b border-slate-200">
              <h3 className="text-sm font-bold text-[#0f2557] uppercase tracking-wide">
                Attachment Checklist
              </h3>
              <button
                type="button"
                onClick={toggleAllChecklist}
                className="text-xs font-semibold text-[#154cb3] hover:underline"
              >
                {allChecked ? "Deselect All" : "Select All"}
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Tick items you have ready. Checked items appear marked in the doc.
            </p>
            <div className="space-y-1.5">
              {CHECKLIST_ITEMS.map((item) => (
                <label
                  key={item.key}
                  className="flex items-start gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={!!input.checklist[item.key]}
                    onChange={() => toggleChecklist(item.key)}
                    className="mt-0.5 h-4 w-4 text-[#154cb3] border-slate-300 rounded cursor-pointer"
                  />
                  <span className="text-xs text-slate-700">{item.label}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Optional Appendix Pages */}
          <section>
            <h3 className="text-sm font-bold text-[#0f2557] uppercase tracking-wide mb-3 pb-1.5 border-b border-slate-200">
              Optional Appendix Pages
            </h3>
            <p className="text-xs text-slate-500 mb-3">
              Tick to include these reference pages at the end of the generated doc. Off by default.
            </p>
            <div className="space-y-1.5">
              <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!input.includeHelpTextPage}
                  onChange={(e) =>
                    setInput((prev) =>
                      prev ? { ...prev, includeHelpTextPage: e.target.checked } : prev
                    )
                  }
                  className="mt-0.5 h-4 w-4 text-[#154cb3] border-slate-300 rounded cursor-pointer"
                />
                <span className="text-xs text-slate-700">
                  Help Text for Filling Facing Sheet (Page 7)
                </span>
              </label>
              <label className="flex items-start gap-2.5 p-2 rounded-md hover:bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={!!input.includeMetricsPage}
                  onChange={(e) =>
                    setInput((prev) =>
                      prev ? { ...prev, includeMetricsPage: e.target.checked } : prev
                    )
                  }
                  className="mt-0.5 h-4 w-4 text-[#154cb3] border-slate-300 rounded cursor-pointer"
                />
                <span className="text-xs text-slate-700">
                  Various Metrics of Events (Page 8)
                </span>
              </label>
            </div>
          </section>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 px-6 py-4 border-t border-slate-200 bg-slate-50">
          <button
            onClick={resetToAutoFilled}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to auto-filled
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
            >
              Close
            </button>
            <button
              onClick={handleDownload}
              disabled={isGenerating}
              className={`flex items-center gap-2 px-5 py-2 bg-[#154cb3] text-white text-sm font-bold rounded-lg shadow-md hover:bg-[#124099] transition-all ${
                isGenerating ? "opacity-50 cursor-wait" : ""
              }`}
            >
              <Download className="w-4 h-4" />
              {isGenerating ? "Generating…" : "Download .docx"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
