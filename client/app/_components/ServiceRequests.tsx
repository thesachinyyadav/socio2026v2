"use client";

import React, { useState, useEffect } from "react";
import { 
  Wrench, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  RefreshCcw, 
  ChevronDown, 
  Info,
  Monitor,
  Video,
  Utensils,
  ShieldCheck,
  Camera,
  Truck,
  Building2,
  Brush,
  MoreHorizontal
} from "lucide-react";
import { toast } from "sonner";

interface ServiceRequest {
  id: string;
  service_type: string;
  status: string;
  details: any;
  approval_notes?: string;
  resubmission_count: number;
  created_at: string;
}

interface ServiceRequestsProps {
  entityType: "fest" | "event";
  entityId: string;
  isUnlocked: boolean; // Only allowed if fully approved or similar
  authToken?: string | null;
}

const SERVICE_TYPES = [
  { id: "it", label: "IT / Tech Support", icon: <Monitor className="w-4 h-4" /> },
  { id: "av", label: "Audio / Visual", icon: <Video className="w-4 h-4" /> },
  { id: "venue", label: "Venue / Infrastructure", icon: <Building2 className="w-4 h-4" /> },
  { id: "catering", label: "Catering", icon: <Utensils className="w-4 h-4" /> },
  { id: "security", label: "Security", icon: <ShieldCheck className="w-4 h-4" /> },
  { id: "photography", label: "Photography", icon: <Camera className="w-4 h-4" /> },
  { id: "transport", label: "Transport", icon: <Truck className="w-4 h-4" /> },
  { id: "housekeeping", label: "Housekeeping", icon: <Brush className="w-4 h-4" /> },
  { id: "other", label: "Other", icon: <MoreHorizontal className="w-4 h-4" /> },
];

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: "Pending", color: "bg-amber-100 text-amber-700 border-amber-200", icon: Clock },
  approved: { label: "Fulfilled", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: CheckCircle2 },
  rejected: { label: "Revision Required", color: "bg-rose-100 text-rose-800 border-rose-200", icon: RefreshCcw },
  final_rejected: { label: "Rejected", color: "bg-slate-100 text-slate-700 border-slate-200", icon: XCircle },
};

export default function ServiceRequests({ entityType, entityId, isUnlocked, authToken }: ServiceRequestsProps) {
  const [requests, setRequests] = useState<ServiceRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [selectedService, setSelectedService] = useState(SERVICE_TYPES[0].id);
  const [details, setDetails] = useState<any>({});

  const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");

  const fetchRequests = async () => {
    if (!authToken) return;
    try {
      setIsLoading(true);
      const res = await fetch(`${API_URL}/api/service-requests/by-entity/${entityType}/${entityId}`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setRequests(data);
      }
    } catch (err) {
      console.error("Failed to fetch service requests:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [entityId, authToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isUnlocked) {
      toast.error("Service requests are only available after initial approval.");
      return;
    }
    
    try {
      setIsSubmitting(true);
      const res = await fetch(`${API_URL}/api/service-requests`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          entity_type: entityType,
          entity_id: entityId,
          service_type: selectedService,
          details
        })
      });

      if (res.ok) {
        toast.success("Service request submitted successfully.");
        setShowForm(false);
        setDetails({});
        fetchRequests();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to submit request.");
      }
    } catch (err) {
      toast.error("An error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-600" />
            Service Orchestration
          </h2>
          <p className="text-xs text-slate-500 mt-1">Request logistical support for your {entityType}.</p>
        </div>
        {!showForm && isUnlocked && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all shadow-md active:scale-95"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {!isUnlocked && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            <strong>Requests Locked:</strong> You can only request services once your {entityType} has passed the initial approval stage.
          </p>
        </div>
      )}

      {showForm && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">New Service Request</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
              <XCircle className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Service Type</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {SERVICE_TYPES.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(type.id);
                      setDetails({});
                    }}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all ${
                      selectedService === type.id 
                        ? "bg-blue-50 border-blue-500 text-blue-700 font-semibold" 
                        : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    {type.icon}
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Request Details</label>
              
              {selectedService === "venue" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-slate-500">Date of Requirement</span>
                    <input 
                      type="date"
                      required
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      onChange={(e) => setDetails({ ...details, date: e.target.value })}
                    />
                  </div>
                  <div>
                    <span className="text-xs text-slate-500">Headcount</span>
                    <input 
                      type="number"
                      required
                      placeholder="Estimated students"
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      onChange={(e) => setDetails({ ...details, headcount: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <span className="text-xs text-slate-500">Setup Notes (Seats, Stage, etc.)</span>
                    <textarea 
                      required
                      rows={3}
                      className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
                      onChange={(e) => setDetails({ ...details, setup_notes: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {selectedService === "it" && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" onChange={(e) => setDetails({ ...details, projectors: e.target.checked })} /> Projectors
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" onChange={(e) => setDetails({ ...details, pa_systems: e.target.checked })} /> PA Systems
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" onChange={(e) => setDetails({ ...details, high_bandwidth: e.target.checked })} /> High Bandwidth
                    </label>
                  </div>
                  <textarea 
                    rows={3}
                    placeholder="Specific IT requirements..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                    onChange={(e) => setDetails({ ...details, notes: e.target.value })}
                  />
                </div>
              )}

              {(selectedService !== "venue" && selectedService !== "it") && (
                <textarea 
                  required
                  rows={4}
                  placeholder={`Describe your ${selectedService} requirements in detail...`}
                  className="w-full px-3 py-2 border rounded-lg text-sm"
                  onChange={(e) => setDetails({ ...details, description: e.target.value })}
                />
              )}
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 shadow-md shadow-blue-500/20"
              >
                {isSubmitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {isLoading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-32 bg-slate-100 rounded-xl animate-pulse" />
          ))
        ) : requests.length === 0 ? (
          <div className="md:col-span-2 py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
            <Wrench className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No service requests yet.</p>
            {isUnlocked && <button onClick={() => setShowForm(true)} className="text-blue-600 text-sm font-bold mt-2 hover:underline">Create your first request</button>}
          </div>
        ) : (
          requests.map((req) => {
            const config = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
            const StatusIcon = config.icon;
            const typeInfo = SERVICE_TYPES.find(t => t.id === req.service_type);
            
            return (
              <div key={req.id} className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      {typeInfo?.icon || <Wrench className="w-5 h-5" />}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-800 text-sm">{typeInfo?.label || req.service_type}</h4>
                      <p className="text-[10px] text-slate-400 font-mono">#{req.id.slice(0, 8).toUpperCase()}</p>
                    </div>
                  </div>
                  <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border flex items-center gap-1.5 ${config.color}`}>
                    <StatusIcon className="w-3 h-3" />
                    {config.label.toUpperCase()}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {Object.entries(req.details || {}).map(([k, v]) => (
                    v ? (
                      <div key={k} className="flex justify-between text-xs">
                        <span className="text-slate-400 capitalize">{k.replace('_', ' ')}</span>
                        <span className="text-slate-700 font-medium">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</span>
                      </div>
                    ) : null
                  ))}
                </div>

                {req.approval_notes && (
                  <div className="p-3 bg-rose-50 border-l-4 border-rose-400 rounded-r-lg text-[11px] text-rose-800 mb-4">
                    <p className="font-bold mb-0.5">Note from Incharge:</p>
                    <p>{req.approval_notes}</p>
                  </div>
                )}

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-3 border-t border-slate-50">
                  <span>Created {new Date(req.created_at).toLocaleDateString()}</span>
                  {req.resubmission_count > 0 && <span>{req.resubmission_count} Resubmissions</span>}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
