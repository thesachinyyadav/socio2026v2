"use client";

import { useState, useTransition, useCallback, useId } from "react";
import { Plus, Trash2, Info, CheckCircle2, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  saveBudgetEstimate,
  submitBudgetForApproval,
  type ExpenseItem,
} from "@/app/actions/budget";

// ─── Threshold constants ───────────────────────────────────────────────────
const THRESHOLD_25K = 25_000;
const THRESHOLD_1L = 100_000;

// ─── Pure helpers ──────────────────────────────────────────────────────────

function getApprovalTier(total: number): string[] {
  if (total <= 0) return [];
  if (total <= THRESHOLD_25K) return ["HOD"];
  if (total <= THRESHOLD_1L) return ["HOD", "Dean"];
  return ["HOD", "Dean", "CFO"];
}

function getAllBadges(total: number): string[] {
  const tier = getApprovalTier(total);
  return tier.length > 0 ? ["Accounts", ...tier] : [];
}

function joinList(items: string[]): string {
  if (items.length === 0) return "no";
  if (items.length === 1) return items[0];
  return items.slice(0, -1).join(", ") + " and " + items[items.length - 1];
}

function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatLineTotal(qty: number, price: number): string {
  if (qty <= 0 || price <= 0) return "";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(qty * price);
}

let _counter = 0;
function makeItem(): ExpenseItem {
  return { id: `item-${++_counter}`, itemName: "", quantity: 1, unitPrice: 0 };
}

// ─── Component props ───────────────────────────────────────────────────────

interface SmartBudgetEstimatorProps {
  entityId: string;
  entityType: "event" | "fest";
  entityLabel?: string;
}

// ─── Component ────────────────────────────────────────────────────────────

