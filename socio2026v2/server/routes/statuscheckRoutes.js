import express from "express";
import {
  queryAll,
  queryOne,
  insert,
  update,
  remove,
  supabase,
} from "../config/database.js";
import {
  authenticateUser,
  getUserInfo,
  checkRoleExpiration,
} from "../middleware/authMiddleware.js";
import { getFestTableForDatabase } from "../utils/festTableResolver.js";

const router = express.Router();

const MUTATION_CONFIRMATION_PHRASE = "I UNDERSTAND STATUSCHECK MUTATIONS";
const MAX_LOAD_ITERATIONS = 120;
const MAX_LOAD_CONCURRENCY = 12;

const ROUTE_GROUP_COVERAGE = [
  {
    group: "users",
    mount: "/api/users",
    probe: "/api/users?page=1&pageSize=5",
  },
  {
    group: "events",
    mount: "/api/events",
    probe: "/api/events?page=1&pageSize=5",
  },
  {
    group: "fests",
    mount: "/api/fests",
    probe: "/api/fests?page=1&pageSize=5",
  },
  {
    group: "registrations",
    mount: "/api/registrations",
    probe: "/api/registrations",
  },
  {
    group: "attendance",
    mount: "/api/events/:eventId/participants",
    probe: "dynamic",
  },
  {
    group: "notifications",
    mount: "/api/notifications/*",
    probe: "/api/notifications/admin/history",
  },
  {
    group: "upload",
    mount: "/api/upload/*",
    probe: "manual (multipart required)",
  },
  {
    group: "contact/support",
    mount: "/api/contact, /api/support/messages",
    probe: "/api/contact",
  },
  {
    group: "chat",
    mount: "/api/chat",
    probe: "/api/chat/health",
  },
  {
    group: "report",
    mount: "/api/report/data",
    probe: "dynamic",
  },
];

router.use(
  authenticateUser,
  getUserInfo(),
  checkRoleExpiration,
  (req, res, next) => {
    const canAccessStatuscheck = Boolean(req.userInfo?.is_masteradmin || req.userInfo?.is_organiser);

    if (!canAccessStatuscheck) {
      return res.status(403).json({
        error: "Access denied: organiser or masteradmin privileges required",
      });
    }

    return next();
  }
);

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function buildApiBaseUrl(req) {
  const forwardedHost = String(req.headers["x-forwarded-host"] || "").split(",")[0].trim();
  const directHost = req.headers.host;
  const host = forwardedHost || directHost;

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  const protocol = forwardedProto || req.protocol || "http";

  if (host) {
    return `${protocol}://${host}`;
  }

  const envBase =
    process.env.STATUSCHECK_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "";

  return envBase.replace(/\/api\/?$/, "") || "http://localhost:8000";
}

function buildAuthHeaders(req, isJson = true) {
  const headers = {
    Accept: "application/json",
  };

  if (req.headers.authorization) {
    headers.Authorization = req.headers.authorization;
  }

  if (req.userInfo?.email) {
    headers["X-User-Email"] = req.userInfo.email;
  }

  if (isJson) {
    headers["Content-Type"] = "application/json";
  }

  return headers;
}

function summarizePayload(payload) {
  if (payload === null || payload === undefined) {
    return null;
  }

  if (Array.isArray(payload)) {
    return { type: "array", length: payload.length };
  }

  if (typeof payload === "object") {
    return {
      type: "object",
      keys: Object.keys(payload).slice(0, 12),
    };
  }

  if (typeof payload === "string") {
    return payload.slice(0, 200);
  }

  return payload;
}

function calcPercentile(values, percentile) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sorted.length) - 1)
  );
  return Number(sorted[index].toFixed(2));
}

function buildSkippedResult(name, reason) {
  return {
    name,
    ok: false,
    status: "skipped",
    durationMs: 0,
    reason,
  };
}

