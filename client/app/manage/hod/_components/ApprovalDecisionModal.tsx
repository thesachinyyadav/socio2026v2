"use client";

type DecisionMode = "reject" | "return";

interface ApprovalDecisionModalProps {
  isOpen: boolean;
  mode: DecisionMode;
  eventName: string;
  note: string;
  minCharacters: number;
  isSubmitting: boolean;
  errorMessage: string | null;
  onNoteChange: (nextValue: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export default function ApprovalDecisionModal({
  isOpen,
  mode,
  eventName,
  note,
  minCharacters,
  isSubmitting,
  errorMessage,
  onNoteChange,
  onClose,
  onSubmit,
}: ApprovalDecisionModalProps) {
  if (!isOpen) {
    return null;
  }

  const noteLength = note.trim().length;
  const canSubmit = noteLength >= minCharacters && !isSubmitting;
  const heading = mode === "reject" ? "Reject Request" : "Return for Revision";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 px-6 py-4">
          <h3 className="text-lg font-semibold text-slate-900">{heading}</h3>
          <p className="mt-1 text-sm text-slate-600">{eventName}</p>
        </div>

        <div className="space-y-3 px-6 py-5">
          <label htmlFor="decision-note" className="text-sm font-medium text-slate-700">
            Rejection Note
          </label>
          <textarea
            id="decision-note"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
            rows={5}
            placeholder="Add clear feedback for the coordinator..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <div className="flex items-center justify-between text-xs">
            <span className={noteLength >= minCharacters ? "text-emerald-700" : "text-amber-700"}>
              Minimum {minCharacters} characters required
            </span>
            <span className="text-slate-500">{noteLength} characters</span>
          </div>

          {errorMessage ? <p className="text-sm text-red-600">{errorMessage}</p> : null}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
