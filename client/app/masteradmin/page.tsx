"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { useRouter, useSearchParams } from "next/navigation";
import supabase from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { useDebounce } from "@/lib/hooks/useDebounce";
import {
  addThemedChartsSheet,
  addStructuredSummarySheet,
  addStructuredTableSheet,
  createThemedWorkbook,
  downloadWorkbook,
} from "@/lib/xlsxTheme";
import DateTimePickerAdmin from "../_components/DateTimePickerAdmin";
import dynamic from "next/dynamic";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Trophy,
  Bell,
  BarChart2,
  LineChart,
  Settings,
  Eye,
  ChevronRight,
  CheckCircle2,
  Building2,
  ShieldCheck,
  MapPin,
  Trash2,
  PlusCircle,
  Pencil,
  UtensilsCrossed,
} from "lucide-react";
import {
  organizingSchools,
  getDepartmentOptionsForSchool,
  christCampuses,
} from "@/app/lib/eventFormSchema";
import AdminDashboardView from "../_components/Admin/AdminDashboardView";
import ApprovalsManager from "../_components/Admin/ApprovalsManager";
import { deleteClub, ClubRecord } from "@/app/actions/clubs";

const API_URL = process.env.NEXT_PUBLIC_API_URL!.replace(/\/api\/?$/, "");
const ITEMS_PER_PAGE = 20;

const AnalyticsDashboard = dynamic(
  () => import("../_components/Admin/AnalyticsDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600">Loading analytics...</div>
      </div>
    ),
  }
);

const AdminNotifications = dynamic(
  () => import("../_components/Admin/AdminNotifications"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 text-center">
        <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600">Loading notifications...</div>
      </div>
    ),
  }
);

const DataExplorerDashboard = dynamic(
  () => import("../_components/Admin/DataExplorerDashboard"),
  {
    ssr: false,
    loading: () => (
      <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl">
        <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <div className="text-gray-600">Loading data explorer...</div>
      </div>
    ),
  }
);

type User = {
  id: number;
  email: string;
  name: string;
  is_organiser: boolean;
  organiser_expires_at?: string | null;
  is_support: boolean;
  support_expires_at?: string | null;
  is_masteradmin: boolean;
  masteradmin_expires_at?: string | null;
  created_at: string;
  course?: string | null;
  register_number?: number | null;
  // Approval workflow roles
  is_hod?: boolean;
  is_dean?: boolean;
  is_cfo?: boolean;
  is_campus_director?: boolean;
  is_accounts_office?: boolean;
  school?: string | null;
  department?: string | null;
  campus?: string | null;
};

type Event = {
  event_id: string;
  title: string;
  organizing_dept: string;
  event_date: string;
  end_date?: string | null;
  created_by: string;
  created_at: string;
  registration_fee: number;
  registration_count?: number;
  fest?: string | null;
  is_archived?: boolean | null;
  is_draft?: boolean | null;
  archived_at?: string | null;
  archived_by?: string | null;
  archived_effective?: boolean | null;
  archive_source?: "manual" | "auto" | null;
};

type Fest = {
  fest_id: string;
  fest_title: string;
  organizing_dept: string;
  opening_date: string;
  closing_date?: string | null;
  created_by: string;
  created_at: string;
  registration_count?: number;
  is_archived?: boolean | null;
  archived_at?: string | null;
  archived_by?: string | null;
};

type Registration = {
  registration_id: string;
  event_id: string;
  user_email?: string;
  registration_type: string;
  created_at: string;
  individual_name?: string;
  team_leader_name?: string;
  individual_email?: string;
  team_leader_email?: string;
  individual_register_number?: string | number;
  team_leader_register_number?: string | number;
  participant_organization?: string;
  teammates?: any[];
};

type PaginationState = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
};

const createDefaultPagination = (page = 1): PaginationState => ({
  page,
  pageSize: ITEMS_PER_PAGE,
  totalItems: 0,
  totalPages: 1,
  hasNext: false,
  hasPrev: page > 1,
});

const ACCREDITATION_BODIES = [
  { id: "naac", name: "NAAC", fullName: "National Assessment and Accreditation Council", description: "India's primary accreditation body for higher education institutions.", focus: "Governance, teaching learning, research, infrastructure, student support, best practices." },
  { id: "nba", name: "NBA", fullName: "National Board of Accreditation", description: "Program level accreditation mainly for engineering and technical courses.", focus: "Outcome Based Education, curriculum quality, placements." },
  { id: "aacsb", name: "AACSB", fullName: "Association to Advance Collegiate Schools of Business", description: "Global business school accreditation.", focus: "Faculty quality, research impact, assurance of learning." },
  { id: "acbsp", name: "ACBSP", fullName: "Accreditation Council for Business Schools and Programs", description: "Business program accreditation. More teaching focused than research heavy.", focus: "Teaching excellence, student learning outcomes." },
  { id: "nirf", name: "NIRF", fullName: "National Institutional Ranking Framework", description: "Not accreditation, but a national ranking framework.", focus: "Teaching, research, graduation outcomes, outreach." },
  { id: "aicte", name: "AICTE", fullName: "All India Council for Technical Education", description: "Regulatory approval body for technical institutions.", focus: "Technical education standards, infrastructure, faculty." },
  { id: "ugc", name: "UGC", fullName: "University Grants Commission", description: "Regulatory authority for universities in India.", focus: "University standards, grants, governance." },
];

