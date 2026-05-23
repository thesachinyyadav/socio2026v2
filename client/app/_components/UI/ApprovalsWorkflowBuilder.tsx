"use client";
import React from "react";
import { ShieldCheck, Zap } from "lucide-react";

export interface WorkflowStage {
  role: string;
  label: string;
  desc: string;
  blocking: boolean;
  required?: boolean;
  enabled?: boolean;
}

export interface BudgetItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export function getApprovalStageSubtitle(
  role: string,
  organizingSchool?: string,
  organizingDept?: string
): string {
  const school = String(organizingSchool ?? "").trim();
  const dept = String(organizingDept ?? "").trim();

  switch (role) {
    case 'hod':
      return dept ? `Head of Department of ${dept}` : 'Head of Department';
    case 'dean':
      return school ? `Dean of ${school}` : 'Dean of the School';
    case 'cfo':
      return 'Chief Financial Officer';
    case 'accounts':
      return 'Finance Officer';
    default:
      return '';
  }
}

export function normalizeApprovalStageSubtitles(
  stages: WorkflowStage[],
  organizingSchool?: string,
  organizingDept?: string
): WorkflowStage[] {
  return stages.map((stage) => ({
    ...stage,
    desc: getApprovalStageSubtitle(stage.role, organizingSchool, organizingDept),
  }));
}

export const DEFAULT_WORKFLOW_STAGES: WorkflowStage[] = [
  { role: 'hod',      label: 'HOD',             desc: 'Head of Department',     blocking: true, required: true,  enabled: true },
  { role: 'dean',     label: 'Dean',             desc: 'Dean of the School',      blocking: true, required: true,  enabled: true },
  { role: 'cfo',      label: 'CFO / Campus Dir', desc: 'Chief Financial Officer', blocking: true, required: false, enabled: false },
  { role: 'accounts', label: 'Finance Officer',  desc: 'Finance Officer',         blocking: true, required: false, enabled: false },
];

