"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Box,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  FileUp,
  Radio,
  ShieldAlert,
  Timer,
  Wrench,
} from "lucide-react";

import { supabase } from "@/lib/supabaseClient";
import {
  EventResourceItem,
  IncidentLogItem,
  RunsheetTaskItem,
  TaskStatus,
  VolunteerExecutionDashboardData,
  VolunteerEventItem,
} from "../types";

type TabKey = "tasks" | "runsheet" | "resources" | "incidents";

type GenericRow = Record<string, unknown>;

const TAB_LABELS: Record<TabKey, string> = {
  tasks: "My Tasks",
  runsheet: "Live Runsheet",
  resources: "Resource Tracker",
  incidents: "Incident Log",
};

const RUNSHEET_ID_FIELDS = ["id", "runsheet_item_id", "item_id", "task_id"] as const;
const RUNSHEET_STATUS_FIELDS = ["status", "task_status", "execution_status", "state"] as const;
const RUNSHEET_RESPONSIBLE_FIELDS = [
  "responsible_person",
  "responsible_person_email",
  "responsible_email",
  "assigned_to",
  "owner_email",
] as const;

const RESOURCE_ID_FIELDS = ["id", "resource_id", "item_id"] as const;
const RESOURCE_STATUS_FIELDS = ["status", "resource_status", "state", "lifecycle_status"] as const;

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeLower(value: unknown): string {
  return normalizeText(value).toLowerCase();
}

function firstExistingField(row: GenericRow, candidates: readonly string[]): string | null {
  for (const fieldName of candidates) {
    if (row[fieldName] !== undefined && row[fieldName] !== null && normalizeText(row[fieldName]).length > 0) {
      return fieldName;
    }
  }

  return null;
}

function toTaskStatus(value: unknown): TaskStatus {
  const normalized = normalizeLower(value).replace(/[\s-]+/g, "_");

  if (normalized === "in_progress" || normalized === "inprogress" || normalized === "ongoing") {
    return "in_progress";
  }

  if (normalized === "done" || normalized === "complete" || normalized === "completed") {
    return "done";
  }

  return "pending";
}

function taskStatusLabel(status: TaskStatus): string {
  if (status === "in_progress") {
    return "In-Progress";
  }

  if (status === "done") {
    return "Done";
  }

  return "Pending";
}

function nextTaskStatus(status: TaskStatus): TaskStatus {
  if (status === "pending") {
    return "in_progress";
  }

  if (status === "in_progress") {
    return "done";
  }

  return "pending";
}

function dbStatusCandidates(nextStatus: TaskStatus): string[] {
  if (nextStatus === "in_progress") {
    return ["In-Progress", "in_progress", "in-progress", "ongoing"];
  }

  if (nextStatus === "done") {
    return ["Done", "done", "completed", "complete"];
  }

  return ["Pending", "pending"];
}

function toResourceStatus(value: unknown): "allocated" | "in_use" | "returned" {
  const normalized = normalizeLower(value).replace(/[\s-]+/g, "_");

  if (normalized === "in_use" || normalized === "inuse") {
    return "in_use";
  }

  if (normalized === "returned") {
    return "returned";
  }

  return "allocated";
}

function resourceStatusLabel(status: "allocated" | "in_use" | "returned"): string {
  if (status === "in_use") {
    return "In-Use";
  }

  if (status === "returned") {
    return "Returned";
  }

  return "Allocated";
}

function nextResourceStatus(status: "allocated" | "in_use" | "returned"): "allocated" | "in_use" | "returned" {
  if (status === "allocated") {
    return "in_use";
  }

  if (status === "in_use") {
    return "returned";
  }

  return "allocated";
}

function resourceDbStatusCandidates(nextStatus: "allocated" | "in_use" | "returned"): string[] {
  if (nextStatus === "in_use") {
    return ["In-Use", "in_use", "in-use", "in use"];
  }

  if (nextStatus === "returned") {
    return ["Returned", "returned"];
  }

  return ["Allocated", "allocated"];
}