export default function MasterAdminPage() {
  const { userData, isMasterAdmin, isLoading: authLoading, session } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  type AdminTab = "dashboard" | "insights" | "dataExplorer" | "users" | "events" | "fests" | "clubs" | "approvals" | "notifications" | "report" | "settings" | "roles" | "venues" | "caterers";
  const activeTab = (searchParams.get("tab") as AdminTab) || "dashboard";
  const setActiveTab = (tab: AdminTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`?${params.toString()}`);
  };
  const authToken = session?.access_token || null;

  // Helper to get a fresh access token (avoids stale token from session state)
  const getFreshToken = async (): Promise<string | null> => {
    try {
      const { data: { session: freshSession } } = await supabase.auth.getSession();
      return freshSession?.access_token || authToken;
    } catch {
      return authToken;
    }
  };
  
  // User management state
  const [users, setUsers] = useState<User[]>([]);
  const [userPagination, setUserPagination] = useState<PaginationState>(createDefaultPagination());
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [editingUserRoles, setEditingUserRoles] = useState<Partial<User>>({});

  // Roles tab state
  const [roleEmailInput, setRoleEmailInput] = useState("");
  const [roleEmailSuggestions, setRoleEmailSuggestions] = useState<{ email: string; name: string }[]>([]);
  const [roleSelectedEmail, setRoleSelectedEmail] = useState("");
  const [roleSelectedRole, setRoleSelectedRole] = useState<"hod" | "dean" | "cfo" | "director" | "accounts" | "">("");
  const [roleSchool, setRoleSchool] = useState("");
  const [roleDept, setRoleDept] = useState("");
  const [roleCampus, setRoleCampus] = useState("");
  const [roleSaving, setRoleSaving] = useState(false);
  // Role list view
  const [roleHolders, setRoleHolders] = useState<User[]>([]);
  const [roleHoldersLoading, setRoleHoldersLoading] = useState(false);
  const [roleListRoleFilter, setRoleListRoleFilter] = useState("all");
  const [roleListDeptFilter, setRoleListDeptFilter] = useState("");
  const [roleListSchoolFilter, setRoleListSchoolFilter] = useState("");
  const [roleListCampusFilter, setRoleListCampusFilter] = useState("");
  const [roleListSearch, setRoleListSearch] = useState("");
  const [roleRemoving, setRoleRemoving] = useState<string | null>(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState<string | null>(null);
  const [userPage, setUserPage] = useState(1);
  
  // Event management state
  const [events, setEvents] = useState<Event[]>([]);
  const [eventPagination, setEventPagination] = useState<PaginationState>(createDefaultPagination());
  const [eventSearchQuery, setEventSearchQuery] = useState("");
  const [showDeleteEventConfirm, setShowDeleteEventConfirm] = useState<string | null>(null);
  const [selectedEventForBookings, setSelectedEventForBookings] = useState<Event | null>(null);
  const [eventBookings, setEventBookings] = useState<Registration[]>([]);
  const [eventBookingsLoading, setEventBookingsLoading] = useState(false);
  const [eventPage, setEventPage] = useState(1);
  const [eventStatusFilter, setEventStatusFilter] = useState<"all" | "live" | "upcoming" | "thisweek" | "past">("all");
  const [eventSortKey, setEventSortKey] = useState<"title" | "date" | "registrations" | "dept">("date");
  const [eventSortDir, setEventSortDir] = useState<"asc" | "desc">("desc");
  
  // User sort state
  const [userSortKey, setUserSortKey] = useState<"name" | "email" | "date">("date");
  const [userSortDir, setUserSortDir] = useState<"asc" | "desc">("desc");

  // Fest management state
  const [fests, setFests] = useState<Fest[]>([]);
  const [festPagination, setFestPagination] = useState<PaginationState>(createDefaultPagination());
  const [festSearchQuery, setFestSearchQuery] = useState("");
  const [showDeleteFestConfirm, setShowDeleteFestConfirm] = useState<string | null>(null);
  const [festPage, setFestPage] = useState(1);
  const [festSortKey, setFestSortKey] = useState<"title" | "date" | "registrations" | "dept">("date");
  const [festSortDir, setFestSortDir] = useState<"asc" | "desc">("desc");

  const [approvalStatuses, setApprovalStatuses] = useState<Record<string, "pending_approvals" | "live">>({});

  // Club management state
  const [clubs, setClubs] = useState<ClubRecord[]>([]);
  const [clubPagination, setClubPagination] = useState<PaginationState>(createDefaultPagination());
  const [clubSearchQuery, setClubSearchQuery] = useState("");
  const [showDeleteClubConfirm, setShowDeleteClubConfirm] = useState<string | null>(null);
  const [clubPage, setClubPage] = useState(1);
  const [clubSortKey, setClubSortKey] = useState<"name" | "category" | "registrations">("name");
  const [clubSortDir, setClubSortDir] = useState<"asc" | "desc">("asc");
  const [clubStatusFilter, setClubStatusFilter] = useState<"all" | "open" | "closed">("all");
  const [clubStatusUpdatingId, setClubStatusUpdatingId] = useState<string | null>(null);

  const [registrations, setRegistrations] = useState<Registration[]>([]);

  // Venue management state
  type VenueRow = { id: string; campus: string; name: string; capacity: number | null; location: string | null; is_active: boolean; is_approval_needed: boolean };
  type VenueBookingRow = {
    id: string;
    date: string;
    start_time: string;
    end_time: string;
    requested_by_name: string | null;
    requested_by: string | null;
    booking_title: string | null;
    entity_type: string;
    status: string;
  };
  const [venues,           setVenues]           = useState<VenueRow[]>([]);
  const [venuesLoading,    setVenuesLoading]    = useState(false);
  const [venueForm,        setVenueForm]        = useState({ campus: "", name: "", capacity: "", location: "", is_approval_needed: false });
  const [locationSuggestions, setLocationSuggestions] = useState<string[]>([]);
  const [venueFormError,   setVenueFormError]   = useState<string | null>(null);
  const [venueSubmitting,  setVenueSubmitting]  = useState(false);
  const [deleteVenueId,    setDeleteVenueId]    = useState<string | null>(null);
  const [editingVenue,     setEditingVenue]     = useState<VenueRow | null>(null);
  const [editVenueForm,    setEditVenueForm]    = useState({ name: "", capacity: "", location: "", is_approval_needed: false, is_active: true });
  const [editVenueSaving,  setEditVenueSaving]  = useState(false);
  // Venue list pagination
  const [venuePage,        setVenuePage]        = useState(1);
  const VENUE_PAGE_SIZE = 15;
  const [selectedVenueForBookings, setSelectedVenueForBookings] = useState<VenueRow | null>(null);
  const [venueBookings, setVenueBookings] = useState<VenueBookingRow[]>([]);
  const [venueBookingsLoading, setVenueBookingsLoading] = useState(false);
  const [venueBookingsPage, setVenueBookingsPage] = useState(1);
  const [venueBookingsTotal, setVenueBookingsTotal] = useState(0);
  const [venueBookingsTotalPages, setVenueBookingsTotalPages] = useState(1);
  const VENUE_BOOKINGS_PAGE_SIZE = 10;
  const venueBookingsPanelRef = useRef<HTMLDivElement>(null);
  const [venueBookingsHighlight, setVenueBookingsHighlight] = useState(false);

  // Catering management state
  type ContactDetail = { name: string; email: string; mobile: string[] };
  type CatererRow = { catering_id: string; catering_name: string; contact_details: ContactDetail[]; campuses: string[]; location: string | null };
  type CatererFormContact = { name: string; email: string; mobile: string };
  const [caterers,         setCaterers]         = useState<CatererRow[]>([]);
  const [caterersLoading,  setCaterersLoading]  = useState(false);
  const [catererForm,      setCatererForm]      = useState({ catering_name: "", campuses: [] as string[], location: "", contacts: [{ name: "", email: "", mobile: "" }] as CatererFormContact[] });
  const [catererFormError, setCatererFormError] = useState<string | null>(null);
  const [catererSubmitting,setCatererSubmitting]= useState(false);
  const [deleteCatererId,  setDeleteCatererId]  = useState<string | null>(null);
  const [editingCaterer,   setEditingCaterer]   = useState<CatererRow | null>(null);
  const [editCatererForm,  setEditCatererForm]  = useState({ catering_name: "", campuses: [] as string[], location: "", contacts: [] as CatererFormContact[] });
  const [editCatererSaving,setEditCatererSaving]= useState(false);
  const [catererPage,      setCatererPage]      = useState(1);
  const CATERER_PAGE_SIZE = 15;

  async function fetchAllCaterers() {
    setCaterersLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/caterers/all`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setCaterers(await res.json());
    } catch { /* non-critical */ } finally {
      setCaterersLoading(false);
    }
  }

  async function handleCreateCaterer() {
    if (!catererForm.catering_name.trim()) { setCatererFormError("Caterer name is required."); return; }
    setCatererSubmitting(true); setCatererFormError(null);
    try {
      const contact_details = catererForm.contacts
        .filter(c => (c.name || "").trim() || (c.email || "").trim() || (c.mobile || "").trim())
        .map(c => ({
          name: (c.name || "").trim(),
          email: (c.email || "").trim(),
          mobile: (c.mobile || "").split(",").map(m => m.trim()).filter(Boolean),
        }));
      console.log("[Caterer form] submitting", catererForm.contacts.length, "contact row(s), sending", contact_details.length, "after filter:", contact_details);
      const res = await fetch(`${API_URL}/api/caterers`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ catering_name: catererForm.catering_name.trim(), contact_details, campuses: catererForm.campuses, location: catererForm.location || null }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setCatererFormError(body.error || "Failed to create caterer"); return; }
      const ra = body.role_assignment;
      if (ra && (ra.notFound?.length || ra.errors?.length)) {
        const parts: string[] = [];
        if (ra.updated?.length) parts.push(`${ra.updated.length} of ${ra.requested} contacts assigned`);
        if (ra.notFound?.length) parts.push(`${ra.notFound.length} email(s) have no Socio account: ${ra.notFound.join(", ")}`);
        if (ra.errors?.length) parts.push(`${ra.errors.length} update error(s) — check server logs`);
        toast(`Caterer added, but: ${parts.join("; ")}`, { icon: "⚠️", duration: 6000 });
        console.warn("[Caterer] role_assignment partial:", ra);
      } else {
        toast.success("Caterer added");
      }
      setCatererForm({ catering_name: "", campuses: [], location: "", contacts: [{ name: "", email: "", mobile: "" }] });
      fetchAllCaterers();
    } catch { setCatererFormError("Network error"); } finally { setCatererSubmitting(false); }
  }

  async function handleDeleteCaterer(id: string) {
    try {
      const res = await fetch(`${API_URL}/api/caterers/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) { toast.error("Failed to delete caterer"); return; }
      toast.success("Caterer deleted");
      setDeleteCatererId(null);
      fetchAllCaterers();
    } catch { toast.error("Network error"); }
  }

  async function handleSaveCatererEdit() {
    if (!editingCaterer) return;
    setEditCatererSaving(true);
    try {
      const contact_details = editCatererForm.contacts
        .filter(c => (c.name || "").trim() || (c.email || "").trim() || (c.mobile || "").trim())
        .map(c => ({
          name: (c.name || "").trim(),
          email: (c.email || "").trim(),
          mobile: (c.mobile || "").split(",").map(m => m.trim()).filter(Boolean),
        }));
      console.log("[Caterer edit] saving", editCatererForm.contacts.length, "contact row(s), sending", contact_details.length, "after filter:", contact_details);
      const res = await fetch(`${API_URL}/api/caterers/${editingCaterer.catering_id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ catering_name: editCatererForm.catering_name, contact_details, campuses: editCatererForm.campuses, location: editCatererForm.location || null }),
      });
      if (!res.ok) { toast.error("Failed to save changes"); return; }
      const body = await res.json().catch(() => ({}));
      const ra = body.role_assignment;
      const rr = body.role_revocation;
      const warnings: string[] = [];
      if (ra && (ra.notFound?.length || ra.errors?.length)) {
        if (ra.notFound?.length) warnings.push(`${ra.notFound.length} new email(s) have no Socio account: ${ra.notFound.join(", ")}`);
        if (ra.errors?.length) warnings.push(`${ra.errors.length} assign error(s)`);
      }
      if (rr?.errors?.length) warnings.push(`${rr.errors.length} revoke error(s)`);
      if (warnings.length) {
        toast(`Caterer updated, but: ${warnings.join("; ")} — check server logs`, { icon: "⚠️", duration: 6000 });
        console.warn("[Caterer] role diagnostics:", { role_assignment: ra, role_revocation: rr });
      } else {
        toast.success("Caterer updated");
      }
      setEditingCaterer(null);
      fetchAllCaterers();
    } catch { toast.error("Network error"); } finally { setEditCatererSaving(false); }
  }

  async function fetchAllVenues() {
    setVenuesLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/all`, {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) setVenues(await res.json());
    } catch { /* non-critical */ } finally {
      setVenuesLoading(false);
    }
  }

  async function handleCreateVenue() {
    if (!venueForm.campus || !venueForm.name) { setVenueFormError("Campus and name are required."); return; }
    setVenueSubmitting(true); setVenueFormError(null);
    try {
      const res = await fetch(`${API_URL}/api/venues`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          campus: venueForm.campus,
          name: venueForm.name,
          capacity: venueForm.capacity ? Number(venueForm.capacity) : null,
          location: venueForm.location || null,
          is_approval_needed: venueForm.is_approval_needed,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [body.error || "Failed to create venue"];
        if (body.code)    parts.push(`code: ${body.code}`);
        if (body.details) parts.push(`details: ${body.details}`);
        if (body.hint)    parts.push(`hint: ${body.hint}`);
        setVenueFormError(parts.join(" · "));
        return;
      }
      toast.success("Venue created");
      setVenueForm({ campus: "", name: "", capacity: "", location: "", is_approval_needed: false });
      fetchAllVenues();
    } catch { setVenueFormError("Network error"); } finally { setVenueSubmitting(false); }
  }

  async function handleDeleteVenue(id: string) {
    try {
      const res = await fetch(`${API_URL}/api/venues/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (!res.ok) { toast.error("Failed to delete venue"); return; }
      toast.success("Venue deleted");
      setDeleteVenueId(null);
      fetchAllVenues();
    } catch { toast.error("Network error"); }
  }

  async function handleToggleVenueActive(v: VenueRow) {
    try {
      const res = await fetch(`${API_URL}/api/venues/${v.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !v.is_active }),
      });
      if (!res.ok) { toast.error("Failed to update venue"); return; }
      fetchAllVenues();
    } catch { toast.error("Network error"); }
  }

  async function handleToggleVenueApproval(v: VenueRow) {
    try {
      const res = await fetch(`${API_URL}/api/venues/${v.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ is_approval_needed: !v.is_approval_needed }),
      });
      if (!res.ok) { toast.error("Failed to update venue"); return; }
      fetchAllVenues();
    } catch { toast.error("Network error"); }
  }

  async function handleViewVenueBookings(v: VenueRow, page = 1) {
    if (selectedVenueForBookings?.id === v.id && page === venueBookingsPage) {
      setSelectedVenueForBookings(null);
      setVenueBookings([]);
      return;
    }
    setSelectedVenueForBookings(v);
    setVenueBookingsPage(page);
    setVenueBookingsLoading(true);
    try {
      const res = await fetch(
        `${API_URL}/api/venue-bookings?venue_id=${encodeURIComponent(v.id)}&page=${page}&limit=${VENUE_BOOKINGS_PAGE_SIZE}`,
        { headers: { Authorization: `Bearer ${authToken}` } }
      );
      if (!res.ok) { toast.error("Failed to load venue bookings"); setVenueBookings([]); return; }
      const payload = await res.json();
      const rows: VenueBookingRow[] = (payload.bookings || []).map((row: any) => ({
        id:                String(row.id),
        date:              String(row.date || ""),
        start_time:        String(row.start_time || ""),
        end_time:          String(row.end_time || ""),
        requested_by_name: row.requested_by_name || null,
        requested_by:      row.requested_by || null,
        booking_title:     row.title || null,
        entity_type:       row.entity_type || "standalone",
        status:            row.status || "pending",
      }));
      setVenueBookings(rows);
      setVenueBookingsTotal(payload.total ?? 0);
      setVenueBookingsTotalPages(payload.totalPages ?? 1);
      // Scroll + highlight the panel
      setTimeout(() => {
        venueBookingsPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        setVenueBookingsHighlight(true);
        setTimeout(() => setVenueBookingsHighlight(false), 1400);
      }, 80);
    } catch {
      toast.error("Network error");
      setVenueBookings([]);
    } finally {
      setVenueBookingsLoading(false);
    }
  }

  async function handleSaveVenueEdit() {
    if (!editingVenue) return;
    setEditVenueSaving(true);
    try {
      const res = await fetch(`${API_URL}/api/venues/${editingVenue.id}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          name:               editVenueForm.name.trim() || undefined,
          capacity:           editVenueForm.capacity ? Number(editVenueForm.capacity) : null,
          location:           editVenueForm.location.trim() || null,
          is_approval_needed: editVenueForm.is_approval_needed,
          is_active:          editVenueForm.is_active,
        }),
      });
      if (!res.ok) { toast.error("Failed to save changes"); return; }
      toast.success("Venue updated");
      setEditingVenue(null);
      fetchAllVenues();
    } catch { toast.error("Network error"); } finally { setEditVenueSaving(false); }
  }

  const [isLoading, setIsLoading] = useState(true);

  // Report state
  const [reportMode, setReportMode] = useState<"fest" | "events">("fest");
  const [selectedReportFest, setSelectedReportFest] = useState<string>("");
  const [selectedAccreditation, setSelectedAccreditation] = useState<string>("");
  const [selectedEventIds, setSelectedEventIds] = useState<Set<string>>(new Set());
  const [searchTermReport, setSearchTermReport] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportEvents, setReportEvents] = useState<Event[]>([]);
  const [reportFests, setReportFests] = useState<Fest[]>([]);

  // Debounced search queries for better performance
  const debouncedUserSearch = useDebounce(userSearchQuery, 300);
  const debouncedEventSearch = useDebounce(eventSearchQuery, 300);
  const debouncedFestSearch = useDebounce(festSearchQuery, 300);
  const debouncedClubSearch = useDebounce(clubSearchQuery, 300);

  useEffect(() => {
    const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    if (!authLoading && !isMasterAdmin && !isLocalhost) {
      router.push("/");
    }
  }, [authLoading, isMasterAdmin, router]);

  // Check if user is on localhost for dev access
  const [isLocalhostDev, setIsLocalhostDev] = useState(false);
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsLocalhostDev(window.location.hostname === 'localhost');
    }
  }, []);

  useEffect(() => {
    if (!isMasterAdmin || !authToken) return;
    
    if (activeTab === "users") {
      fetchUsers();
    } else if (activeTab === "events") {
      fetchEvents();
    } else if (activeTab === "fests") {
      fetchFests();
    } else if (activeTab === "clubs") {
      fetchClubs();
    } else if (activeTab === "dashboard") {
      fetchDashboardData();
    } else if (activeTab === "notifications") {
      // Ensure users/events are loaded for the notification composer
      if (users.length === 0) fetchUsers({ unpaged: true });
      if (events.length === 0) fetchEvents({ unpaged: true });
    } else if (activeTab === "report") {
      // Fetch events and fests for report tab
      fetchReportData();
    } else if (activeTab === "venues") {
      fetchAllVenues();
    } else if (activeTab === "caterers") {
      fetchAllCaterers();
    }
  }, [activeTab, isMasterAdmin, authToken]);

  // Fetch existing location suggestions when campus changes (add form) or edit modal opens
  const fetchLocationSuggestions = (campus: string) => {
    if (!campus || !authToken) { setLocationSuggestions([]); return; }
    fetch(`${API_URL}/api/venues/blocks?campus=${encodeURIComponent(campus)}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : { blocks: [] })
      .then(d => setLocationSuggestions(Array.isArray(d.blocks) ? d.blocks : []))
      .catch(() => setLocationSuggestions([]));
  };
  useEffect(() => { fetchLocationSuggestions(venueForm.campus); }, [venueForm.campus, authToken]);
  useEffect(() => { if (editingVenue?.campus) fetchLocationSuggestions(editingVenue.campus); }, [editingVenue?.campus]);

  useEffect(() => {
    if (activeTab !== "venues") {
      setSelectedVenueForBookings(null);
      setVenueBookings([]);
      setVenueBookingsLoading(false);
    }
    if (activeTab !== "events") {
      setSelectedEventForBookings(null);
      setEventBookings([]);
      setEventBookingsLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    setUserPage(1);
  }, [debouncedUserSearch, roleFilter, userSortKey, userSortDir]);

  useEffect(() => {
    setClubPage(1);
  }, [debouncedClubSearch, clubStatusFilter, clubSortKey, clubSortDir]);

  // Event status helper
  const getEventStatus = (event: Event) => {
    const isArchived = event.archived_effective === true || event.is_archived === true;
    if (isArchived) {
      return { label: "Archived", color: "bg-amber-100 text-amber-700" };
    }

    const isDraft = Boolean(event.is_draft);
    if (isDraft) {
      if (approvalStatuses[event.event_id] === "pending_approvals") {
        return { label: "Pending Approvals", color: "bg-amber-100 text-amber-700" };
      }
      return { label: "Draft", color: "bg-slate-100 text-slate-700" };
    }

    const now = new Date();
    const eventDate = new Date(event.event_date);
    const diffMs = eventDate.getTime() - now.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays < -1) return { label: "Past", color: "bg-gray-100 text-gray-600" };
    if (Math.abs(diffDays) <= 1) return { label: "Live", color: "bg-green-100 text-green-700" };
    if (diffDays <= 7) return { label: "This Week", color: "bg-yellow-100 text-yellow-700" };
    return { label: "Upcoming", color: "bg-blue-100 text-blue-700" };
  };

  // Sort toggle helper
  const toggleSort = <T extends string>(
    key: T,
    currentKey: T,
    currentDir: "asc" | "desc",
    setKey: (k: T) => void,
    setDir: (d: "asc" | "desc") => void
  ) => {
    if (currentKey === key) {
      setDir(currentDir === "asc" ? "desc" : "asc");
    } else {
      setKey(key);
      setDir("asc");
    }
  };

  // Sort indicator
  const SortIcon = ({ active, dir }: { active: boolean; dir: "asc" | "desc" }) => (
    <span className={`ml-1 inline-block transition-colors ${active ? "text-[#154CB3]" : "text-gray-400"}`}>
      {active ? (dir === "asc" ? "▲" : "▼") : "⇅"}
    </span>
  );

  useEffect(() => {
    setEventPage(1);
  }, [debouncedEventSearch, eventStatusFilter, eventSortKey, eventSortDir]);

  useEffect(() => {
    setFestPage(1);
  }, [debouncedFestSearch, festSortKey, festSortDir]);

  useEffect(() => {
    if (!isMasterAdmin || !authToken || activeTab !== "users") return;
    fetchUsers();
  }, [activeTab, isMasterAdmin, authToken, userPage, debouncedUserSearch, roleFilter, userSortKey, userSortDir]);

  useEffect(() => {
    if (!isMasterAdmin || !authToken || activeTab !== "events") return;
    fetchEvents();
  }, [activeTab, isMasterAdmin, authToken, eventPage, debouncedEventSearch, eventStatusFilter, eventSortKey, eventSortDir]);

  useEffect(() => {
    if (!isMasterAdmin || !authToken || activeTab !== "fests") return;
    fetchFests();
  }, [activeTab, isMasterAdmin, authToken, festPage, debouncedFestSearch, festSortKey, festSortDir]);

  useEffect(() => {
    if (!isMasterAdmin || !authToken || activeTab !== "clubs") return;
    fetchClubs();
  }, [activeTab, isMasterAdmin, authToken, clubPage, debouncedClubSearch, clubStatusFilter, clubSortKey, clubSortDir]);

  useEffect(() => {
    if (!authToken) return;
    const draftEventIds = events.filter(e => e.is_draft).map(e => e.event_id);
    const draftFestIds = fests.filter((f: any) => f.is_draft).map((f: any) => f.fest_id);
    const allIds = [...draftEventIds, ...draftFestIds];
    if (!allIds.length) return;
    fetch(`${API_URL}/api/approvals/statuses?ids=${allIds.join(",")}`, {
      headers: { Authorization: `Bearer ${authToken}` },
    })
      .then(r => r.ok ? r.json() : {})
      .then(data => setApprovalStatuses(prev => ({ ...prev, ...data })))
      .catch(() => {});
  }, [authToken, events, fests]); // eslint-disable-line

  useEffect(() => {
    if (!isMasterAdmin || !authToken || activeTab !== "roles") return;
    fetchRoleHolders();
  }, [activeTab, isMasterAdmin, authToken]); // eslint-disable-line

  const fetchRegistrations = async () => {
    try {
      const token = await getFreshToken();
      const response = await fetch(`${API_URL}/api/registrations`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!response.ok) throw new Error("Failed to fetch registrations");
      const data = await response.json();
      setRegistrations(data.registrations || []);
    } catch (error) {
      console.error("Error fetching registrations:", error);
    }
  };

  const handleViewEventBookings = async (event: Event) => {
    if (selectedEventForBookings?.event_id === event.event_id) {
      setSelectedEventForBookings(null);
      setEventBookings([]);
      return;
    }

    setSelectedEventForBookings(event);
    setEventBookingsLoading(true);
    try {
      const token = await getFreshToken();
      const headers: Record<string, string> = token
        ? { Authorization: `Bearer ${token}` }
        : {};
      const response = await fetch(
        `${API_URL}/api/registrations?event_id=${encodeURIComponent(event.event_id)}`,
        { headers }
      );
      if (!response.ok) throw new Error("Failed to load event bookings");
      const data = await response.json();
      setEventBookings(data.registrations || []);
    } catch {
      toast.error("Failed to load event bookings");
      setEventBookings([]);
    } finally {
      setEventBookingsLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([
        fetchUsers({ unpaged: true }),
        fetchEvents({ unpaged: true }),
        fetchFests({ unpaged: true }),
        fetchClubs({ unpaged: true }),
        fetchRegistrations()
      ]);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getPaginationState = (
    pagination: any,
    fallbackPage: number,
    fallbackSize: number,
    fallbackTotal: number
  ): PaginationState => {
    if (pagination) {
      return {
        page: pagination.page || fallbackPage,
        pageSize: pagination.pageSize || fallbackSize,
        totalItems: pagination.totalItems ?? fallbackTotal,
        totalPages: pagination.totalPages || 1,
        hasNext: Boolean(pagination.hasNext),
        hasPrev: Boolean(pagination.hasPrev),
      };
    }

    const totalPages = Math.max(Math.ceil(fallbackTotal / fallbackSize), 1);
    return {
      page: fallbackPage,
      pageSize: fallbackSize,
      totalItems: fallbackTotal,
      totalPages,
      hasNext: fallbackPage < totalPages,
      hasPrev: fallbackPage > 1,
    };
  };

  const fetchUsers = async (options?: { unpaged?: boolean }) => {
    try {
      setIsLoading(true);
      const token = await getFreshToken();

      if (!token) {
        // Session can be briefly unavailable right after reload; avoid noisy hard failures.
        throw new Error("Authentication session is still loading. Please retry.");
      }

      const query = new URLSearchParams();
      if (!options?.unpaged) {
        query.set("page", String(userPage));
        query.set("pageSize", String(ITEMS_PER_PAGE));
        if (debouncedUserSearch.trim()) query.set("search", debouncedUserSearch.trim());
        if (roleFilter !== "all") query.set("role", roleFilter);
        query.set("sortBy", userSortKey === "date" ? "created_at" : userSortKey);
        query.set("sortOrder", userSortDir);
      }

      const url = `${API_URL}/api/users${query.toString() ? `?${query.toString()}` : ""}`;

      const makeRequest = async (authToken: string) =>
        fetch(url, {
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
        });

      let response = await makeRequest(token);

      if (response.status === 401 || response.status === 403) {
        const refreshedToken = await getFreshToken();
        if (refreshedToken) {
          response = await makeRequest(refreshedToken);
        }
      }

      if (!response.ok) {
        let errorMessage = "Failed to fetch users";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Fallback to generic status text
          errorMessage = `${response.status} ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      const nextUsers = data.users || [];
      setUsers(nextUsers);
      setUserPagination(getPaginationState(data.pagination, userPage, ITEMS_PER_PAGE, nextUsers.length));
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(`Failed to load users: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchEvents = async (options?: { unpaged?: boolean }) => {
    try {
      setIsLoading(true);
      const token = await getFreshToken();

      const query = new URLSearchParams();
      if (!options?.unpaged) {
        query.set("page", String(eventPage));
        query.set("pageSize", String(ITEMS_PER_PAGE));
        if (debouncedEventSearch.trim()) query.set("search", debouncedEventSearch.trim());
        if (eventStatusFilter !== "all") query.set("status", eventStatusFilter);
        query.set("sortBy", eventSortKey === "date" ? "event_date" : eventSortKey);
        query.set("sortOrder", eventSortDir);
      }

      const url = `${API_URL}/api/events${query.toString() ? `?${query.toString()}` : ""}`;
      const eventsResponse = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!eventsResponse.ok) {
        throw new Error("Failed to fetch events");
      }

      const data = await eventsResponse.json();
      const nextEvents = data.events || [];
      setEvents(nextEvents);
      setEventPagination(getPaginationState(data.pagination, eventPage, ITEMS_PER_PAGE, nextEvents.length));
    } catch (error) {
      console.error("Error fetching events:", error);
      toast.error("Failed to load events");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFests = async (options?: { unpaged?: boolean }) => {
    try {
      setIsLoading(true);
      const token = await getFreshToken();

      const query = new URLSearchParams();
      if (!options?.unpaged) {
        query.set("page", String(festPage));
        query.set("pageSize", String(ITEMS_PER_PAGE));
        if (debouncedFestSearch.trim()) query.set("search", debouncedFestSearch.trim());
        query.set("sortBy", festSortKey === "date" ? "opening_date" : festSortKey);
        query.set("sortOrder", festSortDir);
      }

      const url = `${API_URL}/api/fests${query.toString() ? `?${query.toString()}` : ""}`;
      const festsResponse = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

      if (!festsResponse.ok) {
        throw new Error("Failed to fetch fests");
      }

      const festsData = await festsResponse.json();
      const nextFests = festsData.fests || festsData || [];
      setFests(nextFests);
      setFestPagination(getPaginationState(festsData.pagination, festPage, ITEMS_PER_PAGE, nextFests.length));
    } catch (error) {
      console.error("Error fetching fests:", error);
      toast.error("Failed to load fests");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchClubs = async (options?: { unpaged?: boolean }) => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("clubs")
        .select("*")
        .order("club_name", { ascending: true });

      if (error) {
        throw new Error(error.message);
      }

      const allOrganizations = (data ?? []) as ClubRecord[];
      let filtered = allOrganizations;

      if (debouncedClubSearch.trim()) {
        const query = debouncedClubSearch.toLowerCase();
        filtered = filtered.filter(
          (club) =>
            club.club_name.toLowerCase().includes(query) ||
            (club.category && club.category.toLowerCase().includes(query))
        );
      }

      if (clubStatusFilter !== "all") {
        const neededRegStatus = clubStatusFilter === "open";
        filtered = filtered.filter((club) => club.club_registrations === neededRegStatus);
      }

      filtered.sort((a, b) => {
        let valA: string | number = a.club_name;
        let valB: string | number = b.club_name;
        if (clubSortKey === "category") {
          valA = a.category || "";
          valB = b.category || "";
        } else if (clubSortKey === "registrations") {
          valA = a.club_registrations ? 1 : 0;
          valB = b.club_registrations ? 1 : 0;
        }
        if (valA < valB) return clubSortDir === "asc" ? -1 : 1;
        if (valA > valB) return clubSortDir === "asc" ? 1 : -1;
        return 0;
      });

      const startIndex = (clubPage - 1) * ITEMS_PER_PAGE;
      const paginated = options?.unpaged
        ? filtered
        : filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

      setClubs(paginated);
      setClubPagination({
        page: clubPage,
        pageSize: ITEMS_PER_PAGE,
        totalItems: filtered.length,
        totalPages: Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1,
        hasNext: startIndex + ITEMS_PER_PAGE < filtered.length,
        hasPrev: clubPage > 1,
      });
    } catch (error: any) {
      console.error("Error fetching clubs:", error);
      toast.error(error?.message || "Failed to load clubs");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteClub = async (clubId: string) => {
    try {
      const success = await deleteClub(clubId);
      if (!success) {
        throw new Error("Failed to delete club");
      }
      await fetchClubs();
      setShowDeleteClubConfirm(null);
      toast.success("Organization deleted successfully");
    } catch (error: any) {
      console.error("Error deleting club:", error);
      toast.error(error.message || "Failed to delete club");
    }
  };

  const handleToggleClubRegistrations = async (club: ClubRecord) => {
    const nextValue = !club.club_registrations;
    try {
      setClubStatusUpdatingId(club.club_id);
      const { error } = await supabase
        .from("clubs")
        .update({ club_registrations: nextValue })
        .eq("club_id", club.club_id);

      if (error) throw new Error(error.message);

      setClubs((prev) =>
        prev.map((item) =>
          item.club_id === club.club_id
            ? { ...item, club_registrations: nextValue }
            : item
        )
      );
      toast.success(
        `${club.club_name} registrations ${nextValue ? "opened" : "closed"}`
      );
    } catch (error: any) {
      console.error("Error toggling club registrations:", error);
      toast.error(error?.message || "Failed to update registration status");
    } finally {
      setClubStatusUpdatingId(null);
    }
  };

  const fetchReportData = async () => {
    try {
      const token = await getFreshToken();
      const [eventsRes, festsRes] = await Promise.all([
        fetch(`${API_URL}/api/events`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/fests`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (eventsRes.ok) {
        const data = await eventsRes.json();
        setReportEvents(data.events || []);
      }
      if (festsRes.ok) {
        const data = await festsRes.json();
        setReportFests(data.fests || data || []);
      }
    } catch (error) {
      console.error("Error fetching report data:", error);
    }
  };

  const startEditUser = (user: User) => {
    setEditingUserId(user.id);
    setEditingUserRoles({
      is_organiser: user.is_organiser,
      organiser_expires_at: user.organiser_expires_at,
      is_support: user.is_support,
      support_expires_at: user.support_expires_at,
      is_masteradmin: user.is_masteradmin,
      masteradmin_expires_at: user.masteradmin_expires_at,
    });
  };

  const handleRoleToggle = (role: "is_organiser" | "is_support" | "is_masteradmin") => {
    setEditingUserRoles(prev => ({
      ...prev,
      [role]: !prev[role]
    }));
  };

  const handleExpirationChange = (
    field: "organiser_expires_at" | "support_expires_at" | "masteradmin_expires_at",
    value: string | null
  ) => {
    setEditingUserRoles(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const saveRoleChanges = async (user: User) => {
    try {
      const token = await getFreshToken();
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}/roles`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          is_organiser: editingUserRoles.is_organiser,
          organiser_expires_at: editingUserRoles.organiser_expires_at || null,
          is_support: editingUserRoles.is_support,
          support_expires_at: editingUserRoles.support_expires_at || null,
          is_masteradmin: editingUserRoles.is_masteradmin,
          masteradmin_expires_at: editingUserRoles.masteradmin_expires_at || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update roles");
      }

      // Update local state
      setUsers((prev) => prev.map((u) => 
        u.id === user.id 
          ? { ...u, ...editingUserRoles }
          : u
      ));
      setEditingUserId(null);
      setEditingUserRoles({});
      toast.success("Roles updated successfully");
    } catch (error: any) {
      console.error("Error updating roles:", error);
      toast.error(error.message || "Failed to update roles");
    }
  };

  // Fetch all role holders (called when Roles tab opens)
  const fetchRoleHolders = async () => {
    setRoleHoldersLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const all: User[] = data.users || data || [];
      setRoleHolders(all.filter(u => u.is_organiser || u.is_support || u.is_masteradmin || u.is_hod || u.is_dean || u.is_cfo || u.is_campus_director || u.is_accounts_office));
    } catch { /* non-critical */ }
    finally { setRoleHoldersLoading(false); }
  };

  const removeApprovalRole = async (user: User, roleKey: string) => {
    setRoleRemoving(`${user.email}:${roleKey}`);
    try {
      const token = await getFreshToken();
      const fieldMap: Record<string, string> = {
        organiser: "is_organiser", support: "is_support", masteradmin: "is_masteradmin",
        hod: "is_hod", dean: "is_dean", cfo: "is_cfo",
        director: "is_campus_director", accounts: "is_accounts_office",
      };
      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(user.email)}/roles`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ [fieldMap[roleKey]]: false }),
      });
      if (!res.ok) throw new Error();
      // Update local state
      setRoleHolders(prev => prev.map(u => {
        if (u.email !== user.email) return u;
        const updated = { ...u, [fieldMap[roleKey]]: false };
        return updated;
      }).filter(u => u.is_organiser || u.is_support || u.is_masteradmin || u.is_hod || u.is_dean || u.is_cfo || u.is_campus_director || u.is_accounts_office));
      toast.success("Role removed");
    } catch { toast.error("Failed to remove role"); }
    finally { setRoleRemoving(null); }
  };

  const exportRolesToCSV = (rows: Array<{ user: User; role: string; roleLabel: string }>) => {
    const header = ["Name", "Email", "Role", "Department / School", "Campus"];
    const lines = rows.map(({ user, roleLabel }) => [
      user.name || "",
      user.email,
      roleLabel,
      user.department || user.school || "",
      user.campus || "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const csv = [header.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "role_holders.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  // Roles tab: search users by email prefix
  const searchRoleEmails = async (query: string) => {
    if (!query || query.length < 2) { setRoleEmailSuggestions([]); return; }
    const matches = users.filter(u =>
      u.email?.toLowerCase().includes(query.toLowerCase()) ||
      (u.name as string | undefined)?.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8).map(u => ({ email: u.email, name: (u.name as string | undefined) || u.email }));
    setRoleEmailSuggestions(matches);
  };

  const saveApprovalRole = async () => {
    if (!roleSelectedEmail || !roleSelectedRole) return;
    setRoleSaving(true);
    try {
      const token = await getFreshToken();
      const fieldMap: Record<string, string> = {
        hod: "is_hod", dean: "is_dean", cfo: "is_cfo",
        director: "is_campus_director", accounts: "is_accounts_office",
      };
      const body: Record<string, unknown> = {
        [fieldMap[roleSelectedRole]]: true,
      };
      if (roleCampus) body.campus = roleCampus;
      if (roleSchool) body.school = roleSchool;
      if (roleDept) body.dept = roleDept;

      const res = await fetch(`${API_URL}/api/users/${encodeURIComponent(roleSelectedEmail)}/roles`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to assign role");
      }
      toast.success(`${roleSelectedRole.toUpperCase()} role assigned to ${roleSelectedEmail}`);
      fetchRoleHolders();
      // reset
      setRoleEmailInput(""); setRoleSelectedEmail(""); setRoleSelectedRole("");
      setRoleSchool(""); setRoleDept(""); setRoleCampus("");
      setRoleEmailSuggestions([]);
    } catch (err: any) {
      toast.error(err.message || "Failed to assign role");
    } finally {
      setRoleSaving(false);
    }
  };

  const deleteUser = async (email: string) => {
    try {
      const token = await getFreshToken();
      const response = await fetch(`${API_URL}/api/users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete user");
      }

      await fetchUsers();
      setShowDeleteUserConfirm(null);
      toast.success("User deleted successfully");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      toast.error(error.message || "Failed to delete user");
    }
  };

  const deleteEvent = async (eventId: string) => {
    try {
      const token = await getFreshToken();
      const response = await fetch(`${API_URL}/api/events/${eventId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete event");
      }

      await fetchEvents();
      setShowDeleteEventConfirm(null);
      toast.success("Event deleted successfully");
    } catch (error: any) {
      console.error("Error deleting event:", error);
      toast.error(error.message || "Failed to delete event");
    }
  };

  const deleteFest = async (festId: string) => {
    try {
      const token = await getFreshToken();
      const response = await fetch(`${API_URL}/api/fests/${festId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete fest");
      }

      await fetchFests();
      setShowDeleteFestConfirm(null);
      toast.success("Fest deleted successfully");
    } catch (error: any) {
      console.error("Error deleting fest:", error);
      toast.error(error.message || "Failed to delete fest");
    }
  };

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    hasNext, 
    hasPrev, 
    onNext, 
    onPrev,
    totalItems
  }: { 
    currentPage: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
    onNext: () => void;
    onPrev: () => void;
    totalItems?: number;
  }) => (
    <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-200">
      <div className="text-sm text-gray-600">
        Page {currentPage} of {totalPages}
        {totalItems !== undefined && (
          <span className="ml-2 text-gray-400">({totalItems} total items)</span>
        )}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onPrev}
          disabled={!hasPrev}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasPrev
              ? "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Previous
        </button>
        <button
          onClick={onNext}
          disabled={!hasNext}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            hasNext
              ? "bg-[#154CB3] text-white hover:bg-[#154cb3df]"
              : "bg-gray-100 text-gray-400 cursor-not-allowed"
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );

  if (authLoading || !authToken) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-xl font-semibold text-gray-700">Loading Admin Panel...</div>
        </div>
      </div>
    );
  }

  if (!isMasterAdmin) {
    return null;
  }

  // ── Sidebar nav config ──
  const sidebarNav = [
    { id: "dashboard" as const, label: "Dashboard", icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: "dataExplorer" as const, label: "Data Explorer", icon: <LineChart className="w-4 h-4" /> },
    {
      id: "users" as const,
      label: "Users",
      icon: <Users className="w-4 h-4" />,
      count: userPagination.totalItems || users.length,
    },
    {
      id: "events" as const,
      label: "Events",
      icon: <CalendarDays className="w-4 h-4" />,
      count: eventPagination.totalItems || events.length,
    },
    {
      id: "fests" as const,
      label: "Fests",
      icon: <Trophy className="w-4 h-4" />,
      count: festPagination.totalItems || fests.length,
    },
    {
      id: "clubs" as const,
      label: "Clubs",
      icon: <Building2 className="w-4 h-4" />,
      count: clubPagination.totalItems || clubs.length,
    },
    { id: "notifications" as const, label: "Notifications", icon: <Bell className="w-4 h-4" /> },
    { id: "report" as const, label: "Reports", icon: <BarChart2 className="w-4 h-4" /> },
  ];

  return (
    <div className="flex h-[calc(100dvh-9.5rem)] md:h-[calc(100dvh-8.5rem)] lg:h-[calc(100dvh-7.75rem)] bg-slate-50 overflow-hidden">

      {/* ── Sidebar ───────────────────────────────────────────────────────── */}
      <aside className="sticky top-0 h-full w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
        <nav className="px-3 pt-4 pb-2 space-y-0.5">
          {sidebarNav.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
                  isActive
                    ? "bg-blue-50 text-[#154cb3] font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#154cb3] rounded-r-full" />
                )}
                <span className={isActive ? "text-[#154cb3]" : "text-slate-400 group-hover:text-slate-600"}>
                  {item.icon}
                </span>
                <span className="flex-1 text-left">{item.label}</span>
                {"count" in item && item.count !== undefined && item.count > 0 && (
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                    isActive ? "bg-[#154cb3]/10 text-[#154cb3]" : "bg-slate-100 text-slate-500"
                  }`}>{item.count}</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Management section */}
        <div className="mt-1 px-3 pb-4 space-y-0.5">
          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1.5">Management</p>
          <button
            onClick={() => setActiveTab("roles")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
              activeTab === "roles"
                ? "bg-blue-50 text-[#154cb3] font-semibold"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
            }`}
          >
            {activeTab === "roles" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#154cb3] rounded-r-full" />
            )}
            <span className={activeTab === "roles" ? "text-[#154cb3]" : "text-slate-400 group-hover:text-slate-600"}>
              <ShieldCheck className="w-4 h-4" />
            </span>
            Roles
          </button>
          <Link href="/manage">
            <span className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-50 transition-all font-medium">
              <span className="text-slate-400">
                <Eye className="w-4 h-4" />
              </span>
              Organiser View
            </span>
          </Link>
          <button
            onClick={() => setActiveTab("venues")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
              activeTab === "venues"
                ? "bg-blue-50 text-[#154cb3] font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {activeTab === "venues" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#154cb3] rounded-r-full" />
            )}
            <span className={activeTab === "venues" ? "text-[#154cb3]" : "text-slate-400 group-hover:text-slate-600"}>
              <MapPin className="w-4 h-4" />
            </span>
            <span className="flex-1 text-left">Venues</span>
            {venues.length > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === "venues" ? "bg-[#154cb3]/10 text-[#154cb3]" : "bg-slate-100 text-slate-500"
              }`}>{venues.length}</span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("caterers")}
            className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all relative group ${
              activeTab === "caterers"
                ? "bg-blue-50 text-[#154cb3] font-semibold"
                : "text-slate-500 hover:text-slate-800 hover:bg-slate-50"
            }`}
          >
            {activeTab === "caterers" && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-[#154cb3] rounded-r-full" />
            )}
            <span className={activeTab === "caterers" ? "text-[#154cb3]" : "text-slate-400 group-hover:text-slate-600"}>
              <UtensilsCrossed className="w-4 h-4" />
            </span>
            <span className="flex-1 text-left">Catering</span>
            {caterers.length > 0 && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                activeTab === "caterers" ? "bg-[#154cb3]/10 text-[#154cb3]" : "bg-slate-100 text-slate-500"
              }`}>{caterers.length}</span>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main Content ──────────────────────────────────────────────────── */}
      <main className="min-w-0 flex-1 bg-slate-50 overflow-y-auto">

        {/* Dashboard Tab */}
        {activeTab === "dashboard" && (
          <div className="w-full">
            {isLoading ? (
              <div className="p-12 text-center">
                <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <div className="text-gray-600">Loading analytics...</div>
              </div>
            ) : (
              <AdminDashboardView
                users={users}
                events={events}
                fests={fests}
                registrations={registrations}
                onViewPerformanceInsights={() => setActiveTab("insights")}
              />
            )}
          </div>
        )}

        {/* Non-dashboard tabs get padding wrapper */}
        {activeTab !== "dashboard" && (
          <div className="p-6 space-y-6">
        {/* Performance Insights Tab */}
        {activeTab === "insights" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Performance Insights</h2>
              <p className="text-sm text-gray-500 mb-0">
                Deep analytics with filters, trends, top performers, role and pricing distributions, and CSV exports.
              </p>
            </div>

            {isLoading ? (
              <div className="p-12 text-center bg-white border border-gray-200 rounded-2xl">
                <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <div className="text-gray-600">Loading performance insights...</div>
              </div>
            ) : (
              <AnalyticsDashboard
                users={users}
                events={events}
                fests={fests}
                registrations={registrations}
              />
            )}
          </div>
        )}

        {/* Data Explorer Tab */}
        {activeTab === "dataExplorer" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Advanced Analytics Data Explorer</h2>
            </div>
            <DataExplorerDashboard />
          </div>
        )}

        {/* Settings placeholder */}
        {activeTab === "settings" && (
          <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
            <Settings className="w-10 h-10 mx-auto mb-3 text-slate-300" />
            <p className="font-medium text-slate-600">Settings</p>
            <p className="text-sm mt-1">Platform configuration coming soon.</p>
          </div>
        )}

        {/* Approvals Tab */}
        {activeTab === "approvals" && <ApprovalsManager />}

        {/* ── Venues Tab ─────────────────────────────────────────────────── */}
        {activeTab === "venues" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Venue Management</h2>
                  <p className="text-sm text-gray-500">Add, edit, or remove campus venues. Organisers see these when booking after approval.</p>
                </div>
                <Link
                  href="/bookvenue"
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#154cb3] text-white font-semibold rounded-full hover:bg-[#124099] transition-colors shadow-sm border-2 border-[#154cb3] text-sm self-start sm:self-auto"
                >
                  <MapPin className="w-4 h-4" />
                  Book Venue
                </Link>
              </div>
            </div>

            {/* Add venue form */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#154CB3]" /> Add New Venue
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Campus <span className="text-red-500">*</span></label>
                  <select
                    value={venueForm.campus}
                    onChange={e => setVenueForm(f => ({ ...f, campus: e.target.value }))}
                    className="w-full px-3.5 py-2.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:ring-offset-0 focus:border-transparent bg-white transition-all border-gray-300"
                  >
                    <option value="">Select campus…</option>
                    {christCampuses.map((campus) => (
                      <option key={campus} value={campus}>{campus}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Venue Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={venueForm.name}
                    onChange={e => setVenueForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Main Auditorium"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
                  <input
                    type="number"
                    min="1"
                    value={venueForm.capacity}
                    onChange={e => setVenueForm(f => ({ ...f, capacity: e.target.value }))}
                    placeholder="Max occupancy"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location / Block</label>
                  <input
                    type="text"
                    list="venue-location-suggestions"
                    value={venueForm.location}
                    onChange={e => setVenueForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Block A, Ground Floor"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  <datalist id="venue-location-suggestions">
                    {locationSuggestions.map(l => <option key={l} value={l} />)}
                  </datalist>
                  {locationSuggestions.length > 0 && (
                    <p className="text-[11px] text-gray-400 mt-1">
                      Existing: {locationSuggestions.join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 sm:py-3.5">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-gray-700">
                    Is approval needed for bookings at this venue?
                  </label>
                  <div className="inline-flex rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setVenueForm(f => ({ ...f, is_approval_needed: true }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${venueForm.is_approval_needed ? "bg-[#154CB3] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >Yes</button>
                    <button
                      type="button"
                      onClick={() => setVenueForm(f => ({ ...f, is_approval_needed: false }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${!venueForm.is_approval_needed ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >No</button>
                  </div>
                </div>
                <p className="text-xs text-gray-500 mt-2">When YES, any booking request for this venue is routed to the venue dashboard for approval.</p>
              </div>
              {venueFormError && <p className="text-sm text-red-600">{venueFormError}</p>}
              <button
                onClick={handleCreateVenue}
                disabled={venueSubmitting}
                className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50"
              >
                {venueSubmitting ? "Creating…" : "Create Venue"}
              </button>
            </div>

            {/* Venues list */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {venuesLoading ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading venues…</div>
              ) : venues.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No venues yet. Add one above.</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Campus</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Cap.</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Active</th>
                        <th className="text-center px-4 py-3 font-semibold text-gray-600">Needs Approval</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {venues.slice((venuePage - 1) * VENUE_PAGE_SIZE, venuePage * VENUE_PAGE_SIZE).map(v => (
                        <tr key={v.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900">{v.name}</td>
                          <td className="px-4 py-3 text-gray-600">{v.campus}</td>
                          <td className="px-4 py-3 text-gray-500">{v.location || "—"}</td>
                          <td className="px-4 py-3 text-center text-gray-600">{v.capacity ?? "—"}</td>

                          {/* Active toggle — pill style */}
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <div className="inline-flex rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => !v.is_active && handleToggleVenueActive(v)}
                                  className={`px-3 py-1 text-xs font-semibold transition-colors ${v.is_active ? "bg-[#154CB3] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >Yes</button>
                                <button
                                  type="button"
                                  onClick={() => v.is_active && handleToggleVenueActive(v)}
                                  className={`px-3 py-1 text-xs font-semibold transition-colors ${!v.is_active ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >No</button>
                              </div>
                            </div>
                          </td>

                          {/* Needs Approval toggle — pill style */}
                          <td className="px-4 py-3">
                            <div className="flex justify-center">
                              <div className="inline-flex rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => !v.is_approval_needed && handleToggleVenueApproval(v)}
                                  className={`px-3 py-1 text-xs font-semibold transition-colors ${v.is_approval_needed ? "bg-[#154CB3] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >Yes</button>
                                <button
                                  type="button"
                                  onClick={() => v.is_approval_needed && handleToggleVenueApproval(v)}
                                  className={`px-3 py-1 text-xs font-semibold transition-colors ${!v.is_approval_needed ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                                >No</button>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="inline-flex items-center gap-1">
                              <button
                                onClick={() => handleViewVenueBookings(v)}
                                className={`p-1.5 rounded transition-colors ${selectedVenueForBookings?.id === v.id ? "bg-[#154CB3] text-white" : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"}`}
                                title="View bookings"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setEditingVenue(v);
                                  setEditVenueForm({
                                    name:               v.name,
                                    capacity:           v.capacity != null ? String(v.capacity) : "",
                                    location:           v.location || "",
                                    is_approval_needed: v.is_approval_needed,
                                    is_active:          v.is_active,
                                  });
                                }}
                                className="text-slate-500 hover:text-[#154CB3] p-1.5 rounded hover:bg-blue-50 transition-colors"
                                title="Edit venue"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setDeleteVenueId(v.id)}
                                className="text-red-500 hover:text-red-700 p-1.5 rounded hover:bg-red-50 transition-colors"
                                title="Delete venue"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Venue table pagination */}
                  {venues.length > VENUE_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                      <p className="text-xs text-gray-500">
                        {(venuePage - 1) * VENUE_PAGE_SIZE + 1}–{Math.min(venuePage * VENUE_PAGE_SIZE, venues.length)} of {venues.length} venues
                      </p>
                      <div className="flex items-center gap-1">
                        <button
                          disabled={venuePage === 1}
                          onClick={() => setVenuePage(p => Math.max(1, p - 1))}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >← Prev</button>
                        <span className="px-3 text-xs text-gray-600">Page {venuePage} / {Math.ceil(venues.length / VENUE_PAGE_SIZE)}</span>
                        <button
                          disabled={venuePage >= Math.ceil(venues.length / VENUE_PAGE_SIZE)}
                          onClick={() => setVenuePage(p => p + 1)}
                          className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >Next →</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {selectedVenueForBookings && (
              <div
                ref={venueBookingsPanelRef}
                className={`rounded-2xl shadow-sm overflow-hidden transition-all duration-300 ${
                  venueBookingsHighlight
                    ? "border-2 border-[#154CB3] bg-blue-50 ring-4 ring-blue-100"
                    : "border border-gray-200 bg-white"
                }`}
              >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-800">Bookings for {selectedVenueForBookings.name}</h3>
                    <p className="text-xs text-gray-500">{selectedVenueForBookings.campus} · {selectedVenueForBookings.location || "No location"}</p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedVenueForBookings(null);
                      setVenueBookings([]);
                    }}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Close
                  </button>
                </div>

                {venueBookingsLoading ? (
                  <div className="p-6 text-sm text-gray-400">Loading bookings…</div>
                ) : venueBookings.length === 0 ? (
                  <div className="p-6 text-sm text-gray-500">No booking records found for this venue.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Date</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Time</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Title</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Requested By</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Type</th>
                          <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {venueBookings.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-gray-700">{row.date}</td>
                            <td className="px-4 py-3 text-gray-700">{row.start_time} - {row.end_time}</td>
                            <td className="px-4 py-3 text-gray-800">{row.booking_title || "—"}</td>
                            <td className="px-4 py-3 text-gray-600">{row.requested_by_name || row.requested_by || "—"}</td>
                            <td className="px-4 py-3 text-gray-600 capitalize">{row.entity_type}</td>
                            <td className="px-4 py-3">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                row.status === "approved"
                                  ? "bg-green-100 text-green-700"
                                  : row.status === "pending"
                                  ? "bg-yellow-100 text-yellow-700"
                                  : row.status === "rejected"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-gray-100 text-gray-600"
                              }`}>
                                {row.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {venueBookingsTotalPages > 1 && (
                      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
                        <p className="text-xs text-gray-500">
                          {venueBookingsTotal} booking{venueBookingsTotal !== 1 ? "s" : ""} total · Page {venueBookingsPage} of {venueBookingsTotalPages}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            disabled={venueBookingsPage <= 1}
                            onClick={() => selectedVenueForBookings && handleViewVenueBookings(selectedVenueForBookings, venueBookingsPage - 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >← Prev</button>
                          <button
                            disabled={venueBookingsPage >= venueBookingsTotalPages}
                            onClick={() => selectedVenueForBookings && handleViewVenueBookings(selectedVenueForBookings, venueBookingsPage + 1)}
                            className="px-3 py-1.5 text-xs font-medium rounded border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          >Next →</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}









        {/* User Management Tab */}
        {activeTab === "users" && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search Users
                  </label>
                  <input
                    type="text"
                    placeholder="Search by email or name..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Filter by Role
                  </label>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value)}
                    aria-label="Filter users by role"
                    title="Filter users by role"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  >
                    <option value="all">All Users</option>
                    <option value="organiser">Organisers</option>
                    <option value="support">Support</option>
                    <option value="masteradmin">Master Admins</option>
                  </select>
                </div>
              </div>
              {/* Result summary */}
              <div className="mt-3 text-sm text-gray-500">
                Showing <strong className="text-gray-700">{users.length}</strong> of{" "}
                <strong className="text-gray-700">{userPagination.totalItems}</strong> users
              </div>
            </div>

            {/* Users Table */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading users...</div>
                </div>
              ) : users.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No users found</div>
                  <div className="text-gray-500">Try adjusting your search or filter</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("name", userSortKey, userSortDir, setUserSortKey, setUserSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          >
                            User <SortIcon active={userSortKey === "name"} dir={userSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Organiser
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Support
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Master Admin
                          </th>
                          <th
                            onClick={() => toggleSort("date", userSortKey, userSortDir, setUserSortKey, setUserSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Joined <SortIcon active={userSortKey === "date"} dir={userSortDir} />
                          </th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {users.map((user) => {
                          const isEditing = editingUserId === user.id;
                          const displayRoles = isEditing ? editingUserRoles : user;

                          return (
                            <tr key={user.email} className="hover:bg-gray-50 transition-colors">
                              <td className="px-6 py-4">
                                <div className="flex flex-col">
                                  <div className="font-semibold text-gray-900">{user.name}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_organiser || false}
                                      onChange={() => isEditing && handleRoleToggle("is_organiser")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-[#154CB3] rounded focus:ring-[#154CB3] cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_organiser ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_organiser ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_organiser && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.organiser_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("organiser_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("organiser_expires_at", null)
                                        }
                                        colorScheme="blue"
                                        label="Organiser expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_support || false}
                                      onChange={() => isEditing && handleRoleToggle("is_support")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-green-600 rounded focus:ring-green-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_support ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_support ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_support && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.support_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("support_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("support_expires_at", null)
                                        }
                                        colorScheme="green"
                                        label="Support expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <div className="flex flex-col gap-2">
                                  <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={displayRoles.is_masteradmin || false}
                                      onChange={() => isEditing && handleRoleToggle("is_masteradmin")}
                                      disabled={!isEditing}
                                      className="w-5 h-5 text-red-600 rounded focus:ring-red-500 cursor-pointer disabled:opacity-50"
                                    />
                                    <span className={`text-sm font-medium ${displayRoles.is_masteradmin ? 'text-green-600' : 'text-gray-500'}`}>
                                      {displayRoles.is_masteradmin ? 'Enabled' : 'Disabled'}
                                    </span>
                                  </label>
                                  {displayRoles.is_masteradmin && isEditing && (
                                    <div className="mt-2">
                                      <DateTimePickerAdmin
                                        value={displayRoles.masteradmin_expires_at || null}
                                        onChange={(value) =>
                                          handleExpirationChange("masteradmin_expires_at", value)
                                        }
                                        onClear={() =>
                                          handleExpirationChange("masteradmin_expires_at", null)
                                        }
                                        colorScheme="red"
                                        label="Master Admin expiration"
                                      />
                                    </div>
                                  )}
                                </div>
                              </td>

                              <td className="px-6 py-4">
                                <span className="text-sm text-gray-600">
                                  {new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </td>

                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {isEditing ? (
                                    <>
                                      <button
                                        onClick={() => saveRoleChanges(user)}
                                        className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors"
                                      >
                                        Save
                                      </button>
                                      <button
                                        onClick={() => {
                                          setEditingUserId(null);
                                          setEditingUserRoles({});
                                        }}
                                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300 transition-colors"
                                      >
                                        Cancel
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => startEditUser(user)}
                                        className="px-4 py-2 bg-[#154CB3] text-white text-sm font-medium rounded-lg hover:bg-[#154cb3df] transition-colors"
                                      >
                                        Edit
                                      </button>
                                      {user.email !== userData?.email && (
                                        <button
                                          onClick={() => setShowDeleteUserConfirm(user.email)}
                                          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
                                        >
                                          Delete
                                        </button>
                                      )}
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={userPage}
                    totalPages={userPagination.totalPages}
                    hasNext={userPagination.hasNext}
                    hasPrev={userPagination.hasPrev}
                    onNext={() => setUserPage(p => p + 1)}
                    onPrev={() => setUserPage(p => p - 1)}
                    totalItems={userPagination.totalItems}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Event Management Tab */}
        {activeTab === "events" && (
          <div className="space-y-6">

            {/* Search + Status Filter + Result Count */}
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Events</label>
                  <input
                    type="text"
                    placeholder="Search events by title or department..."
                    value={eventSearchQuery}
                    onChange={(e) => setEventSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <select
                    value={eventStatusFilter}
                    onChange={(e) => setEventStatusFilter(e.target.value as any)}
                    aria-label="Filter events by status"
                    title="Filter events by status"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  >
                    <option value="all">All Events</option>
                    <option value="live">Live</option>
                    <option value="thisweek">This Week</option>
                    <option value="upcoming">Upcoming</option>
                    <option value="past">Past</option>
                  </select>
                </div>
              </div>
              {/* Result summary */}
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>
                  Showing <strong className="text-gray-700">{events.length}</strong> of{" "}
                  <strong className="text-gray-700">{eventPagination.totalItems}</strong> events
                  {eventStatusFilter !== "all" && (
                    <button onClick={() => setEventStatusFilter("all")} className="ml-2 text-[#154CB3] hover:underline">
                      Clear filter
                    </button>
                  )}
                </span>
                <span className="text-xs text-gray-400">
                  Sorted by {eventSortKey} ({eventSortDir === "asc" ? "ascending" : "descending"})
                </span>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading events...</div>
                </div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No events found</div>
                  <div className="text-gray-500">Try adjusting your search or filter</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("title", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Event <SortIcon active={eventSortKey === "title"} dir={eventSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Status</th>
                          <th
                            onClick={() => toggleSort("dept", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Department <SortIcon active={eventSortKey === "dept"} dir={eventSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("date", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Date <SortIcon active={eventSortKey === "date"} dir={eventSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("registrations", eventSortKey, eventSortDir, setEventSortKey, setEventSortDir)}
                            className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Registrations <SortIcon active={eventSortKey === "registrations"} dir={eventSortDir} />
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                          <th className="px-6 py-3 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {events.map((event) => {
                          const status = getEventStatus(event);
                          return (
                            <tr key={event.event_id} className="hover:bg-gray-50 transition-all duration-200">
                              <td className="px-6 py-4">
                                <div className="font-semibold text-gray-900">{event.title}</div>
                                <div className="text-xs text-gray-400 mt-0.5">ID: {event.event_id.slice(0, 8)}…</div>
                              </td>
                              <td className="px-6 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${status.color}`}>
                                  {status.label}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 font-medium">{event.organizing_dept}</td>
                              <td className="px-6 py-4 text-sm text-gray-600">
                                {new Date(event.event_date).toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric', 
                                  year: 'numeric' 
                                })}
                              </td>
                              <td className="px-6 py-4">
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                  <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                                  {event.registration_count || 0}
                                </span>
                              </td>
                              <td className="px-6 py-4 text-sm text-gray-600 max-w-[140px] truncate">{event.created_by}</td>
                              <td className="px-6 py-4 text-right">
                                <div className="flex items-center justify-end gap-2">
                                  <a
                                    href={`/edit/event/${event.event_id}`}
                                    className="px-3 py-1.5 bg-[#154CB3] text-white text-xs font-medium rounded-lg hover:bg-[#154cb3df] hover:-translate-y-0.5 transition-all"
                                  >
                                    Edit
                                  </a>
                                  <a
                                    href={`/event/${event.event_id}`}
                                    className="px-3 py-1.5 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 hover:-translate-y-0.5 transition-all"
                                  >
                                    View
                                  </a>
                                  <button
                                    onClick={() => handleViewEventBookings(event)}
                                    className="h-8 w-8 inline-flex items-center justify-center bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 hover:-translate-y-0.5 transition-all"
                                    title="View bookings"
                                    aria-label="View bookings"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => setShowDeleteEventConfirm(event.event_id)}
                                    className="h-8 w-8 inline-flex items-center justify-center bg-red-600 text-white rounded-lg hover:bg-red-700 hover:-translate-y-0.5 transition-all"
                                    title="Delete event"
                                    aria-label="Delete event"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {selectedEventForBookings && (
                    <div className="border-t border-gray-200 p-6 bg-gray-50">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900">
                            Bookings for {selectedEventForBookings.title}
                          </h3>
                          <p className="text-sm text-gray-500 mt-1">
                            Event ID: {selectedEventForBookings.event_id}
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedEventForBookings(null);
                            setEventBookings([]);
                          }}
                          className="px-3 py-1.5 text-sm font-medium bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
                        >
                          Close
                        </button>
                      </div>

                      {eventBookingsLoading ? (
                        <div className="text-sm text-gray-600">Loading event bookings...</div>
                      ) : eventBookings.length === 0 ? (
                        <div className="text-sm text-gray-600">No bookings found for this event.</div>
                      ) : (
                        <div className="overflow-x-auto bg-white border border-gray-200 rounded-lg">
                          <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                              <tr>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Name</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Email</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Register No.</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Type</th>
                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase">Booked At</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                              {eventBookings.map((booking) => {
                                const isTeam = booking.registration_type?.toLowerCase().includes("team");
                                const name = isTeam
                                  ? booking.team_leader_name
                                  : booking.individual_name;
                                const email = isTeam
                                  ? booking.team_leader_email
                                  : booking.individual_email;
                                const registerNo = isTeam
                                  ? booking.team_leader_register_number
                                  : booking.individual_register_number;

                                return (
                                  <tr key={booking.registration_id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-700">{name || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{email || booking.user_email || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">{registerNo ?? "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700 capitalize">{booking.registration_type || "-"}</td>
                                    <td className="px-4 py-3 text-sm text-gray-700">
                                      {new Date(booking.created_at).toLocaleString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                  <PaginationControls
                    currentPage={eventPage}
                    totalPages={eventPagination.totalPages}
                    hasNext={eventPagination.hasNext}
                    hasPrev={eventPagination.hasPrev}
                    onNext={() => setEventPage(p => p + 1)}
                    onPrev={() => setEventPage(p => p - 1)}
                    totalItems={eventPagination.totalItems}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Fest Management Tab */}
        {activeTab === "fests" && (
          <div className="space-y-6">

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Search Fests</label>
              <input
                type="text"
                placeholder="Search fests by title or department..."
                value={festSearchQuery}
                onChange={(e) => setFestSearchQuery(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
              />
              <div className="mt-3 text-sm text-gray-500">
                Showing <strong className="text-gray-700">{fests.length}</strong> of{" "}
                <strong className="text-gray-700">{festPagination.totalItems}</strong> fests
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading fests...</div>
                </div>
              ) : fests.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No fests found</div>
                  <div className="text-gray-500">Try adjusting your search</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] table-fixed">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("title", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="w-[24%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Fest <SortIcon active={festSortKey === "title"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("dept", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="w-[24%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Department <SortIcon active={festSortKey === "dept"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("date", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="w-[12%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Opening Date <SortIcon active={festSortKey === "date"} dir={festSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("registrations", festSortKey, festSortDir, setFestSortKey, setFestSortDir)}
                            className="w-[14%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Registrations <SortIcon active={festSortKey === "registrations"} dir={festSortDir} />
                          </th>
                          <th className="w-[16%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase">Created By</th>
                          <th className="w-[20%] px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {fests.map((fest) => (
                          <tr key={fest.fest_id} className="hover:bg-gray-50 transition-all duration-200">
                            <td className="px-6 py-5 align-top">
                              <div className="font-semibold text-gray-900 leading-6 break-words">{fest.fest_title}</div>
                              <div className="text-xs text-gray-500 mt-1">ID: {fest.fest_id}</div>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 font-medium leading-6 align-top break-words">{fest.organizing_dept}</td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-top whitespace-nowrap">
                              {new Date(fest.opening_date).toLocaleDateString('en-US', { 
                                month: 'short', 
                                day: 'numeric', 
                                year: 'numeric' 
                              })}
                            </td>
                            <td className="px-6 py-5 align-top">
                              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-sm font-medium bg-green-100 text-green-800">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-600"></span>
                                {fest.registration_count || 0}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 align-top">
                              <span className="inline-block max-w-full truncate" title={fest.created_by}>
                                {fest.created_by}
                              </span>
                            </td>
                            <td className="px-6 py-5 text-right align-top">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <a
                                  href={`/edit/fest/${fest.fest_id}`}
                                  className="px-3.5 py-1.5 bg-[#154CB3] text-white text-xs font-semibold rounded-lg hover:bg-[#154cb3df] hover:-translate-y-0.5 transition-all"
                                >
                                  Edit
                                </a>
                                <a
                                  href={`/fest/${fest.fest_id}`}
                                  className="px-3.5 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 hover:-translate-y-0.5 transition-all"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => setShowDeleteFestConfirm(fest.fest_id)}
                                  className="px-3.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 hover:-translate-y-0.5 transition-all"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={festPage}
                    totalPages={festPagination.totalPages}
                    hasNext={festPagination.hasNext}
                    hasPrev={festPagination.hasPrev}
                    onNext={() => setFestPage(p => p + 1)}
                    onPrev={() => setFestPage(p => p - 1)}
                    totalItems={festPagination.totalItems}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Clubs Management Tab */}
        {activeTab === "clubs" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Search Clubs</label>
                  <input
                    type="text"
                    placeholder="Search clubs & centres by title or category..."
                    value={clubSearchQuery}
                    onChange={(e) => setClubSearchQuery(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                  />
                </div>
                <div className="w-full md:w-64 flex flex-col justify-end">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={clubStatusFilter}
                      onChange={(e) => setClubStatusFilter(e.target.value as "all" | "open" | "closed")}
                      className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#154CB3] focus:border-[#154CB3] transition-all"
                    >
                      <option value="all">All Statuses</option>
                      <option value="open">Registrations OPEN</option>
                      <option value="closed">Registrations CLOSED</option>
                    </select>
                    {clubStatusFilter !== "all" && (
                      <button
                        onClick={() => setClubStatusFilter("all")}
                        className="p-3 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-colors flex-shrink-0"
                        title="Clear filter"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                </div>
              </div>
              <div className="mt-3 text-sm text-gray-500">
                Showing <strong className="text-gray-700">{clubs.length}</strong> of{" "}
                <strong className="text-gray-700">{clubPagination.totalItems}</strong> organizations
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
              {isLoading ? (
                <div className="p-12 text-center">
                  <div className="w-12 h-12 border-4 border-[#154CB3] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <div className="text-gray-600">Loading clubs...</div>
                </div>
              ) : clubs.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="text-xl font-semibold text-gray-700 mb-2">No organizations found</div>
                  <div className="text-gray-500">Try adjusting your search or filter</div>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1080px] table-fixed">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th
                            onClick={() => toggleSort("name", clubSortKey, clubSortDir, setClubSortKey, setClubSortDir)}
                            className="w-[30%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Club <SortIcon active={clubSortKey === "name"} dir={clubSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("category", clubSortKey, clubSortDir, setClubSortKey, setClubSortDir)}
                            className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Category <SortIcon active={clubSortKey === "category"} dir={clubSortDir} />
                          </th>
                          <th
                            onClick={() => toggleSort("registrations", clubSortKey, clubSortDir, setClubSortKey, setClubSortDir)}
                            className="w-[20%] px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase cursor-pointer hover:bg-gray-100 select-none"
                          >
                            Registrations <SortIcon active={clubSortKey === "registrations"} dir={clubSortDir} />
                          </th>
                          <th className="w-[30%] px-6 py-4 text-right text-xs font-semibold text-gray-700 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {clubs.map((club) => (
                          <tr key={club.club_id} className="hover:bg-gray-50 transition-all duration-200">
                            <td className="px-6 py-5 align-top">
                              <div className="font-semibold text-gray-900 leading-6 break-words">{club.club_name}</div>
                              <div className="text-xs text-gray-500 mt-1 uppercase font-medium">TYPE: {club.type}</div>
                            </td>
                            <td className="px-6 py-5 text-sm text-gray-600 font-medium leading-6 align-top break-words">
                              {club.category || "Uncategorized"}
                            </td>
                            <td className="px-6 py-5 align-top">
                              <button
                                type="button"
                                disabled={clubStatusUpdatingId === club.club_id}
                                onClick={() => handleToggleClubRegistrations(club)}
                                className={`inline-flex min-w-[104px] items-center justify-center gap-1.5 rounded-md px-3 py-1 text-xs font-bold transition-colors disabled:opacity-60 ${
                                  club.club_registrations
                                    ? "bg-green-100 text-green-800 hover:bg-green-200"
                                    : "bg-red-100 text-red-800 hover:bg-red-200"
                                }`}
                              >
                                <span
                                  className={`h-1.5 w-1.5 rounded-full ${
                                    club.club_registrations ? "bg-green-600" : "bg-red-600"
                                  }`}
                                ></span>
                                {clubStatusUpdatingId === club.club_id
                                  ? "UPDATING..."
                                  : club.club_registrations
                                    ? "OPEN"
                                    : "CLOSED"}
                              </button>
                            </td>
                            <td className="px-6 py-5 text-right align-top">
                              <div className="flex flex-wrap items-center justify-end gap-2">
                                <a
                                  href={`/edit/clubs/${club.club_id}`}
                                  className="px-3.5 py-1.5 bg-[#154CB3] text-white text-xs font-semibold rounded-lg hover:bg-[#0f3f96] hover:-translate-y-0.5 transition-all"
                                >
                                  Edit
                                </a>
                                <a
                                  href={`/club/${club.slug || club.club_id}`}
                                  className="px-3.5 py-1.5 bg-gray-600 text-white text-xs font-semibold rounded-lg hover:bg-gray-700 hover:-translate-y-0.5 transition-all"
                                >
                                  View
                                </a>
                                <button
                                  onClick={() => setShowDeleteClubConfirm(club.club_id)}
                                  className="px-3.5 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 hover:-translate-y-0.5 transition-all"
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <PaginationControls
                    currentPage={clubPage}
                    totalPages={clubPagination.totalPages}
                    hasNext={clubPagination.hasNext}
                    hasPrev={clubPagination.hasPrev}
                    onNext={() => setClubPage((p) => p + 1)}
                    onPrev={() => setClubPage((p) => p - 1)}
                    totalItems={clubPagination.totalItems}
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === "notifications" && authToken && (
          <AdminNotifications
            authToken={authToken}
            users={users.map(u => ({ email: u.email, name: u.name }))}
            events={events.map(e => ({ event_id: e.event_id, title: e.title }))}
          />
        )}

        {/* Report Tab */}
        {activeTab === "report" && (
          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Generate Report</h2>
              <p className="text-sm text-gray-500 mb-4">Generate comprehensive Excel reports for accreditation submissions.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setReportMode("fest"); setSelectedEventIds(new Set()); setSelectedReportFest(""); setSelectedAccreditation(""); }}
                  className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all ${reportMode === "fest" ? "bg-[#154CB3] text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  By Fest
                </button>
                <button
                  onClick={() => { setReportMode("events"); setSelectedEventIds(new Set()); setSelectedReportFest(""); setSelectedAccreditation(""); }}
                  className={`px-5 py-2.5 rounded-full font-medium text-sm transition-all ${reportMode === "events" ? "bg-[#154CB3] text-white shadow-md" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  By Events
                </button>
              </div>
            </div>

            {/* Fest Mode */}
            {reportMode === "fest" && (
              <>
                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">Select Fest</h2>
                  <p className="text-sm text-gray-500 mb-4">Choose a fest to generate a report for its events.</p>
                  <select
                    value={selectedReportFest}
                    onChange={(e) => { setSelectedReportFest(e.target.value); setSelectedEventIds(new Set()); }}
                    aria-label="Select fest for report"
                    title="Select fest for report"
                    className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
                  >
                    <option value="">-- Select a fest --</option>
                    {reportFests.map((fest) => (
                      <option key={fest.fest_id} value={fest.fest_id}>{fest.fest_title}</option>
                    ))}
                  </select>
                </div>

                {selectedReportFest && (() => {
                  const selectedFestObj = reportFests.find(f => f.fest_id === selectedReportFest);
                  const festEvts = (reportEvents as any[]).filter((e: any) => e.fest === selectedFestObj?.fest_title);
                  if (festEvts.length === 0) {
                    return (
                      <div className="bg-white border border-gray-200 rounded-2xl p-6">
                        <p className="text-gray-500 text-center">No events found under this fest.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">Select Events ({festEvts.length})</h2>
                        <button
                          onClick={() => {
                            if (selectedEventIds.size === festEvts.length) setSelectedEventIds(new Set());
                            else setSelectedEventIds(new Set(festEvts.map((e: any) => e.event_id)));
                          }}
                          className="text-sm text-[#154CB3] hover:underline font-semibold"
                        >
                          {selectedEventIds.size === festEvts.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {festEvts.map((event: any) => (
                          <label key={event.event_id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedEventIds.has(event.event_id)}
                              onChange={(ev) => {
                                const newSet = new Set(selectedEventIds);
                                if (ev.target.checked) newSet.add(event.event_id);
                                else newSet.delete(event.event_id);
                                setSelectedEventIds(newSet);
                              }}
                              className="mt-1 h-4 w-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3]"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{event.title}</p>
                              <p className="text-xs text-gray-500">{event.organizing_dept} &bull; {event.event_date}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 mt-3">
                        <span className="font-semibold text-[#154CB3]">{selectedEventIds.size}</span> event(s) selected
                      </p>
                    </div>
                  );
                })()}
              </>
            )}

            {/* Events Mode */}
            {reportMode === "events" && (() => {
              const filteredReportEvents = reportEvents.filter((e: any) =>
                e.title.toLowerCase().includes(searchTermReport.toLowerCase()) ||
                (e.organizing_dept || "").toLowerCase().includes(searchTermReport.toLowerCase())
              );
              return (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Search Events</h2>
                    <input
                      type="text"
                      placeholder="Search by title or department..."
                      value={searchTermReport}
                      onChange={(e) => setSearchTermReport(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
                    />
                  </div>
                  {filteredReportEvents.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <p className="text-gray-500 text-center">No events found.</p>
                    </div>
                  ) : (
                    <div className="bg-white border border-gray-200 rounded-2xl p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">All Events ({filteredReportEvents.length})</h2>
                        <button
                          onClick={() => {
                            if (selectedEventIds.size === filteredReportEvents.length) setSelectedEventIds(new Set());
                            else setSelectedEventIds(new Set(filteredReportEvents.map((e: any) => e.event_id)));
                          }}
                          className="text-sm text-[#154CB3] hover:underline font-semibold"
                        >
                          {selectedEventIds.size === filteredReportEvents.length ? "Deselect All" : "Select All"}
                        </button>
                      </div>
                      <div className="space-y-2 max-h-96 overflow-y-auto">
                        {filteredReportEvents.map((event: any) => (
                          <label key={event.event_id} className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors">
                            <input
                              type="checkbox"
                              checked={selectedEventIds.has(event.event_id)}
                              onChange={(ev) => {
                                const newSet = new Set(selectedEventIds);
                                if (ev.target.checked) newSet.add(event.event_id);
                                else newSet.delete(event.event_id);
                                setSelectedEventIds(newSet);
                              }}
                              className="mt-1 h-4 w-4 text-[#154CB3] border-gray-300 rounded focus:ring-[#154CB3]"
                            />
                            <div className="flex-1">
                              <p className="font-semibold text-gray-900">{event.title}</p>
                              <p className="text-xs text-gray-500">{event.organizing_dept} &bull; {event.event_date} &bull; {event.fest || "No fest"}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 mt-3">
                        <span className="font-semibold text-[#154CB3]">{selectedEventIds.size}</span> event(s) selected
                      </p>
                    </div>
                  )}
                </>
              );
            })()}

            {/* Accreditation Selection */}
            {selectedEventIds.size > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Select Accreditation Body</h2>
                <p className="text-sm text-gray-500 mb-4">Choose the accreditation body for the report.</p>
                <select
                  value={selectedAccreditation}
                  onChange={(e) => setSelectedAccreditation(e.target.value)}
                  aria-label="Select accreditation body"
                  title="Select accreditation body"
                  className="w-full md:w-1/2 px-4 py-3 border border-gray-300 rounded-xl bg-white text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#154CB3] focus:border-transparent transition-all"
                >
                  <option value="">-- Select accreditation body --</option>
                  {ACCREDITATION_BODIES.map((body) => (
                    <option key={body.id} value={body.id}>{body.name} - {body.fullName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Accreditation Info */}
            {selectedAccreditation && selectedEventIds.size > 0 && (() => {
              const body = ACCREDITATION_BODIES.find(b => b.id === selectedAccreditation);
              if (!body) return null;
              return (
                <div className="bg-white border border-[#154CB3]/20 rounded-2xl p-6 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-[#154CB3]/10 rounded-full flex items-center justify-center">
                      <svg className="w-5 h-5 text-[#154CB3]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{body.name}</h3>
                      <p className="text-sm text-gray-500">{body.fullName}</p>
                    </div>
                  </div>
                  <p className="text-gray-700 mb-2">{body.description}</p>
                  <div className="bg-gray-50 rounded-lg px-4 py-3">
                    <p className="text-sm text-gray-600"><span className="font-semibold text-gray-800">Focus: </span>{body.focus}</p>
                  </div>
                </div>
              );
            })()}

            {/* Generate Button */}
            {selectedEventIds.size > 0 && selectedAccreditation && (
              <div className="flex justify-start">
                <button
                  disabled={isGenerating}
                  className={`bg-[#154CB3] hover:bg-[#0d3580] text-white font-semibold py-3 px-8 rounded-full transition-all hover:shadow-lg ${isGenerating ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                  onClick={async () => {
                    setIsGenerating(true);
                    try {
                      const token = await getFreshToken();
                      const response = await fetch(`${API_URL}/api/report/data`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ eventIds: Array.from(selectedEventIds), festId: reportMode === "fest" ? selectedReportFest : null }),
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
                        reg_id: string;
                        name: string;
                        reg_num: string;
                        email: string;
                        event: string;
                        team: string;
                        status: string;
                        attended_at: string;
                      };

                      const participantRows: ParticipantReportRow[] = reportEvents.flatMap((event: any) => {
                        const participants = Array.isArray(event.participants) ? event.participants : [];
                        return participants.map((participant: any) => ({
                          reg_id: String(participant.registration_id ?? "-"),
                          name: String(participant.name ?? "-"),
                          reg_num: String(participant.register_number ?? "-"),
                          email: String(participant.email ?? ""),
                          event: String(event.title ?? "Untitled Event"),
                          team: String(participant.team_name ?? "Individual"),
                          status: String(participant.status ?? "unmarked"),
                          attended_at: participant.attended_at
                            ? new Date(participant.attended_at).toLocaleString("en-GB")
                            : "",
                        }));
                      });

                      addStructuredTableSheet(workbook, {
                        sheetName: "Participant Details",
                        columns: [
                          { header: "Registration ID", key: "reg_id", width: 22 },
                          { header: "Participant Name", key: "name", width: 28 },
                          { header: "Register Number", key: "reg_num", width: 16, horizontal: "center" },
                          { header: "Email", key: "email", width: 32, kind: "email" },
                          { header: "Event", key: "event", width: 34 },
                          { header: "Team", key: "team", width: 20 },
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
                      toast.error("Failed to generate report. Please try again.");
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                >
                  {isGenerating ? "Generating..." : "Generate Report"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Delete Modals */}
        {showDeleteUserConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete user <strong className="text-gray-900">{showDeleteUserConfirm}</strong>?
                  This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteUserConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteUser(showDeleteUserConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete User
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteEventConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete this event? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteEventConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteEvent(showDeleteEventConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Event
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteFestConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete this fest? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteFestConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => deleteFest(showDeleteFestConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Fest
                </button>
              </div>
            </div>
          </div>
        )}

        {showDeleteClubConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl transform animate-scale-in">
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Confirm Delete</h3>
                <p className="text-gray-600">
                  Are you sure you want to delete this organization? This action cannot be undone.
                </p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteClubConfirm(null)}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteClub(showDeleteClubConfirm)}
                  className="flex-1 px-6 py-3 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                >
                  Delete Organization
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit venue modal */}
        {editingVenue && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-md space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold text-gray-900">Edit Venue</h2>
                <button onClick={() => setEditingVenue(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Venue Name</label>
                  <input
                    type="text"
                    value={editVenueForm.name}
                    onChange={e => setEditVenueForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
                    <input
                      type="number"
                      min="1"
                      value={editVenueForm.capacity}
                      onChange={e => setEditVenueForm(f => ({ ...f, capacity: e.target.value }))}
                      placeholder="Max occupancy"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Location / Block</label>
                    <input
                      type="text"
                      list="venue-location-suggestions"
                      value={editVenueForm.location}
                      onChange={e => setEditVenueForm(f => ({ ...f, location: e.target.value }))}
                      placeholder="e.g. Block A, GF"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {locationSuggestions.length > 0 && (
                      <p className="text-[11px] text-gray-400 mt-1">
                        Existing: {locationSuggestions.join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm text-gray-700">Active</span>
                  <div className="inline-flex rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setEditVenueForm(f => ({ ...f, is_active: true }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${editVenueForm.is_active ? "bg-[#154CB3] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >Yes</button>
                    <button
                      type="button"
                      onClick={() => setEditVenueForm(f => ({ ...f, is_active: false }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${!editVenueForm.is_active ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >No</button>
                  </div>
                </div>
                <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                  <span className="text-sm text-gray-700">Needs Approval</span>
                  <div className="inline-flex rounded-lg border border-gray-200 shadow-sm overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setEditVenueForm(f => ({ ...f, is_approval_needed: true }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${editVenueForm.is_approval_needed ? "bg-[#154CB3] text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >Yes</button>
                    <button
                      type="button"
                      onClick={() => setEditVenueForm(f => ({ ...f, is_approval_needed: false }))}
                      className={`px-4 py-1.5 text-xs font-semibold transition-colors ${!editVenueForm.is_approval_needed ? "bg-red-500 text-white" : "bg-white text-gray-400 hover:bg-gray-50"}`}
                    >No</button>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <button
                  onClick={() => setEditingVenue(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >Cancel</button>
                <button
                  onClick={handleSaveVenueEdit}
                  disabled={editVenueSaving}
                  className="px-4 py-2 text-sm bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50"
                >{editVenueSaving ? "Saving…" : "Save Changes"}</button>
              </div>
            </div>
          </div>
        )}

        {/* Venue delete confirmation modal */}
        {deleteVenueId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Delete Venue</h2>
              <p className="text-sm text-gray-600">
                This will permanently delete the venue and cannot be undone.
                Existing approved service requests referencing this venue are not affected.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeleteVenueId(null)}
                  className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteVenue(deleteVenueId)}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
          </div>
        )}

        {/* ── Caterers Tab ─────────────────────────────────────────────────── */}
        {activeTab === "caterers" && (
          <div className="space-y-6">
            {/* Header */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
              <div>
                <h2 className="text-xl font-bold text-gray-900 mb-1">Catering Management</h2>
                <p className="text-sm text-gray-500">Add and manage catering vendors. Catering IDs are auto-generated from the vendor name.</p>
              </div>
            </div>

            {/* Add caterer form */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-5">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <PlusCircle className="w-4 h-4 text-[#154CB3]" /> Add New Caterer
              </h3>

              {/* Name + Location */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Caterer Name <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    value={catererForm.catering_name}
                    onChange={e => setCatererForm(f => ({ ...f, catering_name: e.target.value }))}
                    placeholder="e.g. Prestige Catering Co."
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                  {catererForm.catering_name.trim() && (
                    <p className="text-[11px] text-gray-400 mt-1">ID: <span className="font-mono text-gray-600">{catererForm.catering_name.toLowerCase().trim().replace(/[^\w\s-]/g,"").replace(/[\s_-]+/g,"-").replace(/^-+|-+$/g,"")}</span></p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                  <input
                    type="text"
                    value={catererForm.location}
                    onChange={e => setCatererForm(f => ({ ...f, location: e.target.value }))}
                    placeholder="e.g. Central Kitchen, Block C"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                  />
                </div>
              </div>

              {/* Campuses */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">Campuses Served</label>
                <div className="flex flex-wrap gap-2">
                  {christCampuses.map(campus => (
                    <label key={campus} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${catererForm.campuses.includes(campus) ? "bg-[#154CB3] text-white border-[#154CB3]" : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"}`}>
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={catererForm.campuses.includes(campus)}
                        onChange={e => setCatererForm(f => ({ ...f, campuses: e.target.checked ? [...f.campuses, campus] : f.campuses.filter(c => c !== campus) }))}
                      />
                      {campus}
                    </label>
                  ))}
                </div>
              </div>

              {/* Contacts */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-medium text-gray-600">Contact Details</label>
                  <button
                    type="button"
                    onClick={() => setCatererForm(f => ({ ...f, contacts: [...f.contacts, { name: "", email: "", mobile: "" }] }))}
                    className="text-xs text-[#154CB3] font-medium hover:underline"
                  >+ Add Contact</button>
                </div>
                <div className="space-y-3">
                  {catererForm.contacts.map((contact, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact {idx + 1}</span>
                        {catererForm.contacts.length > 1 && (
                          <button type="button" onClick={() => setCatererForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }))} className="text-gray-400 hover:text-red-500 text-sm leading-none">&times; Remove</button>
                        )}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Name</label>
                          <input type="text" value={contact.name} onChange={e => setCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, name: e.target.value } : c) }))} placeholder="Contact name" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Email</label>
                          <input type="email" value={contact.email} onChange={e => setCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, email: e.target.value } : c) }))} placeholder="email@example.com" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Mobile(s) — comma-separated</label>
                          <input type="text" value={contact.mobile} onChange={e => setCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, mobile: e.target.value } : c) }))} placeholder="9900001111, 9900002222" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {catererFormError && <p className="text-sm text-red-600">{catererFormError}</p>}
              <button
                type="button"
                onClick={handleCreateCaterer}
                disabled={catererSubmitting}
                className="px-5 py-2 text-sm font-semibold bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50"
              >
                {catererSubmitting ? "Adding…" : "Add Caterer"}
              </button>
            </div>

            {/* Caterers list */}
            <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
              {caterersLoading ? (
                <div className="p-8 text-center text-sm text-gray-400">Loading caterers…</div>
              ) : caterers.length === 0 ? (
                <div className="p-8 text-center text-sm text-gray-400">No caterers yet. Add one above.</div>
              ) : (
                <>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">ID</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Campuses</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Location</th>
                        <th className="text-left px-4 py-3 font-semibold text-gray-600">Contacts</th>
                        <th className="text-right px-4 py-3 font-semibold text-gray-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {caterers.slice((catererPage - 1) * CATERER_PAGE_SIZE, catererPage * CATERER_PAGE_SIZE).map(c => (
                        <tr key={c.catering_id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-3 font-medium text-gray-900">{c.catering_name}</td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{c.catering_id}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {c.campuses?.length > 0
                              ? <div className="flex flex-wrap gap-1">{c.campuses.map(campus => <span key={campus} className="px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded text-[11px]">{campus}</span>)}</div>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-600">{c.location || <span className="text-gray-400">—</span>}</td>
                          <td className="px-4 py-3 text-xs text-gray-600">
                            {c.contact_details?.length > 0
                              ? <div className="space-y-0.5">{c.contact_details.map((cd, i) => <div key={i} className="text-[11px]"><span className="font-medium">{cd.name}</span>{cd.mobile?.length > 0 && <span className="text-gray-400 ml-1">{cd.mobile.join(", ")}</span>}</div>)}</div>
                              : <span className="text-gray-400">—</span>}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => { setEditingCaterer(c); setEditCatererForm({ catering_name: c.catering_name, campuses: c.campuses || [], location: c.location || "", contacts: c.contact_details?.length > 0 ? c.contact_details.map(cd => ({ name: cd.name, email: cd.email, mobile: cd.mobile?.join(", ") || "" })) : [{ name: "", email: "", mobile: "" }] }); }}
                                className="p-1.5 text-gray-400 hover:text-[#154CB3] hover:bg-blue-50 rounded-lg transition-colors"
                                title="Edit"
                              ><Pencil className="w-3.5 h-3.5" /></button>
                              <button
                                onClick={() => setDeleteCatererId(c.catering_id)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              ><Trash2 className="w-3.5 h-3.5" /></button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {caterers.length > CATERER_PAGE_SIZE && (
                    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
                      <span>{caterers.length} caterers</span>
                      <div className="flex gap-2">
                        <button onClick={() => setCatererPage(p => Math.max(1, p - 1))} disabled={catererPage === 1} className="px-3 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50">Prev</button>
                        <button onClick={() => setCatererPage(p => p + 1)} disabled={catererPage * CATERER_PAGE_SIZE >= caterers.length} className="px-3 py-1 border border-gray-200 rounded-lg text-xs disabled:opacity-40 hover:bg-gray-50">Next</button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Edit caterer modal */}
            {editingCaterer && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl p-6 w-full max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex items-center justify-between">
                    <h2 className="text-base font-semibold text-gray-900">Edit Caterer</h2>
                    <button onClick={() => setEditingCaterer(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
                  </div>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Caterer Name</label>
                        <input type="text" value={editCatererForm.catering_name} onChange={e => setEditCatererForm(f => ({ ...f, catering_name: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Location</label>
                        <input type="text" value={editCatererForm.location} onChange={e => setEditCatererForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Block C, Ground Floor" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-2">Campuses Served</label>
                      <div className="flex flex-wrap gap-2">
                        {christCampuses.map(campus => (
                          <label key={campus} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-all ${editCatererForm.campuses.includes(campus) ? "bg-[#154CB3] text-white border-[#154CB3]" : "border-gray-300 text-gray-600 hover:border-gray-400"}`}>
                            <input type="checkbox" className="sr-only" checked={editCatererForm.campuses.includes(campus)} onChange={e => setEditCatererForm(f => ({ ...f, campuses: e.target.checked ? [...f.campuses, campus] : f.campuses.filter(c => c !== campus) }))} />
                            {campus}
                          </label>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-medium text-gray-600">Contacts</label>
                        <button type="button" onClick={() => setEditCatererForm(f => ({ ...f, contacts: [...f.contacts, { name: "", email: "", mobile: "" }] }))} className="text-xs text-[#154CB3] font-medium hover:underline">+ Add Contact</button>
                      </div>
                      <div className="space-y-3">
                        {editCatererForm.contacts.map((contact, idx) => (
                          <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200 relative">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Contact {idx + 1}</span>
                              {editCatererForm.contacts.length > 1 && (
                                <button type="button" onClick={() => setEditCatererForm(f => ({ ...f, contacts: f.contacts.filter((_, i) => i !== idx) }))} className="text-gray-400 hover:text-red-500 text-sm leading-none">&times; Remove</button>
                              )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">Name</label>
                              <input type="text" value={contact.name} onChange={e => setEditCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, name: e.target.value } : c) }))} placeholder="Contact name" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">Email</label>
                              <input type="email" value={contact.email} onChange={e => setEditCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, email: e.target.value } : c) }))} placeholder="email@example.com" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            <div>
                              <label className="block text-[11px] text-gray-500 mb-1">Mobile(s)</label>
                              <input type="text" value={contact.mobile} onChange={e => setEditCatererForm(f => ({ ...f, contacts: f.contacts.map((c, i) => i === idx ? { ...c, mobile: e.target.value } : c) }))} placeholder="9900001111, 9900002222" className="w-full border border-gray-300 rounded-md px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400" />
                            </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3 pt-1">
                    <button onClick={() => setEditingCaterer(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={handleSaveCatererEdit} disabled={editCatererSaving} className="px-4 py-2 text-sm bg-[#154CB3] text-white rounded-lg hover:bg-[#0f3a7a] disabled:opacity-50">{editCatererSaving ? "Saving…" : "Save Changes"}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Delete caterer confirmation modal */}
            {deleteCatererId && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
                  <h2 className="text-lg font-semibold text-gray-900">Delete Caterer</h2>
                  <p className="text-sm text-gray-600">This will permanently delete the caterer and cannot be undone.</p>
                  <div className="flex justify-end gap-3">
                    <button onClick={() => setDeleteCatererId(null)} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
                    <button onClick={() => handleDeleteCaterer(deleteCatererId)} className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700">Delete</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Roles Tab */}
        {activeTab === "roles" && (() => {
          const ASSIGN_ROLE_DEFS = [
            { key: "hod",      label: "HOD",             flag: "is_hod" as const },
            { key: "dean",     label: "Dean",            flag: "is_dean" as const },
            { key: "cfo",      label: "CFO",             flag: "is_cfo" as const },
            { key: "director", label: "Campus Dir",      flag: "is_campus_director" as const },
            { key: "accounts", label: "Finance Officer", flag: "is_accounts_office" as const },
          ] as const;
          const ROLE_DEFS = [
            { key: "organiser",  label: "Organiser",       flag: "is_organiser" as const },
            { key: "support",    label: "Support",         flag: "is_support" as const },
            { key: "masteradmin",label: "Master Admin",    flag: "is_masteradmin" as const },
            ...ASSIGN_ROLE_DEFS,
          ] as const;

          // Group role holders by user — one row per user, multiple role badges
          type UserRoleRow = { user: User; roles: Array<{ roleKey: string; roleLabel: string }> };
          const allUserRows: UserRoleRow[] = roleHolders
            .map(u => ({
              user: u,
              roles: ROLE_DEFS.filter(({ flag }) => u[flag]).map(({ key, label }) => ({ roleKey: key, roleLabel: label })),
            }))
            .filter(row => row.roles.length > 0);

          const filteredRows = allUserRows.filter(({ user, roles }) => {
            if (roleListRoleFilter !== "all" && !roles.some(r => r.roleKey === roleListRoleFilter)) return false;
            if (roleListDeptFilter && (user.department || "") !== roleListDeptFilter) return false;
            if (roleListSchoolFilter && (user.school || "") !== roleListSchoolFilter) return false;
            if (roleListCampusFilter && (user.campus || "") !== roleListCampusFilter) return false;
            if (roleListSearch) {
              const q = roleListSearch.toLowerCase();
              if (!user.email.toLowerCase().includes(q) && !(user.name || "").toLowerCase().includes(q)) return false;
            }
            return true;
          });

          const needsDept = roleListRoleFilter === "hod";
          const needsSchool = roleListRoleFilter === "dean";

          return (
            <div className="flex flex-col h-full overflow-hidden">
              {/* ── Assign form (compact) ── */}
              <div className="shrink-0 border-b border-gray-200 bg-white px-5 py-4 space-y-3">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Assign Role</p>
                <div className="flex gap-3 items-start flex-wrap">
                  {/* Email */}
                  <div className="relative min-w-[220px] flex-1">
                    <input
                      type="text"
                      value={roleEmailInput}
                      onChange={(e) => { setRoleEmailInput(e.target.value); setRoleSelectedEmail(""); searchRoleEmails(e.target.value); }}
                      placeholder="Email or name…"
                      className="w-full border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                    />
                    {roleEmailSuggestions.length > 0 && !roleSelectedEmail && (
                      <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                        {roleEmailSuggestions.map(s => (
                          <li key={s.email}>
                            <button type="button"
                              onClick={() => { setRoleSelectedEmail(s.email); setRoleEmailInput(s.email); setRoleEmailSuggestions([]); }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50"
                            >
                              <span className="font-medium">{s.name}</span>
                              {s.name !== s.email && <span className="text-gray-400 text-xs ml-2">{s.email}</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                    {roleSelectedEmail && <p className="mt-0.5 text-[11px] text-green-600 font-medium">✓ selected</p>}
                  </div>

                  {/* Role pills */}
                  <div className="flex gap-1.5 flex-wrap">
                    {ASSIGN_ROLE_DEFS.map(r => (
                      <button key={r.key} type="button"
                        onClick={() => { setRoleSelectedRole(r.key as any); setRoleSchool(""); setRoleDept(""); setRoleCampus(""); }}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${roleSelectedRole === r.key ? "bg-[#154cb3] text-white border-[#154cb3]" : "border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50"}`}
                      >{r.label}</button>
                    ))}
                  </div>
                </div>

                {/* Conditional context fields */}
                {roleSelectedRole && (
                  <div className="flex gap-3 flex-wrap items-end">
                    <div className="min-w-[160px]">
                      <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Campus</label>
                      <select value={roleCampus} onChange={e => setRoleCampus(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                        <option value="">Select…</option>
                        {christCampuses.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    {(roleSelectedRole === "hod" || roleSelectedRole === "dean") && (
                      <div className="min-w-[200px]">
                        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">School</label>
                        <select value={roleSchool} onChange={e => { setRoleSchool(e.target.value); setRoleDept(""); }}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300">
                          <option value="">Select…</option>
                          {organizingSchools.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                    )}
                    {roleSelectedRole === "hod" && (
                      <div className="min-w-[200px]">
                        <label className="block text-[11px] font-medium text-gray-500 mb-0.5">Department</label>
                        <select value={roleDept} onChange={e => setRoleDept(e.target.value)} disabled={!roleSchool}
                          className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-40">
                          <option value="">{roleSchool ? "Select…" : "Pick school first"}</option>
                          {getDepartmentOptionsForSchool(roleSchool).map(d => <option key={d.value} value={d.label}>{d.label}</option>)}
                        </select>
                      </div>
                    )}
                    <button onClick={saveApprovalRole}
                      disabled={!roleSelectedEmail || !roleSelectedRole || !roleCampus || (roleSelectedRole === "hod" && (!roleSchool || !roleDept)) || (roleSelectedRole === "dean" && !roleSchool) || roleSaving}
                      className="px-4 py-1.5 bg-[#154cb3] text-white rounded-lg text-sm font-semibold hover:bg-[#1240a0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
                    >{roleSaving ? "Saving…" : "Assign Role"}</button>
                  </div>
                )}
              </div>

              {/* ── Role holders list ── */}
              <div className="flex-1 overflow-y-auto">
                {/* Filter bar */}
                <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-5 py-3 flex gap-2 flex-wrap items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-widest mr-1">Filter</span>
                  <select value={roleListRoleFilter} onChange={e => { setRoleListRoleFilter(e.target.value); setRoleListDeptFilter(""); setRoleListSchoolFilter(""); }}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                    <option value="all">All Roles</option>
                    {ROLE_DEFS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
                  </select>
                  {needsDept && (
                    <select value={roleListDeptFilter} onChange={e => setRoleListDeptFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 max-w-[200px]">
                      <option value="">All Departments</option>
                      {[...new Set(roleHolders.filter(u => u.is_hod).map(u => u.department || "").filter(Boolean))].sort().map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  )}
                  {needsSchool && (
                    <select value={roleListSchoolFilter} onChange={e => setRoleListSchoolFilter(e.target.value)}
                      className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 max-w-[220px]">
                      <option value="">All Schools</option>
                      {organizingSchools.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                  )}
                  <select value={roleListCampusFilter} onChange={e => setRoleListCampusFilter(e.target.value)}
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-200">
                    <option value="">All Campuses</option>
                    {christCampuses.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <input value={roleListSearch} onChange={e => setRoleListSearch(e.target.value)}
                    placeholder="Search name / email…"
                    className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-blue-200 min-w-[150px]" />
                  <span className="ml-auto text-xs text-gray-400">{filteredRows.length} user{filteredRows.length !== 1 ? "s" : ""}</span>
                  <button onClick={() => exportRolesToCSV(filteredRows.flatMap(r => r.roles.map(role => ({ user: r.user, role: role.roleKey, roleLabel: role.roleLabel }))))}
                    className="ml-1 flex items-center gap-1.5 px-3 py-1 rounded-lg border border-gray-300 text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                    Export CSV
                  </button>
                  <button onClick={fetchRoleHolders} title="Refresh"
                    className="p-1 rounded-lg border border-gray-200 text-gray-400 hover:bg-gray-50 transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  </button>
                </div>

                {/* Table */}
                {roleHoldersLoading ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading…</div>
                ) : filteredRows.length === 0 ? (
                  <div className="flex items-center justify-center py-16 text-gray-400 text-sm">No role holders found.</div>
                ) : (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left">
                        <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                        <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                        <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Roles</th>
                        <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Dept / School</th>
                        <th className="px-5 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Campus</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const ROLE_COLORS: Record<string, string> = {
                          organiser:   "bg-indigo-100 text-indigo-700",
                          support:     "bg-teal-100 text-teal-700",
                          masteradmin: "bg-rose-100 text-rose-700",
                          hod:         "bg-purple-100 text-purple-700",
                          dean:        "bg-blue-100 text-blue-700",
                          cfo:         "bg-amber-100 text-amber-700",
                          director:    "bg-cyan-100 text-cyan-700",
                          accounts:    "bg-green-100 text-green-700",
                        };
                        return filteredRows.map(({ user, roles }, i) => (
                          <tr key={user.email} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i % 2 === 0 ? "" : "bg-slate-50/40"}`}>
                            <td className="px-5 py-2.5 font-medium text-gray-900 truncate max-w-[140px]">{user.name || "—"}</td>
                            <td className="px-5 py-2.5 text-gray-500 text-xs truncate max-w-[180px]">{user.email}</td>
                            <td className="px-5 py-2.5">
                              <div className="flex flex-wrap gap-1">
                                {roles.map(({ roleKey, roleLabel }) => {
                                  const removingThis = roleRemoving === `${user.email}:${roleKey}`;
                                  return (
                                    <span key={roleKey} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${ROLE_COLORS[roleKey] || "bg-gray-100 text-gray-600"}`}>
                                      {roleLabel}
                                      <button
                                        onClick={() => removeApprovalRole(user, roleKey)}
                                        disabled={!!roleRemoving}
                                        title={`Remove ${roleLabel} role`}
                                        className="opacity-50 hover:opacity-100 disabled:opacity-20 transition-opacity leading-none"
                                      >
                                        {removingThis
                                          ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>
                                          : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                        }
                                      </button>
                                    </span>
                                  );
                                })}
                              </div>
                            </td>
                            <td className="px-5 py-2.5 text-gray-600 text-xs truncate max-w-[200px]">{user.department || user.school || "—"}</td>
                            <td className="px-5 py-2.5 text-gray-500 text-xs truncate max-w-[160px]">{user.campus || "—"}</td>
                          </tr>
                        ));
                      })()}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          );
        })()}

      </main>
    </div>
  );
}

