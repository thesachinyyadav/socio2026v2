"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Building2, CalendarDays, ClipboardList, FolderKanban, History, Loader2, X } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";
import { useAuth } from "@/context/AuthContext";

type OrganiserEvent = {
  event_id: string;
  title: string;
  event_date: string;
  event_time?: string | null;
  venue?: string | null;
  category?: string | null;
  registration_fee?: number | string | null;
  registration_deadline?: string | null;
  fest_id?: string | null;
  fest?: string | null;
  organizing_dept?: string | null;
  created_by: string;
  created_at: string;
};

type OrganiserRegistration = {
  registration_id: string;
  event_id: string;
  registration_type?: string | null;
  created_at: string;
  user_email?: string | null;
  individual_name?: string | null;
  individual_email?: string | null;
  team_name?: string | null;
  team_leader_name?: string | null;
  team_leader_email?: string | null;
  teammates?: any[] | string | null;
};

type BacktrackingView = "events" | "registrations";
type BacktrackingScope = "all-events" | "organiser";

type OrganiserHistoryModalProps = {
  isOpen: boolean;
  organiserIdentifier: string | null;
  organiserOptions: string[];
  onOrganiserChange: (identifier: string | null) => void;
  onClose: () => void;
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unavailable";
  return parsed.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatTime = (value?: string | null) => {
  if (!value) return "TBA";

  const safeValue = value.length === 5 ? `${value}:00` : value;
  const parsed = new Date(`1970-01-01T${safeValue}`);
  if (Number.isNaN(parsed.getTime())) return value;

  return parsed.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFee = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") {
    return "Free";
  }

  const parsed = typeof value === "string" ? Number.parseFloat(value) : value;
  if (Number.isNaN(parsed) || parsed <= 0) {
    return "Free";
  }

  return `Rs ${parsed.toLocaleString("en-IN")}`;
};

const getEventStatus = (eventDate: string) => {
  const parsed = new Date(eventDate);
  if (Number.isNaN(parsed.getTime())) {
    return {
      label: "Unknown",
      className: "bg-slate-100 text-slate-600 border border-slate-200",
    };
  }

  if (parsed.getTime() < Date.now()) {
    return {
      label: "Past",
      className: "bg-slate-100 text-slate-700 border border-slate-200",
    };
  }

  return {
    label: "Upcoming",
    className: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  };
};

const normalizeRegistrationType = (value?: string | null) => {
  return (value || "individual").toLowerCase() === "team" ? "team" : "individual";
};

