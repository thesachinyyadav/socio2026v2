"use client";

interface AccountsApproveAndRouteButtonProps {
  onClick: () => void;
  disabled?: boolean;
}

export default function AccountsApproveAndRouteButton({
  onClick,
  disabled = false,
}: AccountsApproveAndRouteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
    >
      Approve and Route to Logistics
    </button>
  );
}