function mapRunsheetItem(row: GenericRow, fallbackIndex: number): RunsheetTaskItem | null {
  const idField = firstExistingField(row, RUNSHEET_ID_FIELDS) || "id";
  const idValue = normalizeText(row[idField]);
  const eventId = normalizeText(row.event_id);

  if (!eventId) {
    return null;
  }

  const title =
    normalizeText(row.title) ||
    normalizeText(row.task) ||
    normalizeText(row.task_name) ||
    normalizeText(row.activity) ||
    normalizeText(row.name);

  if (!title) {
    return null;
  }

  const statusField = firstExistingField(row, RUNSHEET_STATUS_FIELDS) || "status";
  const responsibleField = firstExistingField(row, RUNSHEET_RESPONSIBLE_FIELDS);
  const responsibleEmail = responsibleField ? normalizeLower(row[responsibleField]) : null;

  const status = toTaskStatus(row[statusField]);

  return {
    id: idValue || `${eventId}-task-${fallbackIndex + 1}`,
    eventId,
    title,
    description: normalizeText(row.description || row.details || row.notes) || null,
    scheduledTime:
      normalizeText(row.scheduled_time || row.time_slot || row.time || row.start_time) || null,
    status,
    statusLabel: taskStatusLabel(status),
    responsiblePersonEmail: responsibleEmail || null,
    responsiblePersonLabel:
      normalizeText(row.responsible_person_name || row.responsible_person || row.assigned_to) ||
      (responsibleEmail || null),
    idField,
    statusField,
    canMutate: idValue.length > 0,
  };
}

function mapResourceItem(row: GenericRow, fallbackIndex: number): EventResourceItem | null {
  const idField = firstExistingField(row, RESOURCE_ID_FIELDS) || "id";
  const idValue = normalizeText(row[idField]);
  const eventId = normalizeText(row.event_id);

  if (!eventId) {
    return null;
  }

  const name =
    normalizeText(row.resource_name) ||
    normalizeText(row.item_name) ||
    normalizeText(row.name) ||
    normalizeText(row.title);

  if (!name) {
    return null;
  }

  const statusField = firstExistingField(row, RESOURCE_STATUS_FIELDS) || "status";
  const status = toResourceStatus(row[statusField]);

  const quantityRaw = normalizeText(row.quantity);
  const quantityUnit = normalizeText(row.unit);

  return {
    id: idValue || `${eventId}-resource-${fallbackIndex + 1}`,
    eventId,
    name,
    category: normalizeText(row.category || row.resource_type || row.type) || null,
    quantityLabel: quantityRaw ? `${quantityRaw}${quantityUnit ? ` ${quantityUnit}` : ""}` : null,
    status,
    statusLabel: resourceStatusLabel(status),
    notes: normalizeText(row.notes || row.description) || null,
    idField,
    statusField,
    canMutate: idValue.length > 0,
  };
}

function toIncidentSeverity(value: unknown): "low" | "medium" | "high" | "critical" {
  const normalized = normalizeLower(value);
  if (normalized === "critical") {
    return "critical";
  }

  if (normalized === "high") {
    return "high";
  }

  if (normalized === "low") {
    return "low";
  }

  return "medium";
}

function safeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

interface VolunteerExecutionDashboardClientProps {
  userEmail: string;
  userName: string | null;
  initialData: VolunteerExecutionDashboardData;
}