async function probeEndpoint(req, apiBaseUrl, probeConfig) {
  const {
    name,
    path,
    method = "GET",
    body,
    expectedStatuses = [200],
  } = probeConfig;

  const startedAt = Date.now();
  const targetUrl = `${apiBaseUrl}${path}`;

  try {
    const response = await fetch(targetUrl, {
      method,
      headers: buildAuthHeaders(req, body !== undefined),
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const elapsed = Date.now() - startedAt;
    const rawText = await response.text();

    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch (_error) {
      parsed = rawText;
    }

    const ok = expectedStatuses.includes(response.status);

    return {
      name,
      method,
      path,
      ok,
      status: response.status,
      durationMs: elapsed,
      payload: summarizePayload(parsed),
      message: ok ? "Probe succeeded" : "Unexpected response status",
    };
  } catch (error) {
    return {
      name,
      method,
      path,
      ok: false,
      status: "network_error",
      durationMs: Date.now() - startedAt,
      message: error?.message || "Request failed",
    };
  }
}

async function getSampleRows() {
  const [events, users] = await Promise.all([
    queryAll("events", {
      select: "event_id,title,created_at,fest_id,fest",
      order: { column: "created_at", ascending: false },
      limit: 3,
    }).catch(() => []),
    queryAll("users", {
      select: "email,created_at",
      order: { column: "created_at", ascending: false },
      limit: 3,
    }).catch(() => []),
  ]);

  let fests = [];
  try {
    const festTable = await getFestTableForDatabase(queryAll);
    fests = await queryAll(festTable, {
      select: "fest_id,fest_title,created_at",
      order: { column: "created_at", ascending: false },
      limit: 3,
    });
  } catch (_error) {
    fests = [];
  }

  return {
    sampleEventId: events?.[0]?.event_id || null,
    sampleFestId: fests?.[0]?.fest_id || null,
    sampleUserEmail: users?.[0]?.email || null,
  };
}

async function runFetchDisplayChecks(req, apiBaseUrl, sampleRows) {
  const checks = [];

  const eventsProbe = await probeEndpoint(req, apiBaseUrl, {
    name: "Events fetch/display",
    path: "/api/events?page=1&pageSize=5",
    method: "GET",
    expectedStatuses: [200],
  });

  checks.push({
    ...eventsProbe,
    ok:
      eventsProbe.ok &&
      Array.isArray(eventsProbe.payload?.keys)
        ? true
        : eventsProbe.ok,
  });

  const festsProbe = await probeEndpoint(req, apiBaseUrl, {
    name: "Fests fetch/display",
    path: "/api/fests?page=1&pageSize=5",
    method: "GET",
    expectedStatuses: [200],
  });
  checks.push(festsProbe);

  const usersProbe = await probeEndpoint(req, apiBaseUrl, {
    name: "Users fetch/display (admin)",
    path: "/api/users?page=1&pageSize=5",
    method: "GET",
    expectedStatuses: [200],
  });
  checks.push(usersProbe);

  const notificationsProbe = await probeEndpoint(req, apiBaseUrl, {
    name: "Notification history display",
    path: "/api/notifications/admin/history",
    method: "GET",
    expectedStatuses: [200],
  });
  checks.push(notificationsProbe);

  if (sampleRows.sampleEventId) {
    checks.push(
      await probeEndpoint(req, apiBaseUrl, {
        name: "Participant list display",
        path: `/api/events/${encodeURIComponent(sampleRows.sampleEventId)}/participants`,
        method: "GET",
        expectedStatuses: [200],
      })
    );
  } else {
    checks.push(buildSkippedResult("Participant list display", "No event available for participant fetch test"));
  }

  return checks;
}

async function runWorkflowChecks(req, apiBaseUrl, sampleRows) {
  const checks = [];

  if (!sampleRows.sampleEventId) {
    checks.push(buildSkippedResult("Report generation workflow", "No event exists to run report workflow"));
  } else {
    checks.push(
      await probeEndpoint(req, apiBaseUrl, {
        name: "Report generation workflow",
        path: "/api/report/data",
        method: "POST",
        body: {
          eventIds: [sampleRows.sampleEventId],
          festId: sampleRows.sampleFestId || undefined,
        },
        expectedStatuses: [200],
      })
    );
  }

  checks.push(
    await probeEndpoint(req, apiBaseUrl, {
      name: "Notifications workflow (history)",
      path: "/api/notifications/admin/history",
      method: "GET",
      expectedStatuses: [200],
    })
  );

  checks.push(
    await probeEndpoint(req, apiBaseUrl, {
      name: "Registrations workflow (list)",
      path: sampleRows.sampleEventId
        ? `/api/registrations?event_id=${encodeURIComponent(sampleRows.sampleEventId)}`
        : "/api/registrations",
      method: "GET",
      expectedStatuses: [200],
    })
  );

  checks.push(
    await probeEndpoint(req, apiBaseUrl, {
      name: "Chat workflow health",
      path: "/api/chat/health",
      method: "GET",
      expectedStatuses: [200],
    })
  );

  return checks;
}

function normalizeDateOnly(dateObj = new Date()) {
  return dateObj.toISOString().slice(0, 10);
}

async function runMutationChecks(req) {
  const checks = [];
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = normalizeDateOnly();
  let festTable = null;
  let createdFestId = null;
  let createdEventId = null;
  let createdNotificationId = null;

  try {
    festTable = await getFestTableForDatabase(queryAll);

    createdFestId = `statuscheck-fest-${stamp}`;
    createdEventId = `statuscheck-event-${stamp}`;

    const festInsertResult = await insert(festTable, [
      {
        fest_id: createdFestId,
        fest_title: `Statuscheck Fest ${stamp}`,
        description: "Synthetic statuscheck fest row",
        organizing_dept: "STATUSCHECK",
        opening_date: today,
        closing_date: today,
        created_by: req.userInfo.email,
        auth_uuid: req.userId,
      },
    ]);

    checks.push({
      name: "Fest insert",
      ok: Array.isArray(festInsertResult) && festInsertResult.length > 0,
      details: { fest_id: createdFestId },
    });

    const eventPayload = {
      event_id: createdEventId,
      title: `Statuscheck Event ${stamp}`,
      description: "Synthetic statuscheck event row",
      event_date: today,
      event_time: "12:00:00",
      venue: "Statuscheck Lab",
      organizing_dept: "STATUSCHECK",
      created_by: req.userInfo.email,
      auth_uuid: req.userId,
      total_participants: 0,
      ...(festTable === "fests" ? { fest_id: createdFestId } : { fest: createdFestId }),
    };

    const eventInsertResult = await insert("events", [eventPayload]);

    checks.push({
      name: "Event insert",
      ok: Array.isArray(eventInsertResult) && eventInsertResult.length > 0,
      details: { event_id: createdEventId, fest_id: createdFestId },
    });

    const updatedEventResult = await update(
      "events",
      { title: `Statuscheck Event ${stamp} Updated` },
      { event_id: createdEventId }
    );

    checks.push({
      name: "Event update",
      ok: Array.isArray(updatedEventResult) && updatedEventResult.length > 0,
      details: { event_id: createdEventId },
    });

    try {
      await update(
        "events",
        {
          is_archived: true,
          archived_at: new Date().toISOString(),
          archived_by: req.userInfo.email,
        },
        { event_id: createdEventId }
      );
      await update(
        "events",
        {
          is_archived: false,
          archived_at: null,
          archived_by: null,
        },
        { event_id: createdEventId }
      );

      checks.push({
        name: "Event archive/unarchive",
        ok: true,
        details: { event_id: createdEventId },
      });
    } catch (archiveError) {
      checks.push({
        name: "Event archive/unarchive",
        ok: false,
        details: {
          event_id: createdEventId,
          warning: archiveError?.message || "Archive columns unavailable",
        },
      });
    }

    const updatedFestResult = await update(
      festTable,
      { description: "Synthetic statuscheck fest row (updated)" },
      { fest_id: createdFestId }
    );

    checks.push({
      name: "Fest update",
      ok: Array.isArray(updatedFestResult) && updatedFestResult.length > 0,
      details: { fest_id: createdFestId },
    });

    const notificationInsert = await insert("notifications", [
      {
        user_email: req.userInfo.email,
        title: `Statuscheck Notification ${stamp}`,
        message: "Synthetic notification for mutation test",
        type: "system",
        read: false,
        action_url: "/statuscheck",
      },
    ]);

    createdNotificationId = notificationInsert?.[0]?.id || null;

    checks.push({
      name: "Notification insert",
      ok: Boolean(createdNotificationId),
      details: { notification_id: createdNotificationId },
    });

    if (createdNotificationId) {
      await remove("notifications", { id: createdNotificationId });
      const notificationAfterDelete = await queryOne("notifications", {
        where: { id: createdNotificationId },
      });

      checks.push({
        name: "Notification delete",
        ok: !notificationAfterDelete,
        details: { notification_id: createdNotificationId },
      });
    }

    await remove("events", { event_id: createdEventId });
    const eventAfterDelete = await queryOne("events", { where: { event_id: createdEventId } });

    checks.push({
      name: "Event delete",
      ok: !eventAfterDelete,
      details: { event_id: createdEventId },
    });

    await remove(festTable, { fest_id: createdFestId });
    const festAfterDelete = await queryOne(festTable, { where: { fest_id: createdFestId } });

    checks.push({
      name: "Fest delete",
      ok: !festAfterDelete,
      details: { fest_id: createdFestId },
    });
  } catch (error) {
    checks.push({
      name: "Mutation workflow",
      ok: false,
      details: {
        error: error?.message || "Mutation checks failed",
      },
    });
  } finally {
    // Cleanup to keep test rows out of production data.
    if (createdNotificationId) {
      await remove("notifications", { id: createdNotificationId }).catch(() => {});
    }
    if (createdEventId) {
      await remove("events", { event_id: createdEventId }).catch(() => {});
    }
    if (createdFestId && festTable) {
      await remove(festTable, { fest_id: createdFestId }).catch(() => {});
    }
  }

  return checks;
}

router.post("/insert-dummy-event", async (req, res) => {
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = normalizeDateOnly();
  const eventId = `statuscheck-dummy-event-${stamp}`;
  const eventTitle = `Statuscheck Dummy Event ${stamp}`;

  try {
    const festTable = await getFestTableForDatabase(queryAll).catch(() => null);
    const sampleRows = await getSampleRows();

    const eventPayload = {
      event_id: eventId,
      title: eventTitle,
      description:
        "Dummy event inserted by StatusCheck to validate database write connectivity. No image/banner/pdf attached.",
      event_date: today,
      event_time: "12:00:00",
      venue: "Statuscheck Sandbox",
      organizing_dept: "STATUSCHECK",
      created_by: req.userInfo.email,
      auth_uuid: req.userId,
      total_participants: 0,
      organizer_email: req.userInfo.email,
      event_image_url: null,
      banner_url: null,
      pdf_url: null,
      department_access: [],
      rules: [],
      schedule: [],
      prizes: [],
      custom_fields: [],
      claims_applicable: false,
      allow_outsiders: false,
      registration_fee: null,
      outsider_registration_fee: null,
      participants_per_team: 1,
      max_participants: null,
      outsider_max_participants: null,
    };

    if (sampleRows?.sampleFestId) {
      if (festTable === "fests") {
        eventPayload.fest_id = sampleRows.sampleFestId;
        eventPayload.fest = sampleRows.sampleFestId;
      } else {
        eventPayload.fest = sampleRows.sampleFestId;
      }
    }

    const insertedRows = await insert("events", [eventPayload]);
    const createdEvent = insertedRows?.[0] || null;

    if (!createdEvent) {
      throw new Error("Dummy event insert returned no rows");
    }

    return res.status(201).json({
      ok: true,
      message: "Dummy event inserted successfully",
      event: {
        event_id: createdEvent.event_id,
        title: createdEvent.title,
        description: createdEvent.description,
        event_date: createdEvent.event_date,
        event_time: createdEvent.event_time,
        venue: createdEvent.venue,
        fest_id: createdEvent.fest_id || createdEvent.fest || null,
        event_image_url: createdEvent.event_image_url || null,
        banner_url: createdEvent.banner_url || null,
        pdf_url: createdEvent.pdf_url || null,
        created_at: createdEvent.created_at || null,
        created_by: createdEvent.created_by || null,
      },
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error?.message || "Failed to insert dummy event",
    });
  }
});

function buildLoadTargetPath(target, sampleRows, customPath = "") {
  const normalizedTarget = String(target || "events").trim().toLowerCase();

  if (normalizedTarget === "custom") {
    const custom = String(customPath || "").trim();
    if (!custom) return null;
    return custom.startsWith("/") ? custom : `/${custom}`;
  }

  if (normalizedTarget === "events") return "/api/events?page=1&pageSize=10";
  if (normalizedTarget === "fests") return "/api/fests?page=1&pageSize=10";
  if (normalizedTarget === "users") return "/api/users?page=1&pageSize=10";
  if (normalizedTarget === "notifications") return "/api/notifications/admin/history";
  if (normalizedTarget === "registrations") {
    return sampleRows.sampleEventId
      ? `/api/registrations?event_id=${encodeURIComponent(sampleRows.sampleEventId)}`
      : "/api/registrations";
  }
  if (normalizedTarget === "participants") {
    return sampleRows.sampleEventId
      ? `/api/events/${encodeURIComponent(sampleRows.sampleEventId)}/participants`
      : null;
  }
  if (normalizedTarget === "chat") return "/api/chat/health";

  return null;
}

async function runLoadCheck(req, apiBaseUrl, loadConfig = {}, sampleRows = {}) {
  const iterations = clampNumber(loadConfig.iterations, 1, MAX_LOAD_ITERATIONS, 20);
  const concurrency = clampNumber(loadConfig.concurrency, 1, MAX_LOAD_CONCURRENCY, 4);
  const target = loadConfig.target || "events";
  const targetPath = buildLoadTargetPath(target, sampleRows, loadConfig.customPath);

  if (!targetPath) {
    return {
      ok: false,
      target,
      message: "Invalid or unavailable load target",
    };
  }

  const targetUrl = `${apiBaseUrl}${targetPath}`;
  const durations = [];
  const failures = [];
  let completed = 0;
  let requestIndex = 0;

  const runWorker = async () => {
    while (true) {
      const current = requestIndex;
      requestIndex += 1;

      if (current >= iterations) {
        return;
      }

      const startedAt = Date.now();
      try {
        const response = await fetch(targetUrl, {
          method: "GET",
          headers: buildAuthHeaders(req, false),
        });

        await response.text();

        const duration = Date.now() - startedAt;
        durations.push(duration);

        if (!response.ok) {
          failures.push({
            index: current,
            status: response.status,
            durationMs: duration,
          });
        }
      } catch (error) {
        failures.push({
          index: current,
          status: "network_error",
          durationMs: Date.now() - startedAt,
          message: error?.message || "Network error",
        });
      } finally {
        completed += 1;
      }
    }
  };

  const startedAt = Date.now();
  const workers = Array.from({ length: concurrency }, () => runWorker());
  await Promise.all(workers);
  const totalDurationMs = Date.now() - startedAt;

  const successCount = completed - failures.length;
  const sortedDurations = [...durations].sort((a, b) => a - b);

  return {
    ok: failures.length === 0,
    target,
    targetPath,
    iterations,
    concurrency,
    completed,
    successCount,
    failureCount: failures.length,
    errorRatePercent: Number(((failures.length / Math.max(completed, 1)) * 100).toFixed(2)),
    totalDurationMs,
    avgMs: durations.length
      ? Number((durations.reduce((sum, current) => sum + current, 0) / durations.length).toFixed(2))
      : 0,
    minMs: sortedDurations.length ? sortedDurations[0] : 0,
    maxMs: sortedDurations.length ? sortedDurations[sortedDurations.length - 1] : 0,
    p50Ms: calcPercentile(durations, 50),
    p95Ms: calcPercentile(durations, 95),
    failures: failures.slice(0, 10),
  };
}

async function getTableCounts() {
  const tables = [
    "users",
    "events",
    "fests",
    "registrations",
    "attendance_status",
    "notifications",
    "notification_user_status",
    "contact_messages",
    "qr_scan_logs",
  ];

  const results = await Promise.all(
    tables.map(async (table) => {
      try {
        const { count, error } = await supabase
          .from(table)
          .select("*", { count: "exact", head: true });

        if (error) {
          return {
            table,
            ok: false,
            count: null,
            error: error.message,
          };
        }

        return {
          table,
          ok: true,
          count: count ?? 0,
        };
      } catch (error) {
        return {
          table,
          ok: false,
          count: null,
          error: error?.message || "Unable to query table",
        };
      }
    })
  );

  return results;
}

function countByStatus(results = []) {
  const passed = results.filter((item) => item.ok).length;
  const failed = results.filter((item) => !item.ok && item.status !== "skipped").length;
  const skipped = results.filter((item) => item.status === "skipped").length;

  return { passed, failed, skipped, total: results.length };
}

router.get("/summary", async (req, res) => {
  const startedAt = Date.now();
  const apiBaseUrl = buildApiBaseUrl(req);

  let dbHealth = { ok: true, message: "Database reachable" };
  try {
    await queryAll("users", { select: "id", limit: 1 });
  } catch (error) {
    dbHealth = {
      ok: false,
      message: error?.message || "Database probe failed",
    };
  }

  const [sampleRows, tableCounts] = await Promise.all([getSampleRows(), getTableCounts()]);

  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    requestedBy: req.userInfo.email,
    apiBaseUrl,
    dbHealth,
    sampleRows,
    tableCounts,
    routeCoverage: ROUTE_GROUP_COVERAGE,
    mutatingChecks: {
      enabled: false,
      confirmationRequired: MUTATION_CONFIRMATION_PHRASE,
    },
  });
});

