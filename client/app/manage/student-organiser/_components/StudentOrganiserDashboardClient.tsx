"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  GripVertical,
  Plus,
  Save,
  Users,
} from "lucide-react";

import {
  AttendanceSummary,
  RunsheetItem,
  StudentOrganiserDashboardData,
  StudentOrganiserEventItem,
  VolunteerItem,
} from "../types";

type DashboardTab = "sub-events" | "logistics" | "volunteers";

type EventDraftState = {
  itDetails: string;
  venueDetails: string;
  cateringDetails: string;
  runsheetItems: RunsheetItem[];
  photoUrlsText: string;
  reportUrlsText: string;
  reportSummary: string;
};

interface StudentOrganiserDashboardClientProps {
  userEmail: string;
  initialData: StudentOrganiserDashboardData;
}

function normalizeText(value: unknown): string {
  return String(value || "").trim();
}

function buildDraftFromEvent(event: StudentOrganiserEventItem): EventDraftState {
  return {
    itDetails: event.logistics.it.details,
    venueDetails: event.logistics.venue.details,
    cateringDetails: event.logistics.catering.details,
    runsheetItems: event.runsheetItems,
    photoUrlsText: event.postEvent.photoUrls.join("\n"),
    reportUrlsText: event.postEvent.reportUrls.join("\n"),
    reportSummary: event.postEvent.reportSummary,
  };
}

function buildInitialDrafts(events: StudentOrganiserEventItem[]): Record<string, EventDraftState> {
  return events.reduce<Record<string, EventDraftState>>((acc, event) => {
    acc[event.eventId] = buildDraftFromEvent(event);
    return acc;
  }, {});
}

function multilineToArray(value: string): string[] {
  return value
    .split(/\n|,/)
    .map((entry) => normalizeText(entry))
    .filter((entry) => entry.length > 0);
}

function toVenueStatusFromDraft(venueDetails: string): "pending" | "requested" | "confirmed" {
  if (normalizeText(venueDetails).length > 0) {
    return "requested";
  }
  return "pending";
}

const tabStyles: Record<DashboardTab, string> = {
  "sub-events": "My Sub-Events",
  logistics: "Logistics & Runsheet",
  volunteers: "Volunteer Management",
};

