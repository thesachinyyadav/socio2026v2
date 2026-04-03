"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  useEvents,
  FetchedEvent as ContextEvent,
} from "../../context/EventContext";
import { formatDateFull, formatTime } from "@/lib/dateUtils";
import Link from "next/link";
import { getFests } from "@/lib/api";
import { createBrowserClient } from "@supabase/ssr";
import { toast } from "sonner";
import {
  addThemedChartsSheet,
  addStructuredSummarySheet,
  addStructuredTableSheet,
  createThemedWorkbook,
  downloadWorkbook,
} from "@/lib/xlsxTheme";
import AnimatedListDropdown from "@/app/_components/UI/AnimatedListDropdown";
import {
  Search,
  SlidersHorizontal,
  ArrowRight,
  Calendar,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  History,
  Pencil,
} from "lucide-react";

// ─── TYPES & CONSTANTS ──────────────────────────────────────────────────────
interface Fest {
  fest_id: string;
  fest_title: string;
  description: string;
  opening_date: string;
  closing_date: string;
  fest_image_url: string;
  organizing_dept: string;
  created_by?: string;
  campus_hosted_at?: string | null;
  is_archived?: boolean;
  archived_at?: string | null;
}

const ITEMS_PER_PAGE = 12;

type StatusFilter = "all" | "upcoming" | "past" | "archived";

const FEST_STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
];

const EVENT_STATUS_FILTER_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "archived", label: "Archived" },
];

const AUTO_ARCHIVE_DAYS = 15;
const AUTO_ARCHIVE_MS = AUTO_ARCHIVE_DAYS * 24 * 60 * 60 * 1000;

const CAMPUSES = [
  "Central Campus (Main)",
  "Bannerghatta Road Campus",
  "Yeshwanthpur Campus",
  "Kengeri Campus",
  "Delhi NCR Campus",
  "Pune Lavasa Campus"
];

const ACCREDITATION_BODIES = [
  {
    id: "naac",
    name: "NAAC",
    fullName: "National Assessment and Accreditation Council",
    description: "India's primary accreditation body for higher education institutions.",
    focus: "Governance, teaching learning, research, infrastructure, student support, best practices.",
  },
  {
    id: "nba",
    name: "NBA",
    fullName: "National Board of Accreditation",
    description: "Program level accreditation mainly for engineering and technical courses.",
    focus: "Outcome Based Education, curriculum quality, placements.",
  },
  {
    id: "aacsb",
    name: "AACSB",
    fullName: "Association to Advance Collegiate Schools of Business",
    description: "Global business school accreditation.",
    focus: "Faculty quality, research impact, assurance of learning.",
  },
  {
    id: "acbsp",
    name: "ACBSP",
    fullName: "Accreditation Council for Business Schools and Programs",
    description: "Business program accreditation. More teaching focused than research heavy.",
    focus: "Teaching excellence, student learning outcomes.",
  },
  {
    id: "nirf",
    name: "NIRF",
    fullName: "National Institutional Ranking Framework",
    description: "Not accreditation, but a national ranking framework.",
    focus: "Teaching, research, graduation outcomes, outreach.",
  },
  {
    id: "aicte",
    name: "AICTE",
    fullName: "All India Council for Technical Education",
    description: "Regulatory approval body for technical institutions.",
    focus: "Technical education standards, infrastructure, faculty.",
  },
  {
    id: "ugc",
    name: "UGC",
    fullName: "University Grants Commission",
    description: "Regulatory authority for universities in India.",
    focus: "University standards, grants, governance.",
  },
];


// ─── UI COMPONENTS ────────────────────────────────────────────────────────
interface MappedFestCardProps {
  fest: Fest;
  baseUrl: string;
  isArchiveUpdating?: boolean;
  onArchiveToggle?: (festId: string, shouldArchive: boolean) => void;
}