router.post("/run", async (req, res) => {
  const startedAt = Date.now();
  const apiBaseUrl = buildApiBaseUrl(req);

  const includeMutations = Boolean(req.body?.includeMutations);
  const confirmation = String(req.body?.confirmation || "").trim();

  if (includeMutations && confirmation !== MUTATION_CONFIRMATION_PHRASE) {
    return res.status(400).json({
      ok: false,
      error: "Mutation confirmation phrase mismatch",
      required: MUTATION_CONFIRMATION_PHRASE,
    });
  }

  const sampleRows = await getSampleRows();

  const endpointChecks = await Promise.all([
    probeEndpoint(req, apiBaseUrl, {
      name: "Root service",
      path: "/",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Events endpoint",
      path: "/api/events?page=1&pageSize=5",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Fests endpoint",
      path: "/api/fests?page=1&pageSize=5",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Users endpoint",
      path: "/api/users?page=1&pageSize=5",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Notifications endpoint",
      path: "/api/notifications/admin/history",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Registrations endpoint",
      path: sampleRows.sampleEventId
        ? `/api/registrations?event_id=${encodeURIComponent(sampleRows.sampleEventId)}`
        : "/api/registrations",
      method: "GET",
      expectedStatuses: [200],
    }),
    probeEndpoint(req, apiBaseUrl, {
      name: "Chat endpoint",
      path: "/api/chat/health",
      method: "GET",
      expectedStatuses: [200],
    }),
  ]);

  if (sampleRows.sampleEventId) {
    endpointChecks.push(
      await probeEndpoint(req, apiBaseUrl, {
        name: "Attendance participants endpoint",
        path: `/api/events/${encodeURIComponent(sampleRows.sampleEventId)}/participants`,
        method: "GET",
        expectedStatuses: [200],
      })
    );
  } else {
    endpointChecks.push(
      buildSkippedResult("Attendance participants endpoint", "No event available for attendance probe")
    );
  }

  const [fetchDisplayChecks, workflowChecks, mutationChecks] = await Promise.all([
    runFetchDisplayChecks(req, apiBaseUrl, sampleRows),
    runWorkflowChecks(req, apiBaseUrl, sampleRows),
    includeMutations ? runMutationChecks(req) : Promise.resolve([buildSkippedResult("Mutation workflows", "Mutating checks disabled")]),
  ]);

  let loadCheck = null;
  if (req.body?.runLoad === true) {
    loadCheck = await runLoadCheck(req, apiBaseUrl, req.body?.loadConfig || {}, sampleRows);
  }

  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    includeMutations,
    requestedBy: req.userInfo.email,
    sampleRows,
    endpointChecks,
    fetchDisplayChecks,
    workflowChecks,
    mutationChecks,
    loadCheck,
    summary: {
      endpoints: countByStatus(endpointChecks),
      fetchDisplay: countByStatus(fetchDisplayChecks),
      workflows: countByStatus(workflowChecks),
      mutations: countByStatus(mutationChecks),
    },
  });
});

router.post("/load", async (req, res) => {
  const apiBaseUrl = buildApiBaseUrl(req);
  const sampleRows = await getSampleRows();
  const loadResult = await runLoadCheck(req, apiBaseUrl, req.body || {}, sampleRows);

  if (!loadResult.ok && loadResult.message) {
    return res.status(400).json(loadResult);
  }

  return res.status(200).json({
    ok: true,
    checkedAt: new Date().toISOString(),
    requestedBy: req.userInfo.email,
    result: loadResult,
  });
});

export default router;
export { MUTATION_CONFIRMATION_PHRASE };