const parseTeammates = (teammates: OrganiserRegistration["teammates"]) => {
  if (Array.isArray(teammates)) return teammates;
  if (typeof teammates === "string" && teammates.trim()) {
    try {
      const parsed = JSON.parse(teammates);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const getRegistrantName = (registration: OrganiserRegistration) => {
  if (normalizeRegistrationType(registration.registration_type) === "team") {
    return (
      registration.team_name ||
      registration.team_leader_name ||
      registration.team_leader_email ||
      "Team Registration"
    );
  }

  return (
    registration.individual_name ||
    registration.individual_email ||
    registration.user_email ||
    "Individual Registration"
  );
};

const getRegistrantEmail = (registration: OrganiserRegistration) => {
  if (normalizeRegistrationType(registration.registration_type) === "team") {
    return registration.team_leader_email || registration.user_email || "";
  }

  return registration.individual_email || registration.user_email || "";
};

const getTeamSize = (registration: OrganiserRegistration) => {
  if (normalizeRegistrationType(registration.registration_type) !== "team") {
    return 1;
  }

  const teammates = parseTeammates(registration.teammates);
  return 1 + teammates.length;
};

const ORGANISER_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

type OrganiserTagMeta = {
  value: string;
  isValidEmail: boolean;
  hasValue: boolean;
};

const getOrganiserTagMeta = (value?: string | null): OrganiserTagMeta => {
  const normalized = (value || "").trim();

  if (!normalized) {
    return {
      value: "Unknown organiser",
      isValidEmail: false,
      hasValue: false,
    };
  }

  return {
    value: normalized,
    isValidEmail: ORGANISER_EMAIL_REGEX.test(normalized),
    hasValue: true,
  };
};

const getOrganiserTagClassName = (meta: OrganiserTagMeta) => {
  if (meta.isValidEmail) {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (meta.hasValue) {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  return "border-slate-200 bg-slate-100 text-slate-600";
};

const getOrganiserTagText = (meta: OrganiserTagMeta) => {
  if (meta.hasValue && !meta.isValidEmail) {
    return `${meta.value} (unverified)`;
  }

  return meta.value;
};

export default function OrganiserHistoryModal({
  isOpen,
  organiserIdentifier,
  organiserOptions,
  onOrganiserChange,
  onClose,
}: OrganiserHistoryModalProps) {
  const { session } = useAuth();
  const [events, setEvents] = useState<OrganiserEvent[]>([]);
  const [registrations, setRegistrations] = useState<OrganiserRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scope, setScope] = useState<BacktrackingScope>("all-events");
  const [activeIdentifier, setActiveIdentifier] = useState("");
  const [activeView, setActiveView] = useState<BacktrackingView>("events");
  const [selectedEventId, setSelectedEventId] = useState("all");

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const applyAuthenticatedSession = useCallback(async () => {
    if (session?.access_token && session?.refresh_token) {
      await supabase.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
      });
    }
  }, [session?.access_token, session?.refresh_token, supabase]);

  const getEventsByOrganiser = useCallback(
    async (identifier: string) => {
      await applyAuthenticatedSession();

      const { data, error: fetchError } = await supabase
        .from("events")
        .select(
          "event_id, title, event_date, event_time, venue, category, registration_fee, registration_deadline, fest_id, fest, organizing_dept, created_by, created_at"
        )
        .eq("created_by", identifier)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return (data ?? []) as OrganiserEvent[];
    },
    [applyAuthenticatedSession, supabase]
  );

  const getAllEvents = useCallback(async () => {
    await applyAuthenticatedSession();

    const { data, error: fetchError } = await supabase
      .from("events")
      .select(
        "event_id, title, event_date, event_time, venue, category, registration_fee, registration_deadline, fest_id, fest, organizing_dept, created_by, created_at"
      )
      .order("created_at", { ascending: false });

    if (fetchError) {
      throw fetchError;
    }

    return (data ?? []) as OrganiserEvent[];
  }, [applyAuthenticatedSession, supabase]);

  const getRegistrationsByEventIds = useCallback(
    async (eventIds: string[]) => {
      if (eventIds.length === 0) {
        return [];
      }

      await applyAuthenticatedSession();

      const { data, error: fetchError } = await supabase
        .from("registrations")
        .select(
          "registration_id, event_id, registration_type, created_at, user_email, individual_name, individual_email, team_name, team_leader_name, team_leader_email, teammates"
        )
        .in("event_id", eventIds)
        .order("created_at", { ascending: false });

      if (fetchError) {
        throw fetchError;
      }

      return (data ?? []) as OrganiserRegistration[];
    },
    [applyAuthenticatedSession, supabase]
  );

  useEffect(() => {
    if (!isOpen) return;

    if (organiserIdentifier) {
      setScope("organiser");
      setActiveIdentifier(organiserIdentifier);
      setSelectedEventId("all");
      setActiveView("events");
      return;
    }

    setScope("all-events");
    setActiveIdentifier("");
    setSelectedEventId("all");
    setActiveView("events");
  }, [isOpen, organiserIdentifier]);

  useEffect(() => {
    if (!isOpen) return;

    if (scope === "organiser" && !activeIdentifier) {
      setEvents([]);
      setRegistrations([]);
      setError(null);
      setIsLoading(false);
      return;
    }

    let alive = true;
    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const result =
          scope === "organiser"
            ? await getEventsByOrganiser(activeIdentifier)
            : await getAllEvents();
        const eventIds = result.map((event) => event.event_id).filter(Boolean);
        const registrationResult = await getRegistrationsByEventIds(eventIds);

        if (alive) {
          setEvents(result);
          setRegistrations(registrationResult);
        }
      } catch (err: any) {
        if (alive) {
          setEvents([]);
          setRegistrations([]);
          setError(err?.message || "Failed to fetch event backtracking data");
        }
      } finally {
        if (alive) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      alive = false;
    };
  }, [
    isOpen,
    scope,
    activeIdentifier,
    getAllEvents,
    getEventsByOrganiser,
    getRegistrationsByEventIds,
  ]);

  useEffect(() => {
    if (!isOpen) return;

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onEscape);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onEscape);
    };
  }, [isOpen, onClose]);

  const handleIdentifierChange = (identifier: string) => {
    setActiveIdentifier(identifier);
    setSelectedEventId("all");
    setActiveView("events");
    onOrganiserChange(identifier || null);
  };

  const handleScopeChange = (nextScope: BacktrackingScope) => {
    setScope(nextScope);
    setSelectedEventId("all");
    setActiveView("events");

    if (nextScope === "all-events") {
      setActiveIdentifier("");
      onOrganiserChange(null);
    }
  };

  const filteredRegistrations = useMemo(() => {
    if (selectedEventId === "all") {
      return registrations;
    }

    return registrations.filter((registration) => registration.event_id === selectedEventId);
  }, [registrations, selectedEventId]);

  const registrationSummary = useMemo(() => {
    const summary = {
      total: filteredRegistrations.length,
      individual: 0,
      team: 0,
    };

    filteredRegistrations.forEach((registration) => {
      if (normalizeRegistrationType(registration.registration_type) === "team") {
        summary.team += 1;
      } else {
        summary.individual += 1;
      }
    });

    return summary;
  }, [filteredRegistrations]);

  const eventLookup = useMemo(() => {
    return new Map(events.map((event) => [event.event_id, event]));
  }, [events]);

  const registrationCountByEvent = useMemo(() => {
    const countMap = new Map<string, number>();

    registrations.forEach((registration) => {
      if (!registration.event_id) return;
      countMap.set(
        registration.event_id,
        (countMap.get(registration.event_id) || 0) + 1
      );
    });

    return countMap;
  }, [registrations]);

  const registrationsByEvent = useMemo(() => {
    const grouped = new Map<
      string,
      {
        eventId: string;
        title: string;
        count: number;
        latestAt: string;
        team: number;
        individual: number;
        organiserEmail: string | null;
      }
    >();

    filteredRegistrations.forEach((registration) => {
      const eventId = registration.event_id;
      const linkedEvent = eventLookup.get(eventId);
      const current = grouped.get(eventId) || {
        eventId,
        title: linkedEvent?.title || "Unknown Event",
        count: 0,
        latestAt: registration.created_at,
        team: 0,
        individual: 0,
        organiserEmail: linkedEvent?.created_by || null,
      };

      current.count += 1;
      if (normalizeRegistrationType(registration.registration_type) === "team") {
        current.team += 1;
      } else {
        current.individual += 1;
      }

      if (!current.organiserEmail && linkedEvent?.created_by) {
        current.organiserEmail = linkedEvent.created_by;
      }

      if (new Date(registration.created_at).getTime() > new Date(current.latestAt).getTime()) {
        current.latestAt = registration.created_at;
      }

      grouped.set(eventId, current);
    });

    return Array.from(grouped.values()).sort((a, b) => b.count - a.count);
  }, [eventLookup, filteredRegistrations]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 bg-black/40"
        aria-label="Close organiser history"
      />

      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto border-l border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                Event Backtracking
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">
                {scope === "all-events" ? "All Events Backtracking" : "Organiser Event History"}
              </h3>
              <p className="mt-1 text-sm text-slate-500 break-all">
                {scope === "all-events"
                  ? "Backtracking across all events without organiser filtering"
                  : activeIdentifier || "Select an organiser to view event history"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="px-6 py-5">
          <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Backtracking scope
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleScopeChange("all-events")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  scope === "all-events"
                    ? "bg-[#154CB3] text-white"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
                }`}
              >
                All Events
              </button>
              <button
                type="button"
                onClick={() => handleScopeChange("organiser")}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  scope === "organiser"
                    ? "bg-[#154CB3] text-white"
                    : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
                }`}
              >
                By Organiser
              </button>
            </div>
          </div>

          {scope === "organiser" && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <label htmlFor="organiser-history-select" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                Choose organiser
              </label>
              <select
                id="organiser-history-select"
                value={activeIdentifier}
                onChange={(event) => handleIdentifierChange(event.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#154CB3] focus:ring-2 focus:ring-[#154CB3]/20"
              >
                <option value="">Select an organiser</option>
                {organiserOptions.map((identifier) => (
                  <option key={identifier} value={identifier}>
                    {identifier}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "organiser" && activeIdentifier && (
            <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-700 break-all">
              Filtering events by organiser: <span className="font-semibold">{activeIdentifier}</span>
            </div>
          )}

          {scope === "all-events" && (
            <div className="mb-4 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
              Showing platform-wide event history (all organisers).
            </div>
          )}

          <div className="mb-4 flex gap-2 rounded-xl border border-slate-200 bg-white p-1">
            <button
              type="button"
              onClick={() => setActiveView("events")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeView === "events"
                  ? "bg-[#154CB3] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Events
            </button>
            <button
              type="button"
              onClick={() => setActiveView("registrations")}
              className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                activeView === "registrations"
                  ? "bg-[#154CB3] text-white"
                  : "text-slate-600 hover:bg-slate-100"
              }`}
            >
              Event Registrations
            </button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-16">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                {scope === "organiser"
                  ? "Fetching organiser events and registrations..."
                  : "Fetching all events and registrations..."}
              </div>
            </div>
          ) : scope === "organiser" && !activeIdentifier ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <History className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-base font-semibold text-slate-700">Choose an organiser</p>
              <p className="mt-1 text-sm text-slate-500">
                Select an organiser from the dropdown to pull up their event history.
              </p>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : activeView === "events" ? events.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <History className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-base font-semibold text-slate-700">No events found</p>
              <p className="mt-1 text-sm text-slate-500">
                {scope === "organiser"
                  ? "This organiser does not have historical event records yet."
                  : "No event records are available for backtracking yet."}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event) => {
                const status = getEventStatus(event.event_date);
                const eventRegistrationCount = registrationCountByEvent.get(event.event_id) || 0;
                const organiserTagMeta = getOrganiserTagMeta(event.created_by);
                return (
                  <div
                    key={`${event.event_id}-${event.created_at}`}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {event.title || "Untitled Event"}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Created on {formatDate(event.created_at)}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span
                        title={organiserTagMeta.value}
                        className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] ${getOrganiserTagClassName(organiserTagMeta)}`}
                      >
                        Organizer:
                        <span className="max-w-[220px] truncate">{getOrganiserTagText(organiserTagMeta)}</span>
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        <CalendarDays className="h-3 w-3" />
                        {formatDate(event.event_date)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        {formatTime(event.event_time)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        {event.venue || "Venue TBA"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        <FolderKanban className="h-3 w-3" />
                        {event.fest_id || event.fest || "No Fest"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        <Building2 className="h-3 w-3" />
                        {event.organizing_dept || "No Department"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        {event.category || "General"}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        {formatFee(event.registration_fee)}
                      </span>
                      {event.registration_deadline && (
                        <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                          Reg closes {formatDate(event.registration_deadline)}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600">
                        <ClipboardList className="h-3 w-3" />
                        {eventRegistrationCount} registrations
                      </span>
                    </div>

                    <div className="mt-3">
                      <Link
                        href={`/event/${event.event_id}`}
                        className="inline-flex items-center text-xs font-semibold text-[#154CB3] hover:underline"
                      >
                        Open event details
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : events.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
              <History className="h-8 w-8 text-slate-300" />
              <p className="mt-3 text-base font-semibold text-slate-700">No events available</p>
              <p className="mt-1 text-sm text-slate-500">
                This organiser has no events yet, so registrations are unavailable.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <label htmlFor="registration-event-filter" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Filter by event
                </label>
                <select
                  id="registration-event-filter"
                  value={selectedEventId}
                  onChange={(event) => setSelectedEventId(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-[#154CB3] focus:ring-2 focus:ring-[#154CB3]/20"
                >
                    <option value="all">All events in scope</option>
                  {events.map((event) => (
                    <option key={event.event_id} value={event.event_id}>
                      {event.title || "Untitled Event"}
                    </option>
                  ))}
                </select>

                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                    {registrationSummary.total} total
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                    {registrationSummary.individual} individual
                  </span>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
                    {registrationSummary.team} team
                  </span>
                </div>
              </div>

              {filteredRegistrations.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 py-16 text-center">
                  <History className="h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-base font-semibold text-slate-700">No registrations found</p>
                  <p className="mt-1 text-sm text-slate-500">
                    No registrations match the selected event filter.
                  </p>
                </div>
              ) : (
                <>
                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Registrations by Event</p>
                    <div className="mt-3 space-y-2">
                      {registrationsByEvent.map((grouped) => {
                        const organiserTagMeta = getOrganiserTagMeta(grouped.organiserEmail);

                        return (
                          <div key={grouped.eventId} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{grouped.title}</p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {grouped.individual} individual · {grouped.team} team · Latest {formatDate(grouped.latestAt)}
                                </p>
                                <span
                                  title={organiserTagMeta.value}
                                  className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${getOrganiserTagClassName(organiserTagMeta)}`}
                                >
                                  Organizer:
                                  <span className="max-w-[220px] truncate">{getOrganiserTagText(organiserTagMeta)}</span>
                                </span>
                              </div>
                              <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                                {grouped.count}
                              </span>
                            </div>
                            <Link
                              href={`/event/${grouped.eventId}`}
                              className="mt-2 inline-flex items-center text-xs font-semibold text-[#154CB3] hover:underline"
                            >
                              Open event details
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Recent Registrations</p>
                    <div className="mt-3 space-y-2">
                      {filteredRegistrations.slice(0, 20).map((registration) => {
                        const registrationType = normalizeRegistrationType(registration.registration_type);
                        const linkedEvent = eventLookup.get(registration.event_id);
                        const registrantName = getRegistrantName(registration);
                        const registrantEmail = getRegistrantEmail(registration);
                        const teamSize = getTeamSize(registration);
                        const organiserTagMeta = getOrganiserTagMeta(linkedEvent?.created_by);

                        return (
                          <div
                            key={`${registration.registration_id}-${registration.event_id}-${registration.created_at}`}
                            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">{registrantName}</p>
                                <p className="mt-1 truncate text-xs text-slate-500">{registrantEmail || "No email available"}</p>
                                <p className="mt-1 text-[11px] text-slate-500">
                                  {(linkedEvent?.title || "Unknown Event")} · Registered on {formatDate(registration.created_at)}
                                </p>
                                <span
                                  title={organiserTagMeta.value}
                                  className={`mt-1 inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] ${getOrganiserTagClassName(organiserTagMeta)}`}
                                >
                                  Organizer:
                                  <span className="max-w-[220px] truncate">{getOrganiserTagText(organiserTagMeta)}</span>
                                </span>
                              </div>
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                  registrationType === "team"
                                    ? "bg-amber-50 text-amber-700 border border-amber-200"
                                    : "bg-blue-50 text-blue-700 border border-blue-200"
                                }`}
                              >
                                {registrationType === "team" ? `Team (${teamSize})` : "Individual"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