export interface ApprovalsWorkflowBuilderProps {
  organizingSchool?: string;
  organizingDept?: string;
  /** 'fest' (default) renders fest-specific action buttons; 'event' omits them and calls onChange on every state change. */
  context?: 'fest' | 'event';
  /** Fired on every stages/budget change when context === 'event'. */
  onChange?: (stages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  // Fest-specific props (only used when context === 'fest')
  festId?: string | null;
  approvalExists?: boolean | null;
  isSubmitting?: boolean;
  isUpdatingFest?: boolean;
  initialStages?: WorkflowStage[];
  initialBudgetItems?: BudgetItem[];
  onSubmitForApproval?: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onUpdateWorkflow?: (customStages: WorkflowStage[], budgetItems: BudgetItem[]) => void;
  onUpdateFest?: () => void;
  onBackToDetails?: () => void;
}

export function ApprovalsWorkflowBuilder({
  organizingSchool,
  organizingDept,
  context = 'fest',
  onChange,
  festId,
  approvalExists,
  isSubmitting = false,
  isUpdatingFest = false,
  initialStages,
  initialBudgetItems,
  onSubmitForApproval,
  onUpdateWorkflow,
  onUpdateFest,
  onBackToDetails,
}: ApprovalsWorkflowBuilderProps) {
  const [stages, setStages] = React.useState<WorkflowStage[]>(
    normalizeApprovalStageSubtitles(
      initialStages && initialStages.length > 0 ? initialStages : DEFAULT_WORKFLOW_STAGES,
      organizingSchool,
      organizingDept
    )
  );
  const [draggedRole, setDraggedRole] = React.useState<string | null>(null);
  const [dropTarget, setDropTarget] = React.useState<{
    role: string | null;
    position: 'before' | 'after';
    section: 'pre' | 'post';
  } | null>(null);
  const [budgetItems, setBudgetItems] = React.useState<BudgetItem[]>(initialBudgetItems ?? []);

  React.useEffect(() => {
    if (initialStages && initialStages.length > 0) {
      setStages(normalizeApprovalStageSubtitles(initialStages, organizingSchool, organizingDept));
    }
  }, [initialStages, organizingSchool, organizingDept]);

  React.useEffect(() => {
    setStages((prev) =>
      prev.map((stage) => ({
        ...stage,
        desc: getApprovalStageSubtitle(stage.role, organizingSchool, organizingDept),
      }))
    );
  }, [organizingSchool, organizingDept]);

  React.useEffect(() => {
    if (initialBudgetItems && initialBudgetItems.length > 0) {
      setBudgetItems(initialBudgetItems.map(b => ({ ...b, id: b.id || crypto.randomUUID() })));
    }
  }, [initialBudgetItems]);

  // Notify parent on every change when used in event context
  React.useEffect(() => {
    if (context === 'event') {
      onChange?.(stages.filter(s => s.required || s.enabled !== false), budgetItems);
    }
  }, [stages, budgetItems]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfoEnabled  = stages.find(s => s.role === 'cfo')?.enabled !== false;
  const needsBudget = stages.some(s => (s.role === 'cfo' || s.role === 'accounts') && s.enabled !== false);

  function toggleStage(role: string, enabled: boolean) {
    setStages(prev => {
      let updated = prev.map(s => s.role === role ? { ...s, enabled } : s);
      if (role === 'cfo' && enabled) {
        updated = updated.map(s => s.role === 'accounts' ? { ...s, enabled: true } : s);
      }
      return updated;
    });
  }

  function addBudgetRow() {
    setBudgetItems(prev => [...prev, { id: crypto.randomUUID(), name: '', quantity: 1, unitPrice: 0 }]);
  }

  function removeBudgetRow(id: string) {
    setBudgetItems(prev => prev.filter(b => b.id !== id));
  }

  function updateBudgetRow(id: string, field: keyof Omit<BudgetItem, 'id'>, value: string) {
    setBudgetItems(prev => prev.map(b => {
      if (b.id !== id) return b;
      if (field === 'name') return { ...b, name: value };
      const num = parseFloat(value) || 0;
      return { ...b, [field]: num };
    }));
  }

  const budgetTotal = budgetItems.reduce((sum, b) => sum + b.quantity * b.unitPrice, 0);

  const preLiveStages  = stages.filter(s => s.blocking);
  const postLiveStages = stages.filter(s => !s.blocking);

  const isPreLiveOnly = (role: string) => role === 'hod' || role === 'dean';

  function handleDragStart(e: React.DragEvent, role: string) {
    setDraggedRole(role);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', role);
  }

  function handleDragOverItem(e: React.DragEvent, role: string, section: 'pre' | 'post') {
    e.stopPropagation();
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const position: 'before' | 'after' = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropTarget({ role, position, section });
  }

  function handleDropOnItem(e: React.DragEvent, targetRole: string, targetSection: 'pre' | 'post') {
    e.preventDefault();
    e.stopPropagation();
    if (!draggedRole || !dropTarget) return;
    if (isPreLiveOnly(draggedRole) && targetSection === 'post') { setDraggedRole(null); setDropTarget(null); return; }
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage || draggedRole === targetRole) { setDraggedRole(null); setDropTarget(null); return; }
    const targetBlocking = targetSection === 'pre';
    const withoutDragged = stages.filter(s => s.role !== draggedRole);
    const targetIdx = withoutDragged.findIndex(s => s.role === targetRole);
    if (targetIdx === -1) { setDraggedRole(null); setDropTarget(null); return; }
    const insertAt = dropTarget.position === 'after' ? targetIdx + 1 : targetIdx;
    const spliced = [
      ...withoutDragged.slice(0, insertAt),
      { ...sourceStage, blocking: targetBlocking },
      ...withoutDragged.slice(insertAt),
    ];
    setStages([...spliced.filter(s => s.blocking), ...spliced.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragOverEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    if (draggedRole && isPreLiveOnly(draggedRole) && section === 'post') return;
    e.preventDefault();
    setDropTarget({ role: null, position: 'after', section });
  }

  function handleDropOnEmpty(e: React.DragEvent, section: 'pre' | 'post') {
    e.preventDefault();
    if (!draggedRole) return;
    if (isPreLiveOnly(draggedRole) && section === 'post') return;
    const sourceStage = stages.find(s => s.role === draggedRole);
    if (!sourceStage) return;
    const targetBlocking = section === 'pre';
    const updated = stages.map(s => s.role === draggedRole ? { ...s, blocking: targetBlocking } : s);
    setStages([...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)]);
    setDraggedRole(null);
    setDropTarget(null);
  }

  function handleDragEnd() {
    setDraggedRole(null);
    setDropTarget(null);
  }

  function moveToPostLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: false } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function moveToPreLive(role: string) {
    setStages(prev => {
      const updated = prev.map(s => s.role === role ? { ...s, blocking: true } : s);
      return [...updated.filter(s => s.blocking), ...updated.filter(s => !s.blocking)];
    });
  }

  function renderSectionList(sectionStages: WorkflowStage[], section: 'pre' | 'post', emptyText: string) {
    const accentColor = section === 'pre' ? '#3b82f6' : '#a855f7';
    const isEmpty = sectionStages.length === 0;
    const isEmptyDropTarget = dropTarget?.section === section && dropTarget?.role === null;
    return (
      <div
        className={`min-h-[60px] space-y-2.5 rounded-lg transition-colors duration-200 ${isEmptyDropTarget ? 'bg-blue-50/50' : ''}`}
        onDragOver={(e) => isEmpty && handleDragOverEmpty(e, section)}
        onDrop={(e) => isEmpty && handleDropOnEmpty(e, section)}
        onDragLeave={(e) => {
          if (isEmpty && !(e.currentTarget as HTMLElement).contains(e.relatedTarget as Node)) {
            setDropTarget(null);
          }
        }}
      >
        {isEmpty ? (
          <div className={`border-2 border-dashed rounded-xl p-5 text-center text-sm transition-all duration-200 ${
            isEmptyDropTarget ? 'border-blue-400 text-blue-500 bg-blue-50 scale-[1.01]' : 'border-gray-200 text-gray-400'
          }`}>
            {emptyText}
          </div>
        ) : (
          sectionStages.map((s, i) => {
            const isDragging = draggedRole === s.role;
            const isDropBefore = dropTarget?.role === s.role && dropTarget.position === 'before';
            const isDropAfter  = dropTarget?.role === s.role && dropTarget.position === 'after';
            const isLocked = s.role === 'accounts' && cfoEnabled;
            const stepNumber = String(i + 1).padStart(2, '0');
            return (
              <div key={s.role}>
                <div className={`h-0.5 rounded-full mx-1 transition-all duration-200 ${isDropBefore ? 'mb-1' : 'mb-0 bg-transparent'}`}
                  style={isDropBefore ? { backgroundColor: accentColor } : {}} />

                <div
                  draggable
                  onDragStart={(e) => handleDragStart(e, s.role)}
                  onDragOver={(e) => handleDragOverItem(e, s.role, section)}
                  onDrop={(e) => handleDropOnItem(e, s.role, section)}
                  onDragEnd={handleDragEnd}
                  className={`group flex items-center gap-3.5 rounded-xl border px-4 py-3.5 bg-white cursor-grab active:cursor-grabbing select-none transition-all duration-200 ease-out ${
                    isDragging ? 'opacity-30 scale-[0.97] shadow-lg rotate-[0.5deg]' : 'opacity-100 scale-100'
                  } border-gray-200 hover:border-gray-300 hover:shadow-md hover:-translate-y-[1px]`}
                >
                  <svg className="w-4 h-4 text-gray-300 group-hover:text-gray-400 shrink-0 transition-colors duration-200" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M7 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001-4.001A2 2 0 0 0 13 6zm0 2a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 8zm0 6a2 2 0 1 0 .001 4.001A2 2 0 0 0 13 14z" />
                  </svg>

                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 tabular-nums transition-colors duration-200 ${
                    section === 'pre' ? 'bg-blue-50 text-[#154CB3] border border-blue-200' : 'bg-purple-50 text-purple-700 border border-purple-200'
                  }`}>
                    {stepNumber}
                  </span>

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-800 leading-snug">{s.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{s.desc}</p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {s.required ? (
                      <span className="text-[10px] bg-red-50 text-red-600 border border-red-200 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider select-none">
                        Required
                      </span>
                    ) : (
                      <label
                        className={`relative inline-flex items-center ${isLocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                        title={isLocked ? 'Finance Officer is locked ON while CFO is enabled' : 'Toggle this approval on/off'}
                      >
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={s.enabled !== false}
                          disabled={isLocked}
                          onChange={() => !isLocked && toggleStage(s.role, s.enabled === false)}
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#154CB3]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:shadow-sm after:transition-all after:duration-200 peer-checked:bg-[#154CB3] transition-colors duration-200" />
                      </label>
                    )}
                    {!s.required && (
                      <button
                        type="button"
                        title={section === 'pre' ? 'Move to Post-Live' : 'Move to Pre-Live'}
                        onClick={() => section === 'pre' ? moveToPostLive(s.role) : moveToPreLive(s.role)}
                        className="text-xs text-gray-400 hover:text-gray-600 shrink-0 px-1.5 py-1 rounded-md hover:bg-gray-100 transition-all duration-200"
                      >
                        {section === 'pre' ? '↓' : '↑'}
                      </button>
                    )}
                  </div>
                </div>

                <div className={`h-0.5 rounded-full mx-1 transition-all duration-200 ${isDropAfter ? 'mt-1' : 'mt-0 bg-transparent'}`}
                  style={isDropAfter ? { backgroundColor: accentColor } : {}} />
              </div>
            );
          })
        )}
      </div>
    );
  }