const MappedFestCard = ({ fest, baseUrl, isArchiveUpdating = false, onArchiveToggle }: MappedFestCardProps) => {
  const isPast = fest.closing_date ? new Date(fest.closing_date) < new Date() : false;
  const isArchived = fest.is_archived ?? false;

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-all duration-300 ${
      isArchived ? "opacity-60 grayscale" : ""
    }`}>
      <div className="h-48 relative bg-slate-100">
        <img
          src={fest.fest_image_url || process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL!}
          alt={fest.fest_title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <span
            className={`px-3 py-1.5 text-[10px] font-bold rounded-full tracking-wider shadow-sm flex items-center ${
              isArchived ? "bg-purple-600 text-white" : isPast ? "bg-[#333333] text-white" : "bg-white text-emerald-600"
            }`}
          >
            {isArchived ? "ARCHIVED" : isPast ? "PAST" : "UPCOMING"}
          </span>
        </div>
      </div>
      <div className="p-5 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 line-clamp-1">
          {fest.organizing_dept || "DEPARTMENT"}
        </p>
        <h3 className="text-xl font-bold text-[#0f2557] mt-1 mb-2 line-clamp-1">
          {fest.fest_title}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2">
          {fest.description || "No description provided. Click manage to add one."}
        </p>
      </div>
      <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Calendar className="w-4 h-4 text-slate-400" />
          {formatDateFull(fest.opening_date, "TBD")}
        </div>
        {isArchived ? (
          <button
            onClick={(e) => {
              e.preventDefault();
              onArchiveToggle?.(fest.fest_id, false);
            }}
            disabled={isArchiveUpdating}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isArchiveUpdating ? "Restoring..." : "Restore"} <History className="w-4 h-4" />
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={(e) => {
                e.preventDefault();
                onArchiveToggle?.(fest.fest_id, true);
              }}
              disabled={isArchiveUpdating}
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isArchiveUpdating ? "Archiving..." : "Archive"} <History className="w-4 h-4" />
            </button>
            <Link href={`/${baseUrl}/${fest.fest_id}`} className="flex items-center gap-1.5 text-[#154cb3] font-semibold text-sm hover:underline">
              Manage <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

type EventArchiveSource = "manual" | "auto" | null;

const MappedEventCard = ({
  event,
  baseUrl,
  isArchived,
  archiveSource,
  onToggleArchive,
  isArchiveActionLoading,
}: {
  event: ContextEvent;
  baseUrl: string;
  isArchived: boolean;
  archiveSource: EventArchiveSource;
  onToggleArchive: (eventId: string, shouldArchive: boolean) => void;
  isArchiveActionLoading: boolean;
}) => {
  const isPast = event.event_date ? new Date(event.event_date) < new Date() : false;
  const statusLabel = isArchived ? "ARCHIVED" : isPast ? "PAST" : "UPCOMING";
  const statusClassName = isArchived
    ? "bg-amber-100 text-amber-800"
    : isPast
      ? "bg-[#333333] text-white"
      : "bg-white text-emerald-600";

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col hover:shadow-md transition-all duration-300 ${
      isArchived ? "opacity-60 grayscale" : ""
    }`}>
      <div className="h-48 relative bg-slate-100">
        <img
          src={event.event_image_url || process.env.NEXT_PUBLIC_EVENT_BANNER_PLACEHOLDER_URL!}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <span className={`px-3 py-1.5 text-[10px] font-bold rounded-full tracking-wider shadow-sm flex items-center ${statusClassName}`}>
            {statusLabel}
          </span>
        </div>
      </div>
      <div className="p-5 flex-1">
        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 line-clamp-1">
          {event.organizing_dept || "DEPARTMENT"}
        </p>
        <h3 className="text-xl font-bold text-[#0f2557] mt-1 mb-2 line-clamp-1">
          {event.title}
        </h3>
        <p className="text-sm text-slate-500 line-clamp-2">
          {(event as any).short_description || (event as any).description || "No description provided."}
        </p>
        {isArchived && archiveSource === "auto" && (
          <p className="text-xs font-semibold text-amber-700 mt-2">
            Auto-archived after {AUTO_ARCHIVE_DAYS} days.
          </p>
        )}
      </div>
      <div className="px-5 py-3.5 border-t border-slate-100 flex justify-between items-center bg-slate-50/50">
        <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
          <Calendar className="w-4 h-4 text-slate-400" />
          {formatDateFull(event.event_date, "TBD")}
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isArchiveActionLoading}
            onClick={() => onToggleArchive(event.event_id, !isArchived)}
            className={`flex items-center gap-1.5 font-semibold text-sm transition-colors cursor-pointer ${
              isArchiveActionLoading
                ? "text-slate-400 cursor-not-allowed"
                : isArchived
                  ? "text-emerald-700 hover:text-emerald-800"
                  : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {isArchiveActionLoading ? "Saving..." : isArchived ? "Unarchive" : "Archive"} <History className="w-4 h-4" />
          </button>
          <Link href={`/${baseUrl}/${event.event_id}`} className="flex items-center gap-1.5 text-[#154cb3] font-semibold text-sm hover:underline">
            Edit <Pencil className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};


// ─── MAIN DASHBOARD COMPONENT ───────────────────────────────────────────────
export default function ManageDashboard() {
  const [activeTab, setActiveTab] = useState<"fests" | "events" | "report">("fests");
  const [searchTerm, setSearchTerm] = useState("");
  const [eventsPage, setEventsPage] = useState(1);
  const [festsPage, setFestsPage] = useState(1);
  const [campusFilter, setCampusFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isStatusFilterOpen, setIsStatusFilterOpen] = useState(false);
  const statusFilterRef = useRef<HTMLDivElement>(null);
  const topOfPageRef = useRef<HTMLDivElement>(null);
  const previousPagesRef = useRef({ eventsPage: 1, festsPage: 1 });
  
  // Auth Context & Session
  const [authToken, setAuthToken] = useState<string | null>(null);
  const { userData, isMasterAdmin } = useAuth();
  
  // Fests Data
  const [fests, setFests] = useState<Fest[]>([]);
  const [isLoadingFests, setIsLoadingFests] = useState(true);
  
  // Events Data
  const { allEvents: contextAllEvents, isLoading: isLoadingContextEvents } = useEvents();

  // Report State
  const [selectedReportFest, setSelectedReportFest] = useState<string>("");
  const [selectedAccreditation, setSelectedAccreditation] = useState<string>("");
  const [reportMode, setReportMode] = useState<"fest" | "events">("fest");
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [searchTermReport, setSearchTermReport] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [archiveOverrides, setArchiveOverrides] = useState<Record<string, { is_archived: boolean; archived_at: string | null }>>({});
  const [archiveUpdatingIds, setArchiveUpdatingIds] = useState<Set<string>>(new Set());
  const [festArchiveOverrides, setFestArchiveOverrides] = useState<Record<string, { is_archived: boolean; archived_at: string | null }>>({});
  const [festArchiveUpdatingIds, setFestArchiveUpdatingIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!statusFilterRef.current?.contains(event.target as Node)) {
        setIsStatusFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeTab === "fests" && statusFilter === "archived") {
      setStatusFilter("all");
    }
  }, [activeTab, statusFilter]);

  // Load Auth Token for Reports
  useEffect(() => {
    const getToken = async () => {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        setAuthToken(session.access_token);
      }
    };
    getToken();
  }, []);

  // Fetch Fests secure logic
  useEffect(() => {
    if (!userData?.email) {
      setIsLoadingFests(false);
      setFests([]);
      return;
    }
    setIsLoadingFests(true);
    getFests()
      .then((data) => {
        const mappedFests: Fest[] = Array.isArray(data) ? data.map((fest: any) => ({
              fest_id: String(fest.fest_id || fest.id || fest.festId || fest.fest_title || fest.title || ""),
              fest_title: fest.fest_title || fest.title || "Untitled",
              description: fest.description || "",
              opening_date: fest.opening_date || null,
              closing_date: fest.closing_date || null,
              fest_image_url: fest.fest_image_url || "",
              organizing_dept: fest.organizing_dept || "",
              created_by: fest.created_by || fest.createdBy || fest.user_email || fest.organiser_email || null,
              campus_hosted_at: fest.campus_hosted_at || fest.campus || null,
        })) : [];

        const userSpecificFests = isMasterAdmin 
          ? mappedFests 
          : mappedFests.filter((fest) => !fest.created_by || fest.created_by === userData.email);

        setFests(userSpecificFests);
      })
      .catch((error) => console.error("Error fetching fests:", error))
      .finally(() => setIsLoadingFests(false));
  }, [userData?.email, isMasterAdmin]);

  // Fetch fresh events from Supabase directly on page load to ensure archive status is current
  // This bypasses the cached events from EventContext to show real-time archive changes
  const [liveEvents, setLiveEvents] = useState<ContextEvent[]>([]);
  const [isLoadingLiveEvents, setIsLoadingLiveEvents] = useState(false);

  useEffect(() => {
    const fetchLiveEvents = async () => {
      try {
        setIsLoadingLiveEvents(true);
        const supabase = createBrowserClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        
        const { data, error } = await supabase
          .from('events')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) {
          console.error("Error fetching live events:", error);
          // Fall back to context events if fetch fails
          setLiveEvents(contextAllEvents);
        } else {
          setLiveEvents(data || []);
        }
      } catch (err) {
        console.error("Error fetching live events:", err);
        // Fall back to context events if fetch fails
        setLiveEvents(contextAllEvents);
      } finally {
        setIsLoadingLiveEvents(false);
      }
    };

    fetchLiveEvents();
  }, []); // Run once on mount to get initial fresh data


  // Permissions & Campus logic for Events
  const getValidDate = (date: string | null | undefined) => {
    if (!date) return null;
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return null;
    return parsedDate;
  };

  const isPastDate = (date: string | null | undefined) => {
    const parsedDate = getValidDate(date);
    if (!parsedDate) return false;
    return parsedDate < new Date();
  };

  const isAutoArchivedEvent = (event: ContextEvent) => {
    const eventDate = getValidDate(event.event_date);
    if (!eventDate) return false;
    return Date.now() - eventDate.getTime() >= AUTO_ARCHIVE_MS;
  };

  const toBoolean = (value: unknown) =>
    value === true || value === 1 || value === "1" || value === "true";

  const getEffectiveArchiveState = (event: ContextEvent): { isArchived: boolean; archiveSource: EventArchiveSource } => {
    const override = archiveOverrides[event.event_id];
    const manualArchived = override
      ? override.is_archived
      : toBoolean(event.is_archived);
    const autoArchived = isAutoArchivedEvent(event);

    if (manualArchived) {
      return { isArchived: true, archiveSource: "manual" };
    }

    if (autoArchived) {
      return { isArchived: true, archiveSource: "auto" };
    }

    return { isArchived: false, archiveSource: null };
  };

  const matchesStatus = (isPast: boolean, isArchived: boolean) => {
    if (statusFilter === "all") return !isArchived;
    if (statusFilter === "archived") return isArchived;
    if (statusFilter === "past") return !isArchived && isPast;
    return !isArchived && !isPast;
  };

  const userSpecificContextEvents = (liveEvents.length > 0 ? liveEvents : contextAllEvents as ContextEvent[]).filter((e) => {
    const isOwnerOrMaster = isMasterAdmin || (userData?.email && e.created_by === userData.email);
    const matchesCampus = campusFilter === "all" || (e as any).campus_hosted_at === campusFilter;
    const eventIsPast = isPastDate(e.event_date);
    const archiveState = getEffectiveArchiveState(e);
    return isOwnerOrMaster && matchesCampus && matchesStatus(eventIsPast, archiveState.isArchived);
  });

  // Filter Grids
  const searchedUserEvents = userSpecificContextEvents.filter((event) =>
    event.title.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const searchedUserFests = fests.filter((fest) => {
    if (statusFilter === "archived") return false;
    const matchesSearch = fest.fest_title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCampus = campusFilter === "all" || (fest as any).campus_hosted_at === campusFilter;
    const festIsPast = isPastDate(fest.closing_date);
    return matchesSearch && matchesCampus && matchesStatus(festIsPast, false);
  });

  const activeStatusFilterOptions =
    activeTab === "events" ? EVENT_STATUS_FILTER_OPTIONS : FEST_STATUS_FILTER_OPTIONS;

  const selectedStatusLabel =
    activeStatusFilterOptions.find((option) => option.value === statusFilter)?.label || "All";

  // Pagination Helper
  const paginateArray = <T,>(array: T[], page: number) => {
    const startIndex = (page - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return {
      items: array.slice(startIndex, endIndex),
      totalPages: Math.ceil(array.length / ITEMS_PER_PAGE),
      hasNext: endIndex < array.length,
      hasPrev: page > 1,
    };
  };

  const paginatedFests = paginateArray(searchedUserFests, festsPage);
  const paginatedEvents = paginateArray(searchedUserEvents, eventsPage);

  const scrollToTop = () => {
    const performScroll = () => {
      topOfPageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.documentElement.scrollTo({ top: 0, behavior: "smooth" });
      document.body.scrollTo({ top: 0, behavior: "smooth" });
    };

    requestAnimationFrame(performScroll);
    setTimeout(performScroll, 0);
  };

  useEffect(() => {
    const prev = previousPagesRef.current;
    const pageChanged = prev.eventsPage !== eventsPage || prev.festsPage !== festsPage;

    if (pageChanged) {
      scrollToTop();
    }

    previousPagesRef.current = { eventsPage, festsPage };
  }, [eventsPage, festsPage]);

  // Helper function to refresh live events from Supabase
  const refreshLiveEvents = async () => {
    try {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error("Error refreshing live events:", error);
      } else {
        setLiveEvents(data || []);
      }
    } catch (err) {
      console.error("Error refreshing live events:", err);
    }
  };

  // ─── REPORT GENERATION HANDLER ────────────────────────
  const handleGenerateReport = async () => {
    setIsGenerating(true);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${API_URL}/api/report/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          eventIds: Array.from(selectedEventIds),
          festId: reportMode === "fest" ? selectedReportFest : null,
        }),
      });

      if (!response.ok) throw new Error("Failed to fetch report data");

      const data = await response.json();

      const workbook = createThemedWorkbook("SOCIO - Christ University");
      const accBody = ACCREDITATION_BODIES.find((body) => body.id === selectedAccreditation);
      const reportEvents = Array.isArray(data.events) ? data.events : [];
      const totalRegs = reportEvents.reduce(
        (sum: number, event: any) => sum + Number(event.total_registrations ?? 0),
        0
      );
      const totalParticipants = reportEvents.reduce(
        (sum: number, event: any) => sum + Number(event.total_participants ?? 0),
        0
      );
      const totalAttended = reportEvents.reduce(
        (sum: number, event: any) => sum + Number(event.attended_count ?? 0),
        0
      );

      addStructuredSummarySheet(workbook, {
        title: "Accreditation Report Export",
        subtitle: "Consistent SOCIO workbook structure with sectioned metadata, filters, and KPIs.",
        sections: [
          {
            title: "Report Metadata",
            rows: [
              { label: "Institution", value: "Christ University" },
              {
                label: "Accreditation Body",
                value: accBody ? `${accBody.name} - ${accBody.fullName}` : "Not selected",
              },
              { label: "Generated On", value: new Date().toLocaleString("en-GB") },
              { label: "Generated By", value: String(data.generated_by ?? "-") },
            ],
          },
          {
            title: "Report Filters",
            rows: [
              { label: "Report Type", value: reportMode === "fest" ? "Fest-based" : "Event-based" },
              { label: "Fest", value: data.fest?.fest_title ?? "All selected events" },
              { label: "Selected Events", value: reportEvents.length },
            ],
          },
          {
            title: "KPI Snapshot",
            rows: [
              { label: "Total Registrations", value: totalRegs },
              { label: "Total Participants", value: totalParticipants },
              { label: "Total Attended", value: totalAttended },
              {
                label: "Attendance Rate",
                value:
                  totalParticipants > 0
                    ? `${((totalAttended / totalParticipants) * 100).toFixed(1)}%`
                    : "N/A",
              },
            ],
          },
        ],
      });

      type EventReportRow = {
        event_id: string;
        title: string;
        date: string;
        venue: string;
        dept: string;
        category: string;
        fee: number;
        regs: number;
        participants: number;
        attended: number;
        absent: number;
      };

      const eventRows: EventReportRow[] = reportEvents.map((event: any) => ({
        event_id: String(event.event_id ?? "-"),
        title: String(event.title ?? "Untitled Event"),
        date: String(event.event_date ?? "N/A"),
        venue: String(event.venue ?? "TBD"),
        dept: String(event.organizing_dept ?? "N/A"),
        category: String(event.category ?? "N/A"),
        fee: Number(event.registration_fee ?? 0) || 0,
        regs: Number(event.total_registrations ?? 0) || 0,
        participants: Number(event.total_participants ?? 0) || 0,
        attended: Number(event.attended_count ?? 0) || 0,
        absent: Number(event.absent_count ?? 0) || 0,
      }));

      addStructuredTableSheet(workbook, {
        sheetName: "Event List",
        columns: [
          { header: "Event ID", key: "event_id", width: 22 },
          { header: "Title", key: "title", width: 35 },
          { header: "Date", key: "date", width: 14, horizontal: "center" },
          { header: "Venue", key: "venue", width: 22 },
          { header: "Department", key: "dept", width: 22 },
          { header: "Category", key: "category", width: 16 },
          { header: "Fee", key: "fee", width: 12, kind: "currency" },
          { header: "Registrations", key: "regs", width: 14, kind: "number" },
          { header: "Participants", key: "participants", width: 14, kind: "number" },
          { header: "Attended", key: "attended", width: 12, kind: "number" },
          { header: "Absent", key: "absent", width: 12, kind: "number" },
        ],
        rows: eventRows,
      });

      type ParticipantReportRow = {
        name: string;
        reg_num: string;
        email: string;
        event: string;
        status: string;
        attended_at: string;
      };

      const participantRows: ParticipantReportRow[] = reportEvents.flatMap((event: any) => {
        const participants = Array.isArray(event.participants) ? event.participants : [];
        return participants.map((participant: any) => ({
          name: String(participant.name ?? "-"),
          reg_num: String(participant.register_number ?? "-"),
          email: String(participant.email ?? ""),
          event: String(event.title ?? "Untitled Event"),
          status: String(participant.status ?? "unmarked"),
          attended_at: participant.attended_at
            ? new Date(participant.attended_at).toLocaleString("en-GB")
            : "",
        }));
      });

      addStructuredTableSheet(workbook, {
        sheetName: "Participant Details",
        columns: [
          { header: "Participant Name", key: "name", width: 28 },
          { header: "Register Number", key: "reg_num", width: 16, horizontal: "center" },
          { header: "Email", key: "email", width: 32, kind: "email" },
          { header: "Event", key: "event", width: 34 },
          { header: "Status", key: "status", width: 12, kind: "status" },
          { header: "Attended At", key: "attended_at", width: 22 },
        ],
        rows: participantRows,
      });

      const deptChartData = Object.entries(
        eventRows.reduce<Record<string, number>>((acc, row) => {
          const dept = row.dept || "Unknown";
          acc[dept] = (acc[dept] || 0) + row.regs;
          return acc;
        }, {})
      )
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      const attendanceChartData = [
        {
          label: "Attended",
          value: participantRows.filter((row) => row.status.toLowerCase() === "attended").length,
        },
        {
          label: "Absent",
          value: participantRows.filter((row) => row.status.toLowerCase() === "absent").length,
        },
        {
          label: "Pending",
          value: participantRows.filter((row) => row.status.toLowerCase() === "pending").length,
        },
        {
          label: "Unmarked",
          value: participantRows.filter((row) => row.status.toLowerCase() === "unmarked").length,
        },
      ];

      addThemedChartsSheet(workbook, {
        title: "Report Visual Overview",
        subtitle: "Embedded chart snapshots for fast review.",
        primaryChart: {
          title: "Registrations by Department",
          type: "bar",
          data: deptChartData,
        },
        secondaryChart: {
          title: "Participant Attendance Mix",
          type: "donut",
          data: attendanceChartData,
        },
      });

      const filename = reportMode === "fest" && data.fest
        ? `report_${data.fest.fest_id}_${new Date().toISOString().split("T")[0]}.xlsx`
        : `report_events_${new Date().toISOString().split("T")[0]}.xlsx`;
      await downloadWorkbook(workbook, filename);
      
      toast.success("Report generated successfully!");
    } catch (error) {
      console.error("Error generating report:", error);
      toast.error("Failed to generate report");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggleArchive = async (eventId: string, shouldArchive: boolean) => {
    if (!authToken) {
      toast.error("Please sign in again to update archive status.");
      return;
    }

    setArchiveUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(eventId);
      return next;
    });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${apiUrl}/api/events/${eventId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ archive: shouldArchive }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update archive status.");
      }

      const event = payload?.event as Partial<ContextEvent> | undefined;
      setArchiveOverrides((prev) => ({
        ...prev,
        [eventId]: {
          is_archived: Boolean(event?.is_archived ?? shouldArchive),
          archived_at:
            typeof event?.archived_at === "string"
              ? event.archived_at
              : shouldArchive
                ? new Date().toISOString()
                : null,
        },
      }));

      toast.success(shouldArchive ? "Event archived successfully." : "Event moved back to active list.");
      
      // Refresh live events to reflect the latest archive status
      await refreshLiveEvents();
    } catch (error: any) {
      console.error("Archive update failed:", error);
      toast.error(error?.message || "Unable to update archive status.");
    } finally {
      setArchiveUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(eventId);
        return next;
      });
    }
  };

  const handleToggleArchiveFest = async (festId: string, shouldArchive: boolean) => {
    if (!authToken) {
      toast.error("Please sign in again to update archive status.");
      return;
    }

    setFestArchiveUpdatingIds((prev) => {
      const next = new Set(prev);
      next.add(festId);
      return next;
    });

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL!;
      const response = await fetch(`${apiUrl}/api/fests/${festId}/archive`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ archive: shouldArchive }),
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(payload?.error || "Failed to update fest archive status.");
      }

      // Update fest archive state
      setFestArchiveOverrides((prev) => ({
        ...prev,
        [festId]: {
          is_archived: Boolean(shouldArchive),
          archived_at: shouldArchive ? new Date().toISOString() : null,
        },
      }));

      // Also update all events under this fest
      const nowIso = new Date().toISOString();
      setArchiveOverrides((prev) => {
        const updated = { ...prev };
        // Find all events with this fest_id and update them
        const eventsToCheck = liveEvents.length > 0 ? liveEvents : contextAllEvents;
        eventsToCheck?.forEach((event) => {
          if (event.fest === festId) {
            updated[event.event_id] = {
              is_archived: Boolean(shouldArchive),
              archived_at: shouldArchive ? nowIso : null,
            };
          }
        });
        return updated;
      });

      const eventsAffected = payload?.events_affected || 0;
      toast.success(
        shouldArchive
          ? `Fest and ${eventsAffected} events archived successfully.`
          : "Fest and associated events moved back to active list."
      );

      // Refresh live events to reflect the latest archive status for all events under this fest
      await refreshLiveEvents();
    } catch (error: any) {
      console.error("Fest archive update failed:", error);
      toast.error(error?.message || "Unable to update fest archive status.");
    } finally {
      setFestArchiveUpdatingIds((prev) => {
        const next = new Set(prev);
        next.delete(festId);
        return next;
      });
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <div ref={topOfPageRef} />
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 1. Page Header & Primary Actions */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-8">
          <h1 className="text-3xl font-extrabold text-[#0f2557] tracking-tight">
            Manage Fests & Events
          </h1>

          <div className="flex items-center gap-3">
            <Link href="/create/fest">
                <button className="flex items-center gap-2 px-4 py-2.5 bg-white text-[#154cb3] font-semibold border-2 border-[#154cb3] rounded-full hover:bg-blue-50 transition-colors shadow-sm text-sm">
                <Plus className="w-4 h-4" /> Create Fest
                </button>
            </Link>
            <Link href="/create/event">
                <button className="flex items-center gap-2 px-4 py-2.5 bg-[#154cb3] text-white font-semibold rounded-full hover:bg-[#124099] transition-colors shadow-sm border-2 border-[#154cb3] text-sm">
                <Plus className="w-4 h-4" /> Create Event
                </button>
            </Link>
          </div>
        </div>

        {/* 2. The Control Bar (Tabs & Search) */}
        <div className="flex flex-col md:flex-row justify-between md:items-center border-b border-slate-200 gap-4 mb-6">
          <div className="flex items-center gap-8 overflow-x-auto overflow-y-hidden pb-2 text-sm w-full md:w-auto [&::-webkit-scrollbar]:hidden [-moz-scrollbar-width:none]">
            <button
              onClick={() => setActiveTab("fests")}
              className={`pb-4 transition-colors whitespace-nowrap -mb-[1px] cursor-pointer ${
                activeTab === "fests"
                  ? "text-[#154cb3] font-bold border-b-[3px] border-[#154cb3]"
                  : "text-slate-500 font-medium hover:text-slate-800 border-b-[3px] border-transparent"
              }`}
            >
              Your fests ({searchedUserFests.length})
            </button>
            <button
              onClick={() => setActiveTab("events")}
              className={`pb-4 transition-colors whitespace-nowrap -mb-[1px] cursor-pointer ${
                activeTab === "events"
                  ? "text-[#154cb3] font-bold border-b-[3px] border-[#154cb3]"
                  : "text-slate-500 font-medium hover:text-slate-800 border-b-[3px] border-transparent"
              }`}
            >
              Your events ({searchedUserEvents.length})
            </button>
            <button
              onClick={() => setActiveTab("report")}
              className={`pb-4 transition-colors whitespace-nowrap -mb-[1px] cursor-pointer ${
                activeTab === "report"
                  ? "text-[#154cb3] font-bold border-b-[3px] border-[#154cb3]"
                  : "text-slate-500 font-medium hover:text-slate-800 border-b-[3px] border-transparent"
              }`}
            >
              Report
            </button>
          </div>

          {(activeTab === "fests" || activeTab === "events") && (
            <div className="flex items-center gap-3 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 bg-white rounded-lg border border-slate-200 shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-[#154cb3]/20 focus:border-[#154cb3] transition-all placeholder:text-slate-400 text-slate-800"
                />
              </div>
              <div className="relative" ref={statusFilterRef}>
                <button
                  type="button"
                  onClick={() => setIsStatusFilterOpen((prev) => !prev)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors shadow-sm text-sm font-semibold cursor-pointer"
                >
                  <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                  Filter: {selectedStatusLabel}
                  <ChevronDown
                    className={`w-4 h-4 text-slate-500 transition-transform ${
                      isStatusFilterOpen ? "rotate-180" : "rotate-0"
                    }`}
                  />
                </button>

                {isStatusFilterOpen && (
                  <div className="absolute top-full left-0 mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-lg z-30 overflow-hidden">
                    {activeStatusFilterOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => {
                          setStatusFilter(option.value);
                          setIsStatusFilterOpen(false);
                        }}
                        className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                          statusFilter === option.value
                            ? "bg-blue-50 text-[#154cb3] font-semibold"
                            : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <AnimatedListDropdown
                value={campusFilter}
                onChange={setCampusFilter}
                options={[
                  { value: "all", label: "All Campuses" },
                  ...CAMPUSES.map((campus) => ({ value: campus, label: campus })),
                ]}
                placeholder="All Campuses"
                className="w-full sm:w-64"
                triggerClassName="shadow-sm font-semibold border-slate-200 cursor-pointer"
              />
            </div>
          )}
        </div>

        {/* 3. Data Grids */}
        {activeTab === "fests" && (
            <>
              {isLoadingFests ? (
                <div className="text-center text-slate-500 py-10 text-sm font-medium animate-pulse">Loading Your Fests...</div>
              ) : paginatedFests.items.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm font-medium">No results found.</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedFests.items.map((fest) => {
                      const archiveOverride = festArchiveOverrides[fest.fest_id];
                      const festWithOverride = archiveOverride
                        ? { ...fest, ...archiveOverride }
                        : fest;
                      return (
                        <MappedFestCard
                          key={fest.fest_id}
                          fest={festWithOverride}
                          baseUrl="edit/fest"
                          isArchiveUpdating={festArchiveUpdatingIds.has(fest.fest_id)}
                          onArchiveToggle={handleToggleArchiveFest}
                        />
                      );
                    })}
                </div>
              )}
            </>
        )}

        {activeTab === "events" && (
            <>
              {isLoadingContextEvents ? (
                <div className="text-center text-slate-500 py-10 text-sm font-medium animate-pulse">Loading Your Events...</div>
              ) : paginatedEvents.items.length === 0 ? (
                <div className="text-center text-slate-500 py-10 text-sm font-medium">
                  {statusFilter === "archived"
                    ? `No archived events found. Events auto-archive after ${AUTO_ARCHIVE_DAYS} days.`
                    : "No results found."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {paginatedEvents.items.map((event) => {
                        const archiveState = getEffectiveArchiveState(event);
                        return (
                          <MappedEventCard
                            key={event.event_id}
                            event={event}
                            baseUrl="edit/event"
                            isArchived={archiveState.isArchived}
                            archiveSource={archiveState.archiveSource}
                            onToggleArchive={handleToggleArchive}
                            isArchiveActionLoading={archiveUpdatingIds.has(event.event_id)}
                          />
                        );
                    })}
                </div>
              )}
            </>
        )}

        {/* 4. Report Engine */}
        {activeTab === "report" && (
            <div className="space-y-6 max-w-4xl">
              {/* Mode Toggle */}
              <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                <h2 className="text-lg font-bold text-[#0f2557] mb-3">Report Scope</h2>
                <div className="flex gap-3">
                  <button
                    onClick={() => { setReportMode("fest"); setSelectedEventIds(new Set()); setSearchTermReport(""); }}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      reportMode === "fest" ? "bg-[#154cb3] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    By Complete Fest
                  </button>
                  <button
                    onClick={() => { setReportMode("events"); setSelectedEventIds(new Set()); setSelectedReportFest(""); setSearchTermReport(""); }}
                    className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                      reportMode === "events" ? "bg-[#154cb3] text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    By Independent Events
                  </button>
                </div>
              </div>

              {/* Fest Mode Logic */}
              {reportMode === "fest" && (
                <>
                  <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-6">
                    <h2 className="text-sm font-bold text-slate-800 mb-1">Select Fest Context</h2>
                    <p className="text-xs text-slate-500 mb-4">Choose a fest to generate a comprehensive report of all its combined events.</p>
                    <AnimatedListDropdown
                      value={selectedReportFest}
                      onChange={(nextValue) => {
                        setSelectedReportFest(nextValue);
                        setSelectedEventIds(new Set());
                      }}
                      options={[
                        { value: "", label: "-- Dropdown Selection --" },
                        ...fests.map((fest) => ({ value: fest.fest_id, label: fest.fest_title })),
                      ]}
                      placeholder="-- Dropdown Selection --"
                      className="w-full md:w-1/2"
                    />
                  </div>

                  {selectedReportFest && (() => {
                    const selectedFestObj = fests.find(f => f.fest_id === selectedReportFest);
                    const eventsToFilter = liveEvents.length > 0 ? liveEvents : contextAllEvents;
                    const festEvents = eventsToFilter.filter((event) => {
                      const matchesByFestId =
                        Boolean(selectedFestObj?.fest_id) &&
                        String((event as any).fest_id || "") === String(selectedFestObj?.fest_id || "");

                      const matchesByFestTitle =
                        String(event.fest || "").toLowerCase() ===
                        String(selectedFestObj?.fest_title || "").toLowerCase();

                      return matchesByFestId || matchesByFestTitle;
                    });
                    if (festEvents.length === 0) {
                      return <div className="p-6 bg-white border border-slate-200 rounded-xl text-slate-500 text-sm">No specific events have been organized under this fest umbrella yet.</div>;
                    }
                    return (
                      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-bold text-slate-800">Available Fest Events ({festEvents.length})</h2>
                          <button
                            onClick={() => {
                              if (selectedEventIds.size === festEvents.length) setSelectedEventIds(new Set());
                              else setSelectedEventIds(new Set(festEvents.map(e => e.event_id)));
                            }}
                            className="text-xs text-[#154cb3] font-semibold hover:underline"
                          >
                            {selectedEventIds.size === festEvents.length ? "Deselect All" : "Quick Select All"}
                          </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                          {festEvents.map(event => (
                            <label key={event.event_id} className="flex items-start gap-3 p-3 border border-slate-100 bg-slate-50/50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedEventIds.has(event.event_id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedEventIds);
                                  e.target.checked ? newSet.add(event.event_id) : newSet.delete(event.event_id);
                                  setSelectedEventIds(newSet);
                                }}
                                className="mt-0.5 h-4 w-4 text-[#154cb3] border-slate-300 rounded cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">{event.title}</p>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase mt-0.5">{event.organizing_dept} ΓÇó {formatDateFull(event.event_date, "TBD")}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}

              {/* Events Mode Logic */}
              {reportMode === "events" && (() => {
                const eventsForReport = liveEvents.length > 0 ? liveEvents : contextAllEvents;
                const userEvents = isMasterAdmin ? eventsForReport : eventsForReport.filter(e => e.created_by === userData?.email);
                const filteredEvents = userEvents.filter(e => 
                  e.title.toLowerCase().includes(searchTermReport.toLowerCase()) ||
                  (e.organizing_dept || "").toLowerCase().includes(searchTermReport.toLowerCase())
                );
                return (
                  <>
                    <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-6">
                      <h2 className="text-sm font-bold text-slate-800 mb-2">Search Event Targets</h2>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          placeholder="Search individual events..."
                          value={searchTermReport}
                          onChange={(e) => setSearchTermReport(e.target.value)}
                          className="w-full md:w-2/3 pl-9 pr-4 py-2 border border-slate-300 rounded-lg bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#154cb3]/30"
                        />
                      </div>
                    </div>

                    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                          <h2 className="text-sm font-bold text-slate-800">Your Target Events ({filteredEvents.length})</h2>
                          <button
                            onClick={() => {
                              if (selectedEventIds.size === filteredEvents.length) setSelectedEventIds(new Set());
                              else setSelectedEventIds(new Set(filteredEvents.map(e => e.event_id)));
                            }}
                            className="text-xs text-[#154cb3] font-semibold hover:underline"
                          >
                            {selectedEventIds.size === filteredEvents.length ? "Clear Targets" : "Select Entire View"}
                          </button>
                        </div>
                        <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
                          {filteredEvents.map(event => (
                            <label key={event.event_id} className="flex items-center gap-3 p-3 border border-slate-100 bg-slate-50/50 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors">
                              <input
                                type="checkbox"
                                checked={selectedEventIds.has(event.event_id)}
                                onChange={(e) => {
                                  const newSet = new Set(selectedEventIds);
                                  e.target.checked ? newSet.add(event.event_id) : newSet.delete(event.event_id);
                                  setSelectedEventIds(newSet);
                                }}
                                className="h-4 w-4 text-[#154cb3] border-slate-300 rounded cursor-pointer"
                              />
                              <div className="flex-1">
                                <p className="text-sm font-bold text-slate-800">{event.title}</p>
                                <p className="text-[11px] font-semibold text-slate-500 uppercase mt-0.5">{event.organizing_dept} ΓÇó {formatDateFull(event.event_date, "TBD")} ΓÇó {event.fest || "No Parent Fest"}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                    </div>
                  </>
                );
              })()}

              {/* Accreditation Select */}
              {selectedEventIds.size > 0 && (
                <div className="bg-slate-100/50 border border-slate-200 rounded-xl p-6">
                  <h2 className="text-sm font-bold text-slate-800 mb-1">Accreditation Template Standard</h2>
                  <p className="text-xs text-slate-500 mb-4">This defines the formal schema embedded inside the exported document.</p>
                  <AnimatedListDropdown
                    value={selectedAccreditation}
                    onChange={setSelectedAccreditation}
                    options={[
                      { value: "", label: "-- Blank Document / Custom --" },
                      ...ACCREDITATION_BODIES.map((body) => ({
                        value: body.id,
                        label: `${body.name} Formats - ${body.fullName}`,
                      })),
                    ]}
                    placeholder="-- Blank Document / Custom --"
                    className="w-full md:w-1/2"
                  />
                </div>
              )}

              {/* Action */}
              {selectedEventIds.size > 0 && selectedAccreditation && (
                <div className="pt-2">
                  <button
                    disabled={isGenerating}
                    onClick={handleGenerateReport}
                    className={`flex items-center gap-2 px-6 py-3 bg-[#154cb3] text-white text-sm font-bold rounded-lg shadow-md hover:bg-[#124099] transition-all ${isGenerating ? "opacity-50 cursor-wait" : ""}`}
                  >
                    {isGenerating ? "Generating Analytics..." : "Generate Master Sheet"} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
        )}

        {/* 5. Pagination */}
        {(activeTab === "fests" || activeTab === "events") && (
          <div className="mt-10 flex justify-center items-center gap-1.5 pb-8">
            <button
              onClick={() => activeTab === "fests" ? setFestsPage(p => p - 1) : setEventsPage(p => p - 1)}
              disabled={activeTab === "fests" ? !paginatedFests.hasPrev : !paginatedEvents.hasPrev}
              className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-semibold text-slate-500 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <div className="px-4 py-2 rounded-md font-semibold text-sm text-slate-600">
              Page {activeTab === "fests" ? festsPage : eventsPage} of {activeTab === "fests" ? (paginatedFests.totalPages || 1) : (paginatedEvents.totalPages || 1)}
            </div>
            <button
              onClick={() => {
                if (activeTab === "fests") {
                  setFestsPage((p) => p + 1);
                } else {
                  setEventsPage((p) => p + 1);
                }
                scrollToTop();
              }}
              disabled={activeTab === "fests" ? !paginatedFests.hasNext : !paginatedEvents.hasNext}
              className="flex items-center gap-1 px-3 py-2 rounded-md text-sm font-semibold text-[#154cb3] hover:bg-blue-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}

      </main>
    </div>
  );
}
