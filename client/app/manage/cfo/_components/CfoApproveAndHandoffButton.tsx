"use client";

interface CfoApproveAndHandoffButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function CfoApproveAndHandoffButton({
  onClick,
  disabled = false,
}: CfoApproveAndHandoffButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      Approve and Send to Accounts
    </button>
  );
}