  const itemLabel = context === 'event' ? 'event' : 'fest';

  return (
    <div className="p-6 sm:p-8 md:p-10">
      <h2 className="text-xl sm:text-2xl font-bold text-[#063168] mb-1">Approvals</h2>
      <p className="text-sm text-gray-500 mb-6">
        Drag to reorder stages. HOD and Dean are mandatory. CFO and Finance Officer can be toggled off if not required.
      </p>

      {organizingSchool && (
        <div className="mb-6 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center gap-2">
          <span className="text-sm text-blue-800">
            <span className="font-semibold">School:</span> {organizingSchool}
            {organizingDept && <span className="text-blue-600"> · {organizingDept}</span>}
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-6">
        {/* Pre-Live Section */}
        <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
          <div className="flex items-start gap-3 mb-1">
            <span className="w-10 h-10 rounded-full bg-[#154CB3] flex items-center justify-center shrink-0 shadow-sm">
              <ShieldCheck className="w-5 h-5 text-white" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">Stage 1: Pre-Live Gates</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-[#154CB3] border border-blue-200 px-2 py-0.5 rounded-md select-none">Mandatory</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Must be completed before {itemLabel} publication.
              </p>
            </div>
          </div>
          <div className="mt-4">
            {renderSectionList(preLiveStages, 'pre', 'Drag here to add Pre-Live stage')}
          </div>
        </div>

        {/* Post-Live Section */}
        <div className="rounded-2xl border border-purple-100 bg-purple-50/40 p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
          <div className="flex items-start gap-3 mb-1">
            <span className="w-10 h-10 rounded-full bg-purple-600 flex items-center justify-center shrink-0 shadow-sm">
              <Zap className="w-5 h-5 text-white" strokeWidth={2} />
            </span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-base font-bold text-gray-900">Stage 2: Post-Live Operations</h3>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-md select-none">Parallel</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Concurrent tasks triggered after {itemLabel} launch.
              </p>
            </div>
          </div>
          <div className="mt-4">
            {renderSectionList(postLiveStages, 'post', 'Drag here to add Post-Live stage')}
          </div>
        </div>
      </div>

      {needsBudget && (
        <div className="mb-6 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-sm font-semibold text-gray-800">Budget Estimate</h3>
            <span className="text-xs text-gray-500">Required for CFO / Finance review</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">
            List your expected expenses. This is submitted with the approval request.
          </p>

          <div className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 mb-1 px-1">
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">Item</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-center">Qty</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Unit (₹)</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wide text-right">Total (₹)</span>
            <span />
          </div>

          <div className="space-y-2">
            {budgetItems.map(b => (
              <div key={b.id} className="grid grid-cols-[1fr_72px_96px_88px_32px] gap-2 items-center">
                <input
                  type="text"
                  placeholder="e.g. Sound system rental"
                  value={b.name}
                  onChange={e => updateBudgetRow(b.id, 'name', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="1"
                  value={b.quantity}
                  onChange={e => updateBudgetRow(b.id, 'quantity', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={b.unitPrice}
                  onChange={e => updateBudgetRow(b.id, 'unitPrice', e.target.value)}
                  className="w-full rounded border border-gray-300 bg-white px-2 py-1.5 text-sm text-right focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
                />
                <span className="text-sm text-gray-700 text-right tabular-nums">
                  {(b.quantity * b.unitPrice).toLocaleString('en-IN')}
                </span>
                <button
                  type="button"
                  onClick={() => removeBudgetRow(b.id)}
                  className="flex items-center justify-center w-7 h-7 rounded text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors text-base leading-none"
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}

            {budgetItems.length === 0 && (
              <div className="text-center py-5 text-sm text-gray-400 border border-dashed border-gray-200 rounded">
                No items added yet.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={addBudgetRow}
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
            >
              + Add item
            </button>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Total estimate</p>
              <p className="text-lg font-semibold text-gray-900 tabular-nums">₹{budgetTotal.toLocaleString('en-IN')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Footer action buttons — fest context only */}
      {context !== 'event' && (
        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onBackToDetails}
            className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors"
          >
            ← Back to Fest Details
          </button>

          {onUpdateFest && (
            <button
              type="button"
              onClick={onUpdateFest}
              disabled={isUpdatingFest || isSubmitting}
              className="w-full sm:w-auto px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isUpdatingFest && (
                <svg className="animate-spin h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isUpdatingFest ? 'Saving...' : 'Update Fest'}
            </button>
          )}

          {approvalExists ? (
            <div className="flex flex-col sm:flex-row gap-2 flex-1">
              <button
                type="button"
                onClick={() => onUpdateWorkflow?.(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
                disabled={isSubmitting || !festId}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isSubmitting && (
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                )}
                {isSubmitting ? 'Saving...' : 'Update Workflow'}
              </button>
              <a
                href={`/approvals/${festId}?type=fest`}
                className="w-full sm:w-auto px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-50 transition-colors text-center"
              >
                View Approval Status
              </a>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onSubmitForApproval?.(stages.filter(s => s.required || s.enabled !== false), budgetItems)}
              disabled={isSubmitting}
              className="w-full sm:w-auto px-6 py-2.5 bg-[#154CB3] text-white text-sm font-semibold rounded-md hover:bg-[#0f3a7a] focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-2 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {isSubmitting ? 'Submitting...' : 'Submit for Approval'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default ApprovalsWorkflowBuilder;