export default function VolunteerExecutionDashboardClient({
  userEmail,
  userName,
  initialData,
}: VolunteerExecutionDashboardClientProps) {
  const [events] = useState<VolunteerEventItem[]>(initialData.events);
  const [activeTab, setActiveTab] = useState<TabKey>("tasks");
  const [selectedEventId, setSelectedEventId] = useState<string>(initialData.events[0]?.eventId || "");

  const [runsheetByEventId, setRunsheetByEventId] = useState<Record<string, RunsheetTaskItem[]>>(
    initialData.runsheetByEventId
  );
  const [resourcesByEventId, setResourcesByEventId] = useState<Record<string, EventResourceItem[]>>(
    initialData.resourcesByEventId
  );
  const [incidentsByEventId, setIncidentsByEventId] = useState<Record<string, IncidentLogItem[]>>(
    initialData.incidentsByEventId
  );

  const [realtimeState, setRealtimeState] = useState<"connecting" | "live" | "error">("connecting");
  const [isBusy, setIsBusy] = useState(false);

  const [incidentSeverity, setIncidentSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [incidentCategory, setIncidentCategory] = useState("Operations");
  const [incidentDescription, setIncidentDescription] = useState("");

  const [expenseFile, setExpenseFile] = useState<File | null>(null);
  const [expenseAmount, setExpenseAmount] = useState("");
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [uploadedDocsByEventId, setUploadedDocsByEventId] = useState<Record<string, string[]>>({});
  const [uploadedPhotosByEventId, setUploadedPhotosByEventId] = useState<Record<string, string[]>>({});

  const normalizedUserEmail = normalizeLower(userEmail);

  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) || null,
    [events, selectedEventId]
  );

  const selectedRunsheet = useMemo(
    () => runsheetByEventId[selectedEventId] || [],
    [runsheetByEventId, selectedEventId]
  );

  const selectedResources = useMemo(
    () => resourcesByEventId[selectedEventId] || [],
    [resourcesByEventId, selectedEventId]
  );

  const selectedIncidents = useMemo(
    () => incidentsByEventId[selectedEventId] || [],
    [incidentsByEventId, selectedEventId]
  );

  const myTasks = useMemo(
    () =>
      selectedRunsheet
        .filter((task) => normalizeLower(task.responsiblePersonEmail) === normalizedUserEmail)
        .sort((left, right) => normalizeText(left.scheduledTime).localeCompare(normalizeText(right.scheduledTime))),
    [normalizedUserEmail, selectedRunsheet]
  );

  const uploadedDocLinks = useMemo(
    () => uploadedDocsByEventId[selectedEventId] || [],
    [selectedEventId, uploadedDocsByEventId]
  );

  const uploadedPhotoLinks = useMemo(
    () => uploadedPhotosByEventId[selectedEventId] || [],
    [selectedEventId, uploadedPhotosByEventId]
  );

  useEffect(() => {
    if (!selectedEventId && events[0]?.eventId) {
      setSelectedEventId(events[0].eventId);
    }
  }, [events, selectedEventId]);

  const reloadRunsheetForEvent = async (eventId: string) => {
    if (!eventId) {
      return;
    }

    const { data, error } = await supabase.from("runsheet_items").select("*").eq("event_id", eventId);

    if (error) {
      return;
    }

    const rows = Array.isArray(data) ? (data as GenericRow[]) : [];
    const mappedRows = rows
      .map((row, index) => mapRunsheetItem(row, index))
      .filter((row): row is RunsheetTaskItem => Boolean(row))
      .sort((left, right) => normalizeText(left.scheduledTime).localeCompare(normalizeText(right.scheduledTime)));

    setRunsheetByEventId((previous) => ({
      ...previous,
      [eventId]: mappedRows,
    }));
  };

  const reloadResourcesForEvent = async (eventId: string) => {
    if (!eventId) {
      return;
    }

    const { data, error } = await supabase.from("event_resources").select("*").eq("event_id", eventId);

    if (error) {
      return;
    }

    const rows = Array.isArray(data) ? (data as GenericRow[]) : [];
    const mappedRows = rows
      .map((row, index) => mapResourceItem(row, index))
      .filter((row): row is EventResourceItem => Boolean(row));

    setResourcesByEventId((previous) => ({
      ...previous,
      [eventId]: mappedRows,
    }));
  };

  useEffect(() => {
    if (!selectedEventId) {
      return;
    }

    void reloadRunsheetForEvent(selectedEventId);

    setRealtimeState("connecting");

    const channel = supabase
      .channel(`volunteer-runsheet-${selectedEventId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "runsheet_items",
          filter: `event_id=eq.${selectedEventId}`,
        },
        () => {
          void reloadRunsheetForEvent(selectedEventId);
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setRealtimeState("live");
          return;
        }

        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setRealtimeState("error");
          return;
        }

        setRealtimeState("connecting");
      });

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [selectedEventId]);

  const cycleTaskState = async (task: RunsheetTaskItem) => {
    if (!task.canMutate) {
      toast.error("This task cannot be updated because its table identifier was not detected.");
      return;
    }

    setIsBusy(true);

    const nextStatus = nextTaskStatus(task.status);
    const statusCandidates = dbStatusCandidates(nextStatus);

    let updateErrorMessage = "";

    for (const candidate of statusCandidates) {
      const { error } = await supabase
        .from("runsheet_items")
        .update({ [task.statusField]: candidate })
        .eq(task.idField, task.id)
        .eq("event_id", task.eventId);

      if (!error) {
        setRunsheetByEventId((previous) => ({
          ...previous,
          [task.eventId]: (previous[task.eventId] || []).map((row) =>
            row.id === task.id
              ? {
                  ...row,
                  status: nextStatus,
                  statusLabel: taskStatusLabel(nextStatus),
                }
              : row
          ),
        }));

        toast.success(`Task moved to ${taskStatusLabel(nextStatus)}.`);
        setIsBusy(false);
        return;
      }

      updateErrorMessage = error.message;
    }

    setIsBusy(false);
    toast.error(updateErrorMessage || "Unable to update task status.");
  };

  const cycleResourceState = async (resource: EventResourceItem) => {
    if (!resource.canMutate) {
      toast.error("This resource cannot be updated because its table identifier was not detected.");
      return;
    }

    setIsBusy(true);

    const nextStatus = nextResourceStatus(resource.status);
    const statusCandidates = resourceDbStatusCandidates(nextStatus);

    let updateErrorMessage = "";

    for (const candidate of statusCandidates) {
      const { error } = await supabase
        .from("event_resources")
        .update({ [resource.statusField]: candidate })
        .eq(resource.idField, resource.id)
        .eq("event_id", resource.eventId);

      if (!error) {
        setResourcesByEventId((previous) => ({
          ...previous,
          [resource.eventId]: (previous[resource.eventId] || []).map((row) =>
            row.id === resource.id
              ? {
                  ...row,
                  status: nextStatus,
                  statusLabel: resourceStatusLabel(nextStatus),
                }
              : row
          ),
        }));

        toast.success(`Resource moved to ${resourceStatusLabel(nextStatus)}.`);
        setIsBusy(false);
        return;
      }

      updateErrorMessage = error.message;
    }

    setIsBusy(false);
    toast.error(updateErrorMessage || "Unable to update resource status.");
  };

  const submitIncident = async () => {
    if (!selectedEventId) {
      return;
    }

    const description = normalizeText(incidentDescription);
    if (!description) {
      toast.error("Add a short incident description before submitting.");
      return;
    }

    setIsBusy(true);

    const insertCandidates: GenericRow[] = [
      {
        event_id: selectedEventId,
        severity: incidentSeverity,
        category: incidentCategory,
        description,
        reported_by: normalizedUserEmail,
      },
      {
        event_id: selectedEventId,
        severity: incidentSeverity,
        category: incidentCategory,
        details: description,
        reported_by_email: normalizedUserEmail,
      },
      {
        event_id: selectedEventId,
        category: incidentCategory,
        message: description,
        created_by: normalizedUserEmail,
      },
    ];

    let insertedRow: GenericRow | null = null;
    let errorMessage = "";

    for (const payload of insertCandidates) {
      const { data, error } = await supabase
        .from("incident_logs")
        .insert(payload)
        .select("*")
        .maybeSingle();

      if (!error) {
        insertedRow = (data as GenericRow | null) || {
          ...payload,
          id: `${selectedEventId}-${Date.now()}`,
          created_at: new Date().toISOString(),
        };
        break;
      }

      errorMessage = error.message;
    }

    if (!insertedRow) {
      setIsBusy(false);
      toast.error(errorMessage || "Unable to submit incident log right now.");
      return;
    }

    const normalizedIncident: IncidentLogItem = {
      id: normalizeText(insertedRow.id || insertedRow.incident_id || insertedRow.log_id) || `${selectedEventId}-${Date.now()}`,
      eventId: selectedEventId,
      severity: toIncidentSeverity(insertedRow.severity),
      category: normalizeText(insertedRow.category) || incidentCategory,
      description:
        normalizeText(insertedRow.description || insertedRow.details || insertedRow.message) || description,
      reportedBy:
        normalizeText(
          insertedRow.reported_by || insertedRow.reported_by_email || insertedRow.created_by
        ) || normalizedUserEmail,
      createdAt: normalizeText(insertedRow.created_at || insertedRow.reported_at) || new Date().toISOString(),
    };

    setIncidentsByEventId((previous) => ({
      ...previous,
      [selectedEventId]: [normalizedIncident, ...(previous[selectedEventId] || [])],
    }));

    setIncidentDescription("");
    setIsBusy(false);
    toast.success("Incident logged.");
  };

  const uploadToStorageWithFallback = async (
    bucketCandidates: string[],
    folder: string,
    file: File
  ): Promise<string> => {
    const filePath = `${folder}/${Date.now()}-${safeFileName(file.name)}`;
    let lastError = "";

    for (const bucket of bucketCandidates) {
      const { error } = await supabase.storage.from(bucket).upload(filePath, file, {
        upsert: false,
      });

      if (!error) {
        const publicUrl = supabase.storage.from(bucket).getPublicUrl(filePath).data.publicUrl;
        return publicUrl;
      }

      lastError = error.message;
    }

    throw new Error(lastError || "Unable to upload file to any configured bucket.");
  };

  const handleUploadExpenseDocument = async () => {
    if (!selectedEvent || !selectedEvent.isPrimaryVolunteer) {
      toast.error("Only Primary Volunteers can submit post-event uploads.");
      return;
    }

    if (!expenseFile) {
      toast.error("Choose an expense document before uploading.");
      return;
    }

    setIsBusy(true);

    try {
      const fileUrl = await uploadToStorageWithFallback(
        ["expense-documents", "expense_documents", "event-documents", "event-assets", "event-images"],
        `volunteer-expenses/${selectedEvent.eventId}`,
        expenseFile
      );

      const amountValue = Number.parseFloat(expenseAmount);
      const safeAmount = Number.isFinite(amountValue) && amountValue > 0 ? amountValue : null;

      const insertCandidates: GenericRow[] = [
        {
          event_id: selectedEvent.eventId,
          file_name: expenseFile.name,
          file_url: fileUrl,
          document_type: "expense_receipt",
          amount: safeAmount,
          uploaded_by: normalizedUserEmail,
          uploaded_at: new Date().toISOString(),
        },
        {
          event_id: selectedEvent.eventId,
          document_name: expenseFile.name,
          document_url: fileUrl,
          amount: safeAmount,
          uploaded_by: normalizedUserEmail,
        },
        {
          event_id: selectedEvent.eventId,
          file_name: expenseFile.name,
          file_url: fileUrl,
        },
      ];

      let insertSucceeded = false;

      for (const payload of insertCandidates) {
        const { error } = await supabase.from("expense_documents").insert(payload);
        if (!error) {
          insertSucceeded = true;
          break;
        }
      }

      setUploadedDocsByEventId((previous) => ({
        ...previous,
        [selectedEvent.eventId]: [fileUrl, ...(previous[selectedEvent.eventId] || [])],
      }));

      setExpenseFile(null);
      setExpenseAmount("");

      toast.success(
        insertSucceeded
          ? "Expense document uploaded and recorded."
          : "Expense document uploaded to storage. Table insert fallback did not match current schema."
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload expense document.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleUploadPhotos = async () => {
    if (!selectedEvent || !selectedEvent.isPrimaryVolunteer) {
      toast.error("Only Primary Volunteers can submit post-event uploads.");
      return;
    }

    if (photoFiles.length === 0) {
      toast.error("Choose at least one photo before uploading.");
      return;
    }

    setIsBusy(true);

    try {
      const uploadedUrls: string[] = [];

      for (const file of photoFiles) {
        const url = await uploadToStorageWithFallback(
          ["event-photos", "event-images", "post-event-photos", "event-assets"],
          `volunteer-photos/${selectedEvent.eventId}`,
          file
        );

        uploadedUrls.push(url);
      }

      setUploadedPhotosByEventId((previous) => ({
        ...previous,
        [selectedEvent.eventId]: [...uploadedUrls, ...(previous[selectedEvent.eventId] || [])],
      }));

      setPhotoFiles([]);
      toast.success("Post-event photos uploaded.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to upload photos.");
    } finally {
      setIsBusy(false);
    }
  };

  if (!initialData.hasAccess || events.length === 0) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-900 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide">Module 11 - Volunteer Execution</p>
        <h1 className="mt-1 text-2xl font-bold">Volunteer Dashboard Access Pending</h1>
        <p className="mt-3 text-sm">
          Your session is valid, but you are not currently listed in the volunteers roster of any
          active event. Ask your event lead to add your email inside the event volunteers JSONB array.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="mt-1 text-2xl font-bold text-slate-900">Volunteer Execution Dashboard</h1>
            <p className="mt-1 text-sm text-slate-600">
              Live execution console for on-ground volunteers. Session-linked and event-scoped.
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
              realtimeState === "live"
                ? "bg-emerald-100 text-emerald-700"
                : realtimeState === "error"
                  ? "bg-rose-100 text-rose-700"
                  : "bg-amber-100 text-amber-700"
            }`}
          >
            <Radio className="h-3.5 w-3.5" />
            Runsheet {realtimeState === "live" ? "Realtime Live" : realtimeState === "error" ? "Realtime Error" : "Connecting"}
          </div>
        </div>
      </section>

      {initialData.warnings.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {initialData.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <label
          htmlFor="volunteer-event-selector"
          className="text-xs font-semibold uppercase tracking-wide text-slate-500"
        >
          Active Event
        </label>
        <select
          id="volunteer-event-selector"
          value={selectedEventId}
          onChange={(event) => {
            setSelectedEventId(event.target.value);
            void reloadResourcesForEvent(event.target.value);
          }}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900"
        >
          {events.map((event) => (
            <option key={event.eventId} value={event.eventId}>
              {event.title}
            </option>
          ))}
        </select>

        {selectedEvent && (
          <div className="mt-3 grid grid-cols-1 gap-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-700 sm:grid-cols-3">
            <p className="inline-flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              {selectedEvent.eventDate || "Date TBD"}
            </p>
            <p className="inline-flex items-center gap-2">
              <Timer className="h-4 w-4 text-slate-500" />
              {selectedEvent.eventTime || "Time TBD"}
            </p>
            <p className="inline-flex items-center gap-2">
              <Wrench className="h-4 w-4 text-slate-500" />
              {selectedEvent.venue || "Venue TBD"}
            </p>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(TAB_LABELS) as TabKey[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                activeTab === tabKey
                  ? "bg-[#154cb3] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {TAB_LABELS[tabKey]}
            </button>
          ))}
        </div>
      </section>

      {activeTab === "tasks" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-[#154cb3]" />
            <h2 className="text-lg font-semibold text-slate-900">My Tasks Checklist</h2>
          </div>

          {myTasks.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No tasks mapped to your email in runsheet_items for this event.
            </p>
          ) : (
            <div className="space-y-2">
              {myTasks.map((task) => (
                <article key={task.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{task.title}</p>
                      {task.description && <p className="mt-1 text-xs text-slate-600">{task.description}</p>}
                      <p className="mt-2 text-xs text-slate-500">{task.scheduledTime || "No time set"}</p>
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          task.status === "done"
                            ? "bg-emerald-100 text-emerald-700"
                            : task.status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {task.statusLabel}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          void cycleTaskState(task);
                        }}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Next Status
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "runsheet" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Timer className="h-5 w-5 text-[#154cb3]" />
            <h2 className="text-lg font-semibold text-slate-900">Live Runsheet Timeline</h2>
          </div>

          {selectedRunsheet.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No runsheet records found for this event.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedRunsheet.map((task) => (
                <article
                  key={task.id}
                  className="rounded-xl border border-slate-200 bg-gradient-to-r from-slate-50 to-white p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        {task.scheduledTime || "Time TBD"}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{task.title}</p>
                      {task.responsiblePersonLabel && (
                        <p className="mt-1 text-xs text-slate-600">Owner: {task.responsiblePersonLabel}</p>
                      )}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          task.status === "done"
                            ? "bg-emerald-100 text-emerald-700"
                            : task.status === "in_progress"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {task.statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void cycleTaskState(task);
                        }}
                        disabled={isBusy}
                        className="rounded-lg border border-[#154cb3] bg-[#e9f0ff] px-3 py-1.5 text-xs font-semibold text-[#154cb3] hover:bg-[#dbe7ff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Toggle Status
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "resources" && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Box className="h-5 w-5 text-[#154cb3]" />
            <h2 className="text-lg font-semibold text-slate-900">Resource Tracker</h2>
          </div>

          {selectedResources.length === 0 ? (
            <p className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
              No event resources found for this event.
            </p>
          ) : (
            <div className="space-y-3">
              {selectedResources.map((resource) => (
                <article key={resource.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{resource.name}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {resource.category || "General"}
                        {resource.quantityLabel ? ` - ${resource.quantityLabel}` : ""}
                      </p>
                      {resource.notes && <p className="mt-1 text-xs text-slate-500">{resource.notes}</p>}
                    </div>

                    <div className="flex flex-col items-end gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          resource.status === "returned"
                            ? "bg-emerald-100 text-emerald-700"
                            : resource.status === "in_use"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-200 text-slate-700"
                        }`}
                      >
                        {resource.statusLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          void cycleResourceState(resource);
                        }}
                        disabled={isBusy}
                        className="rounded-lg border border-slate-400 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Move Next
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {activeTab === "incidents" && (
        <section className="space-y-4">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-[#154cb3]" />
              <h2 className="text-lg font-semibold text-slate-900">Incident Log</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Severity</label>
                <select
                  value={incidentSeverity}
                  onChange={(event) => setIncidentSeverity(event.target.value as "low" | "medium" | "high" | "critical")}
                  aria-label="Incident severity"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Category</label>
                <input
                  type="text"
                  value={incidentCategory}
                  onChange={(event) => setIncidentCategory(event.target.value)}
                  aria-label="Incident category"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="mt-3">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </label>
              <textarea
                value={incidentDescription}
                onChange={(event) => setIncidentDescription(event.target.value)}
                rows={4}
                placeholder="What happened, where, and immediate action taken..."
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                void submitIncident();
              }}
              disabled={isBusy}
              className="mt-3 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <AlertTriangle className="h-4 w-4" />
              Submit Incident
            </button>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">Recent Incidents</h3>
            {selectedIncidents.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">No incidents logged yet for this event.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {selectedIncidents.map((incident) => (
                  <div key={incident.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{incident.category}</p>
                      <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700">
                        {incident.severity}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{incident.description}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {incident.reportedBy || "Unknown"} - {incident.createdAt || "just now"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </article>

          {selectedEvent?.isPrimaryVolunteer && (
            <article className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <FileUp className="h-5 w-5 text-blue-700" />
                <h3 className="text-base font-semibold text-blue-900">Post-Event Uploads (Primary Volunteer)</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-blue-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Expense Documents</p>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.webp"
                    onChange={(event) => setExpenseFile(event.target.files?.[0] || null)}
                    aria-label="Upload expense document"
                    className="mt-2 w-full text-sm"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Amount (optional)"
                    value={expenseAmount}
                    onChange={(event) => setExpenseAmount(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleUploadExpenseDocument();
                    }}
                    disabled={isBusy}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <FileUp className="h-4 w-4" /> Upload Document
                  </button>

                  {uploadedDocLinks.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-blue-800">
                      {uploadedDocLinks.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer" className="underline">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-xl border border-blue-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">Post-Event Photos</p>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(event) =>
                      setPhotoFiles(Array.from(event.target.files || []))
                    }
                    aria-label="Upload post-event photos"
                    className="mt-2 w-full text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      void handleUploadPhotos();
                    }}
                    disabled={isBusy}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-blue-700 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Camera className="h-4 w-4" /> Upload Photos
                  </button>

                  {uploadedPhotoLinks.length > 0 && (
                    <ul className="mt-2 space-y-1 text-xs text-blue-800">
                      {uploadedPhotoLinks.map((url) => (
                        <li key={url}>
                          <a href={url} target="_blank" rel="noreferrer" className="underline">
                            {url}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </article>
          )}
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500 shadow-sm">
        Signed in as {userName || normalizedUserEmail}
        {selectedEvent?.volunteerLabel ? ` (${selectedEvent.volunteerLabel})` : ""}
        {selectedEvent?.isPrimaryVolunteer ? " - Primary Volunteer" : ""}
      </section>
    </div>
  );
}