export default function SmartBudgetEstimator({
  entityId,
  entityType,
  entityLabel,
}: SmartBudgetEstimatorProps) {
  const baseId = useId();
  const [items, setItems] = useState<ExpenseItem[]>([makeItem()]);
  const [isSavePending, startSave] = useTransition();
  const [isSubmitPending, startSubmit] = useTransition();

  // ── Derived state ────────────────────────────────────────────────────────
  const estimatedTotal = items.reduce(
    (acc, item) => acc + item.quantity * item.unitPrice,
    0
  );
  const approvalTier = getApprovalTier(estimatedTotal);
  const allBadges = getAllBadges(estimatedTotal);
  const label = entityLabel ?? entityType;

  // ── Item mutations ───────────────────────────────────────────────────────
  const updateItem = useCallback(
    (id: string, field: keyof ExpenseItem, raw: string) => {
      setItems((prev) =>
        prev.map((item) => {
          if (item.id !== id) return item;
          if (field === "quantity" || field === "unitPrice") {
            const parsed = parseFloat(raw);
            return { ...item, [field]: isNaN(parsed) || parsed < 0 ? 0 : parsed };
          }
          return { ...item, [field]: raw };
        })
      );
    },
    []
  );

  const addItem = () => setItems((prev) => [...prev, makeItem()]);

  const removeItem = (id: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));

  // ── Actions ──────────────────────────────────────────────────────────────
  const handleSave = () => {
    startSave(async () => {
      const result = await saveBudgetEstimate(entityId, entityType, items, estimatedTotal);
      if (result.ok) {
        toast.success("Budget estimate saved.");
      } else {
        toast.error(result.message);
      }
    });
  };

  const handleSubmit = () => {
    startSubmit(async () => {
      const result = await submitBudgetForApproval(entityId, entityType, estimatedTotal);
      if (result.ok) {
        toast.success("Submitted for approval successfully!");
      } else {
        toast.error(result.message);
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col lg:flex-row gap-6 w-full">
      {/* ── Left pane: expense table ── */}
      <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h2 className="text-xl font-bold text-slate-900">Smart Budget Estimator</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Add and review expense items for this {label}.
          </p>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[44%]">
                  Item Name
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[18%]">
                  Quantity
                </th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[22%]">
                  Unit Price
                </th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-[14%]">
                  Total
                </th>
                <th className="w-10" aria-hidden="true" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const qtyId = `${baseId}-qty-${item.id}`;
                const priceId = `${baseId}-price-${item.id}`;
                const nameId = `${baseId}-name-${item.id}`;
                const lineTotal = formatLineTotal(item.quantity, item.unitPrice);

                return (
                  <tr key={item.id} className="group hover:bg-slate-50/60 transition-colors">
                    {/* Item name */}
                    <td className="px-6 py-3">
                      <label htmlFor={nameId} className="sr-only">
                        Item name {idx + 1}
                      </label>
                      <input
                        id={nameId}
                        type="text"
                        value={item.itemName}
                        placeholder="Item description..."
                        onChange={(e) => updateItem(item.id, "itemName", e.target.value)}
                        className="w-full bg-transparent text-slate-900 placeholder-slate-300 focus:outline-none focus:ring-0"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3">
                      <label htmlFor={qtyId} className="sr-only">
                        Quantity {idx + 1}
                      </label>
                      <input
                        id={qtyId}
                        type="number"
                        min={0}
                        step={1}
                        value={item.quantity === 0 ? "" : item.quantity}
                        placeholder="Qty"
                        onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                        className="w-full bg-transparent text-slate-700 focus:outline-none focus:ring-0"
                      />
                    </td>

                    {/* Unit price */}
                    <td className="px-4 py-3">
                      <label htmlFor={priceId} className="sr-only">
                        Unit price {idx + 1}
                      </label>
                      <div className="flex items-center gap-1">
                        <span className="text-slate-400 text-xs select-none">₹</span>
                        <input
                          id={priceId}
                          type="number"
                          min={0}
                          step={0.01}
                          value={item.unitPrice === 0 ? "" : item.unitPrice}
                          placeholder="0.00"
                          onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                          className="w-full bg-transparent text-slate-700 focus:outline-none focus:ring-0"
                        />
                      </div>
                    </td>

                    {/* Row total */}
                    <td className="px-6 py-3 text-right font-medium tabular-nums">
                      {lineTotal ? (
                        <span className="text-slate-900">{lineTotal}</span>
                      ) : (
                        <span className="text-slate-300">₹0.00</span>
                      )}
                    </td>

                    {/* Delete */}
                    <td className="pr-4 py-3">
                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        aria-label={`Remove item ${idx + 1}`}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-slate-400 hover:text-red-500 p-1 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}

              {/* Ghost row hint */}
              <tr className="text-slate-300">
                <td className="px-6 py-3 text-sm italic">Add new expense...</td>
                <td className="px-4 py-3 text-sm">Qty</td>
                <td className="px-4 py-3 text-sm">
                  <span className="text-slate-300 text-xs">₹</span> 0.00
                </td>
                <td className="px-6 py-3 text-right text-sm">₹0.00</td>
                <td />
              </tr>
            </tbody>
          </table>
        </div>

        {/* Add item */}
        <div className="px-6 pt-3 pb-4 border-t border-slate-100">
          <button
            type="button"
            onClick={addItem}
            className="flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
          >
            <Plus size={16} />
            Add Expense Item
          </button>
        </div>

        {/* Save draft */}
        <div className="px-6 pb-5 flex items-center justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSavePending}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            {isSavePending && <Loader2 size={14} className="animate-spin" />}
            Save Draft
          </button>
        </div>
      </div>

      {/* ── Right pane: pre-flight card ── */}
      <div className="w-full lg:w-[300px] shrink-0">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 lg:sticky lg:top-6 flex flex-col gap-5">
          {/* Title */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Budget Estimate Pre-Flight
            </p>
          </div>

          {/* Total */}
          <div>
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider mb-1">
              Estimated Total
            </p>
            <p className="text-3xl font-bold text-slate-900 tabular-nums leading-tight">
              {formatINR(estimatedTotal)}
            </p>
          </div>

          {/* Alert box */}
          {estimatedTotal > 0 ? (
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2.5">
              <Info size={15} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-700 leading-relaxed">
                At{" "}
                <span className="font-semibold text-blue-700">{formatINR(estimatedTotal)}</span>
                , this event will require{" "}
                <span className="font-semibold">{joinList(approvalTier)}</span> approvals
                before publishing.
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-100 rounded-lg p-3 flex gap-2.5">
              <Info size={15} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="text-xs text-slate-500 leading-relaxed">
                Add expense items to see the required approval pipeline.
              </p>
            </div>
          )}

          {/* Approval badges */}
          {allBadges.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Required Approvals Pipeline
              </p>
              <div className="flex flex-wrap gap-2">
                {allBadges.map((badge) => (
                  <span
                    key={badge}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-600 text-white"
                  >
                    <CheckCircle2 size={12} />
                    {badge}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Submit button */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitPending || estimatedTotal <= 0}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 text-sm"
          >
            {isSubmitPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                Submitting...
              </>
            ) : (
              "Submit for Approval"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