export default function StudentOrganiserDashboardClient({
  userEmail,
  initialData,
}: StudentOrganiserDashboardClientProps) {
  const router = useRouter();

  const [events, setEvents] = useState<StudentOrganiserEventItem[]>(initialData.events);
  const [volunteersByEventId] = useState<Record<string, VolunteerItem[]>>(
    initialData.volunteersByEventId
  );
  const [attendanceByEventId, setAttendanceByEventId] = useState<
    Record<string, AttendanceSummary>
  >(initialData.attendanceByEventId);
  const [draftsByEventId, setDraftsByEventId] = useState<Record<string, EventDraftState>>(
    buildInitialDrafts(initialData.events)
  );

  const [activeTab, setActiveTab] = useState<DashboardTab>("sub-events");
  const [selectedEventId, setSelectedEventId] = useState<string>(initialData.events[0]?.eventId || "");
  const [newRunsheetTime, setNewRunsheetTime] = useState("");
  const [newRunsheetTask, setNewRunsheetTask] = useState("");
  const [newRunsheetNotes, setNewRunsheetNotes] = useState("");
  const [draggedRunsheetItemId, setDraggedRunsheetItemId] = useState<string | null>(null);
  const [savingAction, setSavingAction] = useState<
    null | "logistics" | "runsheet" | "post-event" | "attendance"
  >(null);

  const selectedEvent = useMemo(
    () => events.find((event) => event.eventId === selectedEventId) || null,
    [events, selectedEventId]
  );

  const selectedEventDraft = useMemo(() => {
    if (!selectedEvent) {
      return null;
    }

    return draftsByEventId[selectedEvent.eventId] || buildDraftFromEvent(selectedEvent);
  }, [draftsByEventId, selectedEvent]);

  const selectedEventVolunteers = useMemo(
    () => volunteersByEventId[selectedEventId] || [],
    [volunteersByEventId, selectedEventId]
  );

  const selectedAttendance = useMemo(
    () =>
      attendanceByEventId[selectedEventId] || {
        eventId: selectedEventId,
        total: 0,
        attended: 0,
        absent: 0,
        pending: 0,
      },
    [attendanceByEventId, selectedEventId]
  );

  const assignedTaskByVolunteerId = useMemo(() => {
    const assignmentMap: Record<string, string> = {};

    if (!selectedEventDraft) {
      return assignmentMap;
    }

    selectedEventDraft.runsheetItems.forEach((item) => {
      if (item.assigneeRegistrationId) {
        assignmentMap[item.assigneeRegistrationId] = item.task;
      }
    });

    return assignmentMap;
  }, [selectedEventDraft]);

  const setDraftForSelectedEvent = (
    updater: (previous: EventDraftState) => EventDraftState
  ) => {
    if (!selectedEvent) {
      return;
    }

    const eventId = selectedEvent.eventId;

    setDraftsByEventId((previous) => {
      const currentDraft = previous[eventId] || buildDraftFromEvent(selectedEvent);
      return {
        ...previous,
        [eventId]: updater(currentDraft),
      };
    });
  };

  const sendEventUpdate = async (eventId: string, body: Record<string, unknown>) => {
    const response = await fetch(
      `/api/manage/student-organiser/events/${encodeURIComponent(eventId)}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(payload?.error || "Unable to update Student Organiser event data.");
    }

    return payload;
  };

  const handleSaveLogistics = async () => {
    if (!selectedEvent || !selectedEventDraft) {
      return;
    }

    setSavingAction("logistics");

    try {
      await sendEventUpdate(selectedEvent.eventId, {
        action: "save_logistics",
        payload: {
          itDetails: selectedEventDraft.itDetails,
          venueDetails: selectedEventDraft.venueDetails,
          cateringDetails: selectedEventDraft.cateringDetails,
          step3Bypass: true,
        },
      });

      const nowIso = new Date().toISOString();

      setEvents((previous) =>
        previous.map((event) => {
          if (event.eventId !== selectedEvent.eventId) {
            return event;
          }

          return {
            ...event,
            venueStatus: toVenueStatusFromDraft(selectedEventDraft.venueDetails),
            logistics: {
              it: {
                details: normalizeText(selectedEventDraft.itDetails),
                status: normalizeText(selectedEventDraft.itDetails) ? "submitted" : "pending",
                submittedAt: normalizeText(selectedEventDraft.itDetails) ? nowIso : null,
              },
              venue: {
                details: normalizeText(selectedEventDraft.venueDetails),
                status: normalizeText(selectedEventDraft.venueDetails) ? "submitted" : "pending",
                submittedAt: normalizeText(selectedEventDraft.venueDetails) ? nowIso : null,
              },
              catering: {
                details: normalizeText(selectedEventDraft.cateringDetails),
                status: normalizeText(selectedEventDraft.cateringDetails) ? "submitted" : "pending",
                submittedAt: normalizeText(selectedEventDraft.cateringDetails) ? nowIso : null,
              },
            },
          };
        })
      );

      toast.success("IT, Venue, and Catering requests submitted through the Step 3 bypass flow.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save logistics requests.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSaveRunsheet = async () => {
    if (!selectedEvent || !selectedEventDraft) {
      return;
    }

    setSavingAction("runsheet");

    try {
      await sendEventUpdate(selectedEvent.eventId, {
        action: "save_runsheet",
        payload: {
          runsheetItems: selectedEventDraft.runsheetItems,
        },
      });

      setEvents((previous) =>
        previous.map((event) =>
          event.eventId === selectedEvent.eventId
            ? {
                ...event,
                runsheetItems: selectedEventDraft.runsheetItems,
              }
            : event
        )
      );

      toast.success("Runsheet and volunteer assignments saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save runsheet.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleSavePostEvent = async () => {
    if (!selectedEvent || !selectedEventDraft) {
      return;
    }

    setSavingAction("post-event");

    const photoUrls = multilineToArray(selectedEventDraft.photoUrlsText);
    const reportUrls = multilineToArray(selectedEventDraft.reportUrlsText);

    try {
      await sendEventUpdate(selectedEvent.eventId, {
        action: "save_post_event",
        payload: {
          photoUrls,
          reportUrls,
          reportSummary: selectedEventDraft.reportSummary,
        },
      });

      setEvents((previous) =>
        previous.map((event) =>
          event.eventId === selectedEvent.eventId
            ? {
                ...event,
                postEvent: {
                  ...event.postEvent,
                  photoUrls,
                  reportUrls,
                  reportSummary: selectedEventDraft.reportSummary,
                },
              }
            : event
        )
      );

      toast.success("Post-event assets saved.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save post-event assets.");
    } finally {
      setSavingAction(null);
    }
  };

  const handleFinalizeAttendance = async () => {
    if (!selectedEvent) {
      return;
    }

    if (selectedEvent.postEvent.attendanceFinalized) {
      toast.message("Attendance is already finalized for this event.");
      return;
    }

    setSavingAction("attendance");

    try {
      await sendEventUpdate(selectedEvent.eventId, {
        action: "finalize_attendance",
        payload: {
          attendanceSummary: selectedAttendance,
        },
      });

      const nowIso = new Date().toISOString();

      setEvents((previous) =>
        previous.map((event) =>
          event.eventId === selectedEvent.eventId
            ? {
                ...event,
                postEvent: {
                  ...event.postEvent,
                  attendanceFinalized: true,
                  attendanceFinalizedAt: nowIso,
                  attendanceFinalizedBy: userEmail,
                },
              }
            : event
        )
      );

      setAttendanceByEventId((previous) => ({
        ...previous,
        [selectedEvent.eventId]: {
          ...selectedAttendance,
          pending: Math.max(selectedAttendance.total - selectedAttendance.attended - selectedAttendance.absent, 0),
        },
      }));

      toast.success("Attendance finalized for this sub-event.");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to finalize attendance.");
    } finally {
      setSavingAction(null);
    }
  };

  const addRunsheetItem = () => {
    if (!selectedEventDraft) {
      return;
    }

    const task = normalizeText(newRunsheetTask);
    if (!task) {
      toast.error("Enter a task name before adding a runsheet item.");
      return;
    }

    const nextRunsheetItem: RunsheetItem = {
      id: `${selectedEventId}-runsheet-${Date.now()}`,
      time: normalizeText(newRunsheetTime),
      task,
      notes: normalizeText(newRunsheetNotes),
      order: selectedEventDraft.runsheetItems.length,
      assigneeRegistrationId: null,
      assigneeLabel: null,
    };

    setDraftForSelectedEvent((previous) => ({
      ...previous,
      runsheetItems: [...previous.runsheetItems, nextRunsheetItem],
    }));

    setNewRunsheetTime("");
    setNewRunsheetTask("");
    setNewRunsheetNotes("");
  };

  const removeRunsheetItem = (itemId: string) => {
    setDraftForSelectedEvent((previous) => {
      const nextItems = previous.runsheetItems
        .filter((item) => item.id !== itemId)
        .map((item, index) => ({ ...item, order: index }));

      return {
        ...previous,
        runsheetItems: nextItems,
      };
    });
  };

  const reorderRunsheetItems = (targetItemId: string) => {
    if (!draggedRunsheetItemId || !selectedEventDraft) {
      return;
    }

    if (draggedRunsheetItemId === targetItemId) {
      return;
    }

    const nextItems = [...selectedEventDraft.runsheetItems];
    const fromIndex = nextItems.findIndex((item) => item.id === draggedRunsheetItemId);
    const toIndex = nextItems.findIndex((item) => item.id === targetItemId);

    if (fromIndex < 0 || toIndex < 0) {
      return;
    }

    const [movedItem] = nextItems.splice(fromIndex, 1);
    nextItems.splice(toIndex, 0, movedItem);

    setDraftForSelectedEvent((previous) => ({
      ...previous,
      runsheetItems: nextItems.map((item, index) => ({ ...item, order: index })),
    }));
  };

  const handleRunsheetAssignmentChange = (itemId: string, volunteerRegistrationId: string) => {
    const selectedVolunteer = selectedEventVolunteers.find(
      (volunteer) => volunteer.registrationId === volunteerRegistrationId
    );

    setDraftForSelectedEvent((previous) => ({
      ...previous,
      runsheetItems: previous.runsheetItems.map((item) =>
        item.id === itemId
          ? {
              ...item,
              assigneeRegistrationId: volunteerRegistrationId || null,
              assigneeLabel: selectedVolunteer
                ? `${selectedVolunteer.name}${selectedVolunteer.email ? ` (${selectedVolunteer.email})` : ""}`
                : null,
            }
          : item
      ),
    }));
  };

  if (events.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Student Organiser Dashboard</h1>
        <p className="mt-3 text-sm text-slate-600">
          No fest-linked sub-events are assigned to you yet. Your scope only includes events where
          you are the creator or listed as an event head.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mt-1 text-2xl font-bold text-slate-900">Student Organiser Dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage logistics execution for your fest sub-events. Budget approvals are intentionally
          excluded from this role.
        </p>
      </section>

      {initialData.warnings.length > 0 && (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {initialData.warnings.map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-wrap items-center gap-3">
          {(Object.keys(tabStyles) as DashboardTab[]).map((tabKey) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => setActiveTab(tabKey)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeTab === tabKey
                  ? "bg-[#154cb3] text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {tabStyles[tabKey]}
            </button>
          ))}

          <div className="ml-auto min-w-[16rem]">
            <label
              htmlFor="student-organiser-event-select"
              className="block text-xs font-semibold uppercase tracking-wide text-slate-500"
            >
              Active Sub-Event
            </label>
            <select
              id="student-organiser-event-select"
              value={selectedEventId}
              onChange={(event) => setSelectedEventId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
            >
              {events.map((event) => (
                <option key={event.eventId} value={event.eventId}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {activeTab === "sub-events" && (
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {events.map((event) => (
            <article key={event.eventId} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">{event.title}</h3>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Fest ID: {event.festId}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    event.venueStatus === "confirmed"
                      ? "bg-emerald-100 text-emerald-700"
                      : event.venueStatus === "requested"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-slate-100 text-slate-700"
                  }`}
                >
                  Venue: {event.venueStatus}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-600 sm:grid-cols-2">
                <p className="inline-flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-slate-400" />
                  {event.eventDate || "Date TBD"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Time:</span>{" "}
                  {event.eventTime || "TBD"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Venue:</span>{" "}
                  {event.venue || "Not assigned"}
                </p>
                <p>
                  <span className="font-semibold text-slate-700">Department:</span>{" "}
                  {event.organizingDept || "N/A"}
                </p>
              </div>

              <div className="mt-5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId(event.eventId);
                    setActiveTab("logistics");
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-[#154cb3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12429f]"
                >
                  Manage Logistics <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </article>
          ))}
        </section>
      )}

      {activeTab === "logistics" && selectedEvent && selectedEventDraft && (
        <section className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-[#154cb3]" />
              <h2 className="text-lg font-semibold text-slate-900">Logistics Request Console</h2>
            </div>
            <p className="text-sm text-slate-600">
              Step 3 bypass is enabled for Student Organisers. IT, Venue, and Catering requests are
              submitted directly for operational execution.
            </p>

            <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  IT Request
                </label>
                <textarea
                  value={selectedEventDraft.itDetails}
                  onChange={(event) =>
                    setDraftForSelectedEvent((previous) => ({
                      ...previous,
                      itDetails: event.target.value,
                    }))
                  }
                  placeholder="Wi-Fi, projector, laptop ports, audio-visual support..."
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Venue Request
                </label>
                <textarea
                  value={selectedEventDraft.venueDetails}
                  onChange={(event) =>
                    setDraftForSelectedEvent((previous) => ({
                      ...previous,
                      venueDetails: event.target.value,
                    }))
                  }
                  placeholder="Stage setup, seating, mic stands, layout instructions..."
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Catering Request
                </label>
                <textarea
                  value={selectedEventDraft.cateringDetails}
                  onChange={(event) =>
                    setDraftForSelectedEvent((previous) => ({
                      ...previous,
                      cateringDetails: event.target.value,
                    }))
                  }
                  placeholder="Snacks, water counters, volunteer meal packs..."
                  rows={4}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  void handleSaveLogistics();
                }}
                disabled={savingAction === "logistics"}
                className="inline-flex items-center gap-2 rounded-full bg-[#154cb3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12429f] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingAction === "logistics" ? "Saving..." : "Submit Logistics Requests"}
              </button>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-emerald-600" />
              <h2 className="text-lg font-semibold text-slate-900">Drag-and-Drop Runsheet Builder</h2>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <input
                type="time"
                value={newRunsheetTime}
                onChange={(event) => setNewRunsheetTime(event.target.value)}
                aria-label="Runsheet item time"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
              <input
                type="text"
                value={newRunsheetTask}
                onChange={(event) => setNewRunsheetTask(event.target.value)}
                placeholder="Task title"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
              <input
                type="text"
                value={newRunsheetNotes}
                onChange={(event) => setNewRunsheetNotes(event.target.value)}
                placeholder="Notes (optional)"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
              <button
                type="button"
                onClick={addRunsheetItem}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                <Plus className="h-4 w-4" /> Add Item
              </button>
            </div>

            <div className="mt-4 space-y-2">
              {selectedEventDraft.runsheetItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  No runsheet items yet. Add tasks to build your execution flow.
                </p>
              ) : (
                selectedEventDraft.runsheetItems.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedRunsheetItemId(item.id)}
                    onDragEnd={() => setDraggedRunsheetItemId(null)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => reorderRunsheetItems(item.id)}
                    className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:flex-row sm:items-center"
                  >
                    <div className="inline-flex items-center gap-2 text-slate-500">
                      <GripVertical className="h-4 w-4" />
                      <span className="w-14 text-sm font-semibold">{item.time || "--:--"}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-slate-900">{item.task}</p>
                      {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeRunsheetItem(item.id)}
                      className="rounded-md border border-rose-300 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                    >
                      Remove
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  void handleSaveRunsheet();
                }}
                disabled={savingAction === "runsheet"}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingAction === "runsheet" ? "Saving..." : "Save Runsheet"}
              </button>
            </div>
          </article>
        </section>
      )}

      {activeTab === "volunteers" && selectedEvent && selectedEventDraft && (
        <section className="space-y-5">
          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-5 w-5 text-[#154cb3]" />
              <h2 className="text-lg font-semibold text-slate-900">Assigned Volunteers</h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Volunteer</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Email</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Registration ID</th>
                    <th className="px-3 py-2 text-left font-semibold text-slate-600">Current Task</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {selectedEventVolunteers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-5 text-center text-slate-500">
                        No volunteer registrations found for this sub-event.
                      </td>
                    </tr>
                  ) : (
                    selectedEventVolunteers.map((volunteer) => (
                      <tr key={volunteer.registrationId}>
                        <td className="px-3 py-2 font-medium text-slate-900">{volunteer.name}</td>
                        <td className="px-3 py-2 text-slate-600">{volunteer.email || "-"}</td>
                        <td className="px-3 py-2 text-slate-600">{volunteer.registrationId}</td>
                        <td className="px-3 py-2 text-slate-600">
                          {assignedTaskByVolunteerId[volunteer.registrationId] || "Unassigned"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-semibold text-slate-900">
              Assign Runsheet Items to Volunteers
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Map each task to a specific volunteer for clear ownership.
            </p>

            <div className="mt-4 space-y-3">
              {selectedEventDraft.runsheetItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-500">
                  Add runsheet items first to assign volunteers.
                </p>
              ) : (
                selectedEventDraft.runsheetItems.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-3"
                  >
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Time</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.time || "--:--"}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Task</p>
                      <p className="mt-1 text-sm font-semibold text-slate-900">{item.task}</p>
                      {item.notes && <p className="text-xs text-slate-500">{item.notes}</p>}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Assign Volunteer
                      </label>
                      <select
                        value={item.assigneeRegistrationId || ""}
                        onChange={(event) =>
                          handleRunsheetAssignmentChange(item.id, event.target.value)
                        }
                        aria-label={`Assign volunteer for ${item.task}`}
                        className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
                      >
                        <option value="">Unassigned</option>
                        {selectedEventVolunteers.map((volunteer) => (
                          <option key={volunteer.registrationId} value={volunteer.registrationId}>
                            {volunteer.name}
                            {volunteer.email ? ` (${volunteer.email})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  void handleSaveRunsheet();
                }}
                disabled={savingAction === "runsheet"}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {savingAction === "runsheet" ? "Saving..." : "Save Volunteer Assignments"}
              </button>
            </div>
          </article>
        </section>
      )}

      {selectedEvent && selectedEventDraft && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Post-Event Tools</h2>
          <p className="mt-1 text-sm text-slate-600">
            Upload photo/report links and finalize attendance closure for the selected sub-event.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Photo URLs (one per line)
              </label>
              <textarea
                value={selectedEventDraft.photoUrlsText}
                onChange={(event) =>
                  setDraftForSelectedEvent((previous) => ({
                    ...previous,
                    photoUrlsText: event.target.value,
                  }))
                }
                rows={5}
                placeholder="https://..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Report URLs (one per line)
              </label>
              <textarea
                value={selectedEventDraft.reportUrlsText}
                onChange={(event) =>
                  setDraftForSelectedEvent((previous) => ({
                    ...previous,
                    reportUrlsText: event.target.value,
                  }))
                }
                rows={5}
                placeholder="https://..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Final Report Summary
              </label>
              <textarea
                value={selectedEventDraft.reportSummary}
                onChange={(event) =>
                  setDraftForSelectedEvent((previous) => ({
                    ...previous,
                    reportSummary: event.target.value,
                  }))
                }
                rows={5}
                placeholder="Write a concise post-event summary..."
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void handleSavePostEvent();
              }}
              disabled={savingAction === "post-event"}
              className="inline-flex items-center gap-2 rounded-full bg-[#154cb3] px-4 py-2 text-sm font-semibold text-white hover:bg-[#12429f] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingAction === "post-event" ? "Saving..." : "Save Post-Event Assets"}
            </button>

            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <p>
                Attendance: {selectedAttendance.attended} attended, {selectedAttendance.absent} absent,
                {" "}{selectedAttendance.pending} pending (total {selectedAttendance.total})
              </p>
              {selectedEvent.postEvent.attendanceFinalized && (
                <p className="mt-1 font-semibold text-emerald-700">
                  Finalized on {selectedEvent.postEvent.attendanceFinalizedAt || "-"}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                void handleFinalizeAttendance();
              }}
              disabled={savingAction === "attendance" || selectedEvent.postEvent.attendanceFinalized}
              className="inline-flex items-center gap-2 rounded-full border border-emerald-500 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingAction === "attendance" ? "Finalizing..." : "Finalize Attendance"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
