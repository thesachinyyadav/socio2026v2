import { queryAll } from "../config/database.js";

const CACHE_TTL_MS = 60 * 1000;
const analyticsCache = new Map();

function toDate(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function normalizeText(value, fallback = "Unknown") {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed : fallback;
}

function normalizeEmail(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed || null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return (numerator / denominator) * 100;
}

function pctChange(currentValue, previousValue) {
  if (previousValue === 0) {
    return currentValue === 0 ? 0 : 100;
  }
  return ((currentValue - previousValue) / previousValue) * 100;
}

function round(value, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseRange(query = {}) {
  const now = new Date();
  const defaultDays = clamp(toNumber(query.days, 90), 7, 365);

  const requestedStart = toDate(query.start);
  const requestedEnd = toDate(query.end);

  const end = requestedEnd ?? now;
  const start = requestedStart ?? new Date(end.getTime() - defaultDays * 24 * 60 * 60 * 1000);

  if (start > end) {
    return parseRange({ days: defaultDays });
  }

  const durationMs = end.getTime() - start.getTime();
  const previousEnd = new Date(start.getTime() - 1);
  const previousStart = new Date(previousEnd.getTime() - durationMs);

  return {
    current: { start, end },
    previous: { start: previousStart, end: previousEnd },
    days: defaultDays,
  };
}

function inRange(date, range) {
  if (!date) return false;
  return date >= range.start && date <= range.end;
}

function getMonthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getWeekday(date) {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function extractHour(value) {
  if (!value || typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;

  const basic = raw.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!basic) return null;

  let hour = Number(basic[1]);
  const meridiem = raw.toLowerCase().includes("pm") ? "pm" : raw.toLowerCase().includes("am") ? "am" : null;

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  if (!Number.isFinite(hour) || hour < 0 || hour > 23) return null;
  return hour;
}

function chooseStudentId(registration) {
  return (
    registration.student_id ||
    registration.studentId ||
    registration.user_email ||
    registration.individual_email ||
    registration.team_leader_email ||
    null
  );
}

function chooseRegistrationDate(registration) {
  return toDate(registration.registered_at || registration.registeredAt || registration.created_at);
}

function chooseFeedback(registration) {
  const rating =
    registration.feedback_rating ??
    registration.feedbackRating ??
    registration.rating ??
    registration.event_rating;

  const numeric = toNumber(rating, NaN);
  if (Number.isFinite(numeric) && numeric >= 1 && numeric <= 5) return numeric;
  return null;
}

function chooseAttendance(registration, attendanceMap) {
  if (typeof registration.attended === "boolean") {
    return registration.attended;
  }

  const registrationId = registration.registration_id || registration.registrationId;
  const status = registrationId ? attendanceMap.get(registrationId) : null;
  return status === "attended";
}

function calculateEngagementScore(attendedCount, organizedCount, noShowCount) {
  return attendedCount * 5 + organizedCount * 10 - noShowCount * 3;
}

function getCacheKey(range) {
  return `${range.current.start.toISOString()}::${range.current.end.toISOString()}`;
}

function getCachedPayload(cacheKey) {
  const entry = analyticsCache.get(cacheKey);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
    analyticsCache.delete(cacheKey);
    return null;
  }
  return entry.payload;
}

function setCachedPayload(cacheKey, payload) {
  analyticsCache.set(cacheKey, { createdAt: Date.now(), payload });
}

function formatHourLabel(hour) {
  const normalized = clamp(hour, 0, 23);
  const suffix = normalized >= 12 ? "PM" : "AM";
  const display = normalized % 12 === 0 ? 12 : normalized % 12;
  return `${display} ${suffix}`;
}

function getKpiBundle(currentRows, previousRows, allRows, totalStudents) {
  const summarize = (rows) => {
    const uniqueStudents = new Set(rows.map((row) => row.studentId).filter(Boolean)).size;
    const registrations = rows.length;
    const attended = rows.filter((row) => row.attended).length;
    const activeStudentsPct = percent(uniqueStudents, totalStudents);

    return {
      participationRate: percent(uniqueStudents, totalStudents),
      attendanceRate: percent(attended, registrations),
      dropOffRate: percent(registrations - attended, registrations),
      avgEventsPerStudent: uniqueStudents ? registrations / uniqueStudents : 0,
      activeStudentsPct,
    };
  };

  const currentStats = summarize(currentRows);
  const previousStats = summarize(previousRows);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const activeLast30Students = new Set(
    allRows.filter((row) => row.registeredAt && row.registeredAt >= thirtyDaysAgo).map((row) => row.studentId)
  ).size;

  currentStats.activeStudentsPct = percent(activeLast30Students, totalStudents);

  return {
    kpis: [
      {
        key: "participationRate",
        label: "Participation Rate",
        value: round(currentStats.participationRate, 1),
        unit: "%",
        changePct: round(pctChange(currentStats.participationRate, previousStats.participationRate), 1),
      },
      {
        key: "attendanceRate",
        label: "Attendance Rate",
        value: round(currentStats.attendanceRate, 1),
        unit: "%",
        changePct: round(pctChange(currentStats.attendanceRate, previousStats.attendanceRate), 1),
      },
      {
        key: "dropOffRate",
        label: "Drop-off Rate",
        value: round(currentStats.dropOffRate, 1),
        unit: "%",
        changePct: round(pctChange(currentStats.dropOffRate, previousStats.dropOffRate), 1),
      },
      {
        key: "avgEventsPerStudent",
        label: "Avg Events / Student",
        value: round(currentStats.avgEventsPerStudent, 2),
        unit: "",
        changePct: round(pctChange(currentStats.avgEventsPerStudent, previousStats.avgEventsPerStudent), 1),
      },
      {
        key: "activeStudentsPct",
        label: "Active Students (30d)",
        value: round(currentStats.activeStudentsPct, 1),
        unit: "%",
        changePct: round(pctChange(currentStats.activeStudentsPct, previousStats.activeStudentsPct), 1),
      },
    ],
    currentStats,
    previousStats,
  };
}

function getStudentAnalytics(students, currentRows, previousRows, events, referenceDate) {
  const byStudent = new Map();

  const organizedCounts = new Map();
  events.forEach((event) => {
    const organizerStudentId = event.organizerStudentId;
    if (!organizerStudentId) return;
    organizedCounts.set(organizerStudentId, (organizedCounts.get(organizerStudentId) ?? 0) + 1);
  });

  const previousAttendanceByStudent = new Map();
  previousRows.forEach((row) => {
    if (!row.studentId || !row.attended) return;
    previousAttendanceByStudent.set(row.studentId, (previousAttendanceByStudent.get(row.studentId) ?? 0) + 1);
  });

  students.forEach((student) => {
    const key = student.studentId;
    byStudent.set(key, {
      studentId: key,
      name: student.name,
      department: student.department,
      year: student.year,
      registeredCount: 0,
      attendedCount: 0,
      noShows: 0,
      feedbackCount: 0,
      feedbackAverage: 0,
      feedbackTotal: 0,
      lastActivityAt: null,
      organizedCount: organizedCounts.get(key) ?? 0,
      engagementScore: 0,
      noShowRate: 0,
      currentAttendedCount: 0,
      previousAttendedCount: previousAttendanceByStudent.get(key) ?? 0,
      engagementDrop: 0,
      status: "inactive",
      atRiskReason: null,
    });
  });

  currentRows.forEach((row) => {
    const key = row.studentId;
    if (!key) return;

    if (!byStudent.has(key)) {
      byStudent.set(key, {
        studentId: key,
        name: row.studentName || "Unknown Student",
        department: row.studentDepartment,
        year: row.studentYear,
        registeredCount: 0,
        attendedCount: 0,
        noShows: 0,
        feedbackCount: 0,
        feedbackAverage: 0,
        feedbackTotal: 0,
        lastActivityAt: null,
        organizedCount: organizedCounts.get(key) ?? 0,
        engagementScore: 0,
        noShowRate: 0,
        currentAttendedCount: 0,
        previousAttendedCount: previousAttendanceByStudent.get(key) ?? 0,
        engagementDrop: 0,
        status: "inactive",
        atRiskReason: null,
      });
    }

    const item = byStudent.get(key);
    item.registeredCount += 1;
    if (row.attended) {
      item.attendedCount += 1;
      item.currentAttendedCount += 1;
    } else {
      item.noShows += 1;
    }

    if (row.feedbackRating) {
      item.feedbackCount += 1;
      item.feedbackTotal += row.feedbackRating;
    }

    if (row.registeredAt && (!item.lastActivityAt || row.registeredAt > item.lastActivityAt)) {
      item.lastActivityAt = row.registeredAt;
    }
  });

  const inactivityCutoff = new Date(referenceDate);
  inactivityCutoff.setDate(inactivityCutoff.getDate() - 30);

  const rowsOut = Array.from(byStudent.values()).map((item) => {
    item.feedbackAverage = item.feedbackCount > 0 ? item.feedbackTotal / item.feedbackCount : 0;
    item.engagementScore = calculateEngagementScore(item.attendedCount, item.organizedCount, item.noShows);
    item.noShowRate = percent(item.noShows, item.registeredCount);

    item.engagementDrop =
      item.previousAttendedCount > 0
        ? percent(item.previousAttendedCount - item.currentAttendedCount, item.previousAttendedCount)
        : 0;

    const isActive = item.lastActivityAt && item.lastActivityAt >= inactivityCutoff;
    item.status = isActive ? "active" : "inactive";

    if (!isActive) {
      item.atRiskReason = "No activity in last 30 days";
    } else if (item.engagementScore <= 0) {
      item.atRiskReason = "Low engagement score";
    }

    return {
      ...item,
      feedbackAverage: round(item.feedbackAverage, 2),
      engagementScore: round(item.engagementScore, 1),
      noShowRate: round(item.noShowRate, 1),
      organizedCount: item.organizedCount,
      currentAttendedCount: item.currentAttendedCount,
      previousAttendedCount: item.previousAttendedCount,
      engagementDrop: round(item.engagementDrop, 1),
      lastActivityAt: item.lastActivityAt ? item.lastActivityAt.toISOString() : null,
    };
  });

  const active = rowsOut.filter((row) => row.status === "active").length;
  const inactive = rowsOut.length - active;

  const retainedOnePlus = rowsOut.filter((row) => row.attendedCount >= 1).length;
  const retainedTwoPlus = rowsOut.filter((row) => row.attendedCount >= 2).length;

  const behavior = {
    averageNoShowRate: round(rowsOut.length ? rowsOut.reduce((sum, row) => sum + row.noShowRate, 0) / rowsOut.length : 0, 1),
    retentionRate: round(percent(retainedTwoPlus, retainedOnePlus), 1),
    dropDetectionRate: round(
      percent(
        rowsOut.filter((row) => row.previousAttendedCount > 0 && row.currentAttendedCount < row.previousAttendedCount).length,
        rowsOut.filter((row) => row.previousAttendedCount > 0).length
      ),
      1
    ),
    droppedStudents: rowsOut
      .filter((row) => row.previousAttendedCount > 0 && row.currentAttendedCount < row.previousAttendedCount)
      .sort((a, b) => b.engagementDrop - a.engagementDrop)
      .slice(0, 15),
  };

  return {
    segmentation: { active, inactive },
    topEngaged: [...rowsOut].sort((a, b) => b.engagementScore - a.engagementScore).slice(0, 10),
    atRisk: rowsOut.filter((row) => row.atRiskReason).sort((a, b) => a.engagementScore - b.engagementScore).slice(0, 15),
    behavior,
    byStudent: rowsOut,
  };
}

function getEventAnalytics(events, rows, studentAnalytics) {
  const eventMap = new Map(events.map((event) => [event.eventId, event]));

  const studentEventCounts = new Map();
  rows.forEach((row) => {
    if (!row.studentId) return;
    const current = studentEventCounts.get(row.studentId) ?? new Set();
    current.add(row.eventId);
    studentEventCounts.set(row.studentId, current);
  });

  const byEvent = new Map();

  rows.forEach((row) => {
    const eventId = row.eventId;
    if (!eventId) return;

    const existing = byEvent.get(eventId) ?? {
      eventId,
      title: row.eventTitle,
      category: row.eventCategory,
      department: row.eventDepartment,
      eventDate: row.eventDate ? row.eventDate.toISOString() : null,
      registrations: 0,
      attended: 0,
      feedbackTotal: 0,
      feedbackCount: 0,
      repeatParticipants: 0,
    };

    existing.registrations += 1;
    if (row.attended) existing.attended += 1;
    if (row.feedbackRating) {
      existing.feedbackTotal += row.feedbackRating;
      existing.feedbackCount += 1;
    }

    const studentDistinctEvents = row.studentId ? studentEventCounts.get(row.studentId)?.size ?? 0 : 0;
    if (studentDistinctEvents > 1) {
      existing.repeatParticipants += 1;
    }

    byEvent.set(eventId, existing);
  });

  const eventRows = Array.from(byEvent.values()).map((item) => {
    const attendanceRate = percent(item.attended, item.registrations);
    const avgFeedback = item.feedbackCount ? item.feedbackTotal / item.feedbackCount : 0;
    const repeatParticipation = percent(item.repeatParticipants, item.registrations);

    const successScore =
      0.5 * attendanceRate +
      0.3 * (avgFeedback * 20) +
      0.2 * repeatParticipation;

    return {
      ...item,
      attendanceRate: round(attendanceRate, 1),
      avgFeedback: round(avgFeedback, 2),
      repeatParticipation: round(repeatParticipation, 1),
      successScore: round(successScore, 1),
    };
  });

  const categoryMap = new Map();
  eventRows.forEach((event) => {
    const key = event.category || "Uncategorized";
    const current = categoryMap.get(key) ?? {
      category: key,
      events: 0,
      registrations: 0,
      attended: 0,
      feedbackTotal: 0,
      feedbackCount: 0,
      successTotal: 0,
    };

    current.events += 1;
    current.registrations += event.registrations;
    current.attended += event.attended;
    current.feedbackTotal += event.avgFeedback * event.feedbackCount;
    current.feedbackCount += event.feedbackCount;
    current.successTotal += event.successScore;
    categoryMap.set(key, current);
  });

  const categoryPerformance = Array.from(categoryMap.values())
    .map((item) => ({
      category: item.category,
      events: item.events,
      popularityIndex: round(item.attended / item.events, 1),
      attendanceRate: round(percent(item.attended, item.registrations), 1),
      avgFeedback: round(item.feedbackCount ? item.feedbackTotal / item.feedbackCount : 0, 2),
      avgSuccessScore: round(item.successTotal / item.events, 1),
    }))
    .sort((a, b) => b.avgSuccessScore - a.avgSuccessScore);

  const funnel = {
    registered: rows.length,
    attended: rows.filter((row) => row.attended).length,
    feedback: rows.filter((row) => row.feedbackRating !== null).length,
  };

  const overallAttendanceRate = round(percent(funnel.attended, funnel.registered), 1);

  return {
    attendanceByEvent: eventRows.sort((a, b) => b.attendanceRate - a.attendanceRate),
    topEvents: [...eventRows].sort((a, b) => b.successScore - a.successScore).slice(0, 10),
    categoryPerformance,
    funnel,
    overallAttendanceRate,
  };
}

function getDepartmentAnalytics(students, events, rows, studentAnalytics) {
  const deptStudentTotals = new Map();
  students.forEach((student) => {
    const dept = student.department || "Unknown";
    deptStudentTotals.set(dept, (deptStudentTotals.get(dept) ?? 0) + 1);
  });

  const deptParticipantSets = new Map();
  rows.forEach((row) => {
    const dept = row.studentDepartment || row.eventDepartment || "Unknown";
    if (!deptParticipantSets.has(dept)) deptParticipantSets.set(dept, new Set());
    if (row.studentId) deptParticipantSets.get(dept).add(row.studentId);
  });

  const deptEventCounts = new Map();
  events.forEach((event) => {
    const dept = event.department || "Unknown";
    deptEventCounts.set(dept, (deptEventCounts.get(dept) ?? 0) + 1);
  });

  const engagementByDept = new Map();
  studentAnalytics.byStudent.forEach((student) => {
    const dept = student.department || "Unknown";
    const current = engagementByDept.get(dept) ?? { total: 0, count: 0 };
    current.total += student.engagementScore;
    current.count += 1;
    engagementByDept.set(dept, current);
  });

  const departments = Array.from(
    new Set([...deptStudentTotals.keys(), ...deptParticipantSets.keys(), ...deptEventCounts.keys(), ...engagementByDept.keys()])
  );

  const studentDepartmentById = new Map(
    students
      .filter((student) => student.studentId)
      .map((student) => [student.studentId, student.department || "Unknown"])
  );

  const totalParticipants = new Set(rows.map((row) => row.studentId).filter(Boolean)).size;
  const crossDepartmentStudentSet = new Set();
  const crossDepartmentByDept = new Map();

  rows.forEach((row) => {
    if (!row.studentId) return;
    const studentDept = studentDepartmentById.get(row.studentId) || row.studentDepartment || "Unknown";
    const eventDept = row.eventDepartment || "Unknown";
    if (studentDept !== eventDept) {
      crossDepartmentStudentSet.add(row.studentId);
      if (!crossDepartmentByDept.has(studentDept)) crossDepartmentByDept.set(studentDept, new Set());
      crossDepartmentByDept.get(studentDept).add(row.studentId);
    }
  });

  const totalEvents = events.length;

  return departments
    .map((department) => {
      const totalStudents = deptStudentTotals.get(department) ?? 0;
      const participantCount = deptParticipantSets.get(department)?.size ?? 0;
      const engagement = engagementByDept.get(department);
      const eventsHosted = deptEventCounts.get(department) ?? 0;
      const crossDepartmentParticipants = crossDepartmentByDept.get(department)?.size ?? 0;

      return {
        department,
        participationRate: round(percent(participantCount, totalStudents), 1),
        eventsHosted,
        contributionIndex: round(percent(eventsHosted, totalEvents), 1),
        crossDepartmentParticipationRate: round(percent(crossDepartmentParticipants, participantCount), 1),
        crossDepartmentParticipants,
        avgEngagementScore: round(engagement ? engagement.total / engagement.count : 0, 1),
        participatingStudents: participantCount,
        totalStudents,
      };
    })
    .sort((a, b) => b.participationRate - a.participationRate);
}

function getTimeAnalytics(rows) {
  const hourMap = new Map();
  const weekdayMap = new Map();
  const slotAttendance = new Map();
  const slotRegistrations = new Map();

  rows.forEach((row) => {
    const hour = extractHour(row.eventStartTime);
    if (hour === null || !row.eventDate) return;
    const day = getWeekday(row.eventDate);
    const slotKey = `${day}|${hour}`;

    slotRegistrations.set(slotKey, (slotRegistrations.get(slotKey) ?? 0) + 1);
    if (row.attended) {
      hourMap.set(hour, (hourMap.get(hour) ?? 0) + 1);
      weekdayMap.set(day, (weekdayMap.get(day) ?? 0) + 1);
      slotAttendance.set(slotKey, (slotAttendance.get(slotKey) ?? 0) + 1);
    }
  });

  const peakHourEntry = Array.from(hourMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;
  const peakDayEntry = Array.from(weekdayMap.entries()).sort((a, b) => b[1] - a[1])[0] ?? null;

  const last12MonthsStart = new Date();
  last12MonthsStart.setMonth(last12MonthsStart.getMonth() - 11);
  last12MonthsStart.setDate(1);
  last12MonthsStart.setHours(0, 0, 0, 0);

  const monthBucket = new Map();
  rows
    .filter((row) => row.registeredAt && row.registeredAt >= last12MonthsStart)
    .forEach((row) => {
      const key = getMonthKey(row.registeredAt);
      const current = monthBucket.get(key) ?? {
        month: key,
        registrations: 0,
        attended: 0,
        engagementTotal: 0,
        uniqueStudents: new Set(),
      };

      current.registrations += 1;
      current.attended += row.attended ? 1 : 0;
      current.engagementTotal += row.attended ? 5 : -3;
      if (row.studentId) current.uniqueStudents.add(row.studentId);
      monthBucket.set(key, current);
    });

  const monthlyTrend = Array.from(monthBucket.values())
    .sort((a, b) => a.month.localeCompare(b.month))
    .map((item) => ({
      month: item.month,
      registrations: item.registrations,
      attendanceRate: round(percent(item.attended, item.registrations), 1),
      avgEngagement: round(item.uniqueStudents.size ? item.engagementTotal / item.uniqueStudents.size : 0, 1),
    }));

  const latestMonth = monthlyTrend[monthlyTrend.length - 1] ?? null;
  const previousMonth = monthlyTrend[monthlyTrend.length - 2] ?? null;
  const growthRate = latestMonth && previousMonth ? pctChange(latestMonth.registrations, previousMonth.registrations) : 0;

  const timingEfficiency = Array.from(slotRegistrations.entries())
    .map(([slotKey, registrations]) => {
      const [day, hourText] = slotKey.split("|");
      const hour = Number(hourText);
      const attended = slotAttendance.get(slotKey) ?? 0;

      return {
        slot: `${day} ${formatHourLabel(hour)}`,
        day,
        hour: formatHourLabel(hour),
        registrations,
        attended,
        attendanceRate: round(percent(attended, registrations), 1),
      };
    })
    .sort((a, b) => b.attendanceRate - a.attendanceRate)
    .slice(0, 24);

  return {
    peakAttendanceTime: {
      hour: peakHourEntry ? formatHourLabel(peakHourEntry[0]) : "N/A",
      attendedCount: peakHourEntry ? peakHourEntry[1] : 0,
      day: peakDayEntry ? peakDayEntry[0] : "N/A",
      dayAttendanceCount: peakDayEntry ? peakDayEntry[1] : 0,
    },
    timingEfficiency,
    monthlyTrend,
    growthRate: round(growthRate, 1),
  };
}

function buildInsights({ overview, studentAnalytics, eventAnalytics, departmentAnalytics, timeAnalytics }) {
  const insights = [];

  const participationKpi = overview.kpis.find((kpi) => kpi.key === "participationRate");
  if (participationKpi) {
    const trendVerb = participationKpi.changePct >= 0 ? "increased" : "dropped";
    insights.push({
      type: participationKpi.changePct >= 0 ? "opportunity" : "risk",
      title: "Participation trend",
      statement: `Participation ${trendVerb} by ${Math.abs(participationKpi.changePct).toFixed(1)}% versus the previous period.`,
      confidence: "high",
    });
  }

  const topCategory = eventAnalytics.categoryPerformance[0];
  if (topCategory) {
    insights.push({
      type: "opportunity",
      title: "Top-performing event category",
      statement: `${topCategory.category} leads with ${topCategory.attendanceRate.toFixed(1)}% attendance and average success score ${topCategory.avgSuccessScore.toFixed(1)}.`,
      confidence: "high",
    });
  }

  if (timeAnalytics.peakAttendanceTime.hour !== "N/A") {
    insights.push({
      type: "opportunity",
      title: "Peak attendance slot",
      statement: `${timeAnalytics.peakAttendanceTime.day}s around ${timeAnalytics.peakAttendanceTime.hour} have the strongest attendance turnout.`,
      confidence: "medium",
    });
  }

  const lowDepartment = [...departmentAnalytics].sort((a, b) => a.participationRate - b.participationRate)[0];
  if (lowDepartment && lowDepartment.totalStudents > 0) {
    insights.push({
      type: "risk",
      title: "Department participation gap",
      statement: `${lowDepartment.department} has only ${lowDepartment.participationRate.toFixed(1)}% student participation and needs targeted interventions.`,
      confidence: "medium",
    });
  }

  const dropOffKpi = overview.kpis.find((kpi) => kpi.key === "dropOffRate");
  if (dropOffKpi && dropOffKpi.value > 25) {
    insights.push({
      type: "risk",
      title: "High drop-off risk",
      statement: `Drop-off is ${dropOffKpi.value.toFixed(1)}%; improve reminders and in-event nudges to convert registrations into attendance.`,
      confidence: "high",
    });
  }

  if (studentAnalytics.atRisk.length > 0) {
    insights.push({
      type: "risk",
      title: "At-risk cohort detected",
      statement: `${studentAnalytics.atRisk.length} students are at risk due to low engagement or inactivity beyond 30 days.`,
      confidence: "high",
    });
  }

  return insights.slice(0, 8);
}

function buildPredictions(events, rows, eventAnalytics) {
  const today = new Date();
  const upcoming = events
    .filter((event) => event.eventDate && event.eventDate >= today)
    .sort((a, b) => a.eventDate - b.eventDate)
    .slice(0, 12);

  const overallAttendance = eventAnalytics.overallAttendanceRate;

  const byCategory = new Map();
  const byDepartment = new Map();

  eventAnalytics.attendanceByEvent.forEach((event) => {
    const categoryKey = event.category || "Uncategorized";
    const deptKey = event.department || "Unknown";

    const cat = byCategory.get(categoryKey) ?? { total: 0, count: 0 };
    cat.total += event.attendanceRate;
    cat.count += 1;
    byCategory.set(categoryKey, cat);

    const dept = byDepartment.get(deptKey) ?? { total: 0, count: 0 };
    dept.total += event.attendanceRate;
    dept.count += 1;
    byDepartment.set(deptKey, dept);
  });

  const attendancePredictions = upcoming.map((event) => {
    const cat = byCategory.get(event.category || "Uncategorized");
    const dept = byDepartment.get(event.department || "Unknown");
    const catRate = cat ? cat.total / cat.count : overallAttendance;
    const deptRate = dept ? dept.total / dept.count : overallAttendance;

    const predictedAttendanceRate = clamp(0.6 * catRate + 0.4 * deptRate, 5, 98);
    const dropOffRisk = clamp(100 - predictedAttendanceRate, 2, 95);
    const confidenceBasis = (cat?.count ?? 0) + (dept?.count ?? 0);

    return {
      eventId: event.eventId,
      title: event.title,
      eventDate: event.eventDate ? event.eventDate.toISOString() : null,
      predictedAttendanceRate: round(predictedAttendanceRate, 1),
      predictedDropOffRisk: round(dropOffRisk, 1),
      confidence: confidenceBasis >= 6 ? "high" : confidenceBasis >= 3 ? "medium" : "low",
      heuristic: `Weighted historical attendance by category (${round(catRate, 1)}%) and department (${round(deptRate, 1)}%).`,
    };
  });

  const dropOffPredictions = attendancePredictions
    .map((prediction) => ({
      eventId: prediction.eventId,
      title: prediction.title,
      eventDate: prediction.eventDate,
      riskScore: prediction.predictedDropOffRisk,
      confidence: prediction.confidence,
      rationale:
        prediction.predictedDropOffRisk > 40
          ? "High-risk profile based on prior conversion patterns."
          : "Stable profile with healthy expected attendance.",
    }))
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 8);

  return {
    attendancePrediction: attendancePredictions,
    dropOffPrediction: dropOffPredictions,
  };
}

function normalizeData(users, events, registrations, attendanceRows) {
  const attendanceByRegistrationId = new Map();
  attendanceRows.forEach((row) => {
    const key = row.registration_id || row.registrationId;
    if (!key) return;
    attendanceByRegistrationId.set(key, String(row.status || "").toLowerCase());
  });

  const normalizedStudents = users.map((row) => ({
    studentId: String(row.student_id || row.studentId || row.email || row.id || ""),
    name: normalizeText(row.name, "Unknown Student"),
    department: normalizeText(row.department, "Unknown"),
    year: normalizeText(row.year || row.course_year || row.course || "N/A", "N/A"),
    email: typeof row.email === "string" ? row.email : null,
    createdAt: toDate(row.created_at || row.createdAt),
  }));

  const studentByEmail = new Map(
    normalizedStudents.filter((student) => student.email).map((student) => [String(student.email).toLowerCase(), student])
  );

  const normalizedEvents = events.map((row) => ({
    eventId: String(row.event_id || row.eventId || row.id || ""),
    title: normalizeText(row.title, "Untitled Event"),
    category: normalizeText(row.category || row.event_type, "Uncategorized"),
    department: normalizeText(row.department || row.organizing_dept, "Unknown"),
    eventDate: toDate(row.event_date || row.eventDate),
    startTime: normalizeText(row.start_time || row.startTime || row.event_time, ""),
    organizerEmail: normalizeEmail(row.created_by || row.organizer_email || row.organiser_email),
    organizerStudentId: normalizeText(row.created_by_id || row.organizer_id || row.organiser_id || "", ""),
  }));

  const studentById = new Map(normalizedStudents.map((student) => [student.studentId, student]));

  normalizedEvents.forEach((event) => {
    const organizerById = event.organizerStudentId ? studentById.get(event.organizerStudentId) : null;
    if (organizerById) {
      event.organizerStudentId = organizerById.studentId;
      return;
    }

    if (event.organizerEmail) {
      const organizerByEmail = studentByEmail.get(event.organizerEmail);
      event.organizerStudentId = organizerByEmail?.studentId || "";
    }
  });

  const eventById = new Map(normalizedEvents.map((event) => [event.eventId, event]));

  const normalizedRegistrations = registrations
    .map((row) => {
      const eventId = String(row.event_id || row.eventId || "");
      if (!eventId) return null;

      const event = eventById.get(eventId);
      const studentKey = chooseStudentId(row);
      const student = studentKey ? studentByEmail.get(String(studentKey).toLowerCase()) : null;

      const registrationDate = chooseRegistrationDate(row);
      const feedbackRating = chooseFeedback(row);
      const attended = chooseAttendance(row, attendanceByRegistrationId);

      return {
        registrationId: String(row.registration_id || row.registrationId || row.id || ""),
        eventId,
        eventTitle: event?.title || eventId,
        eventCategory: event?.category || "Uncategorized",
        eventDepartment: event?.department || "Unknown",
        eventDate: event?.eventDate || null,
        eventStartTime: event?.startTime || "",
        studentId: student?.studentId || (studentKey ? String(studentKey) : null),
        studentName: student?.name || "Unknown Student",
        studentDepartment: student?.department || event?.department || "Unknown",
        studentYear: student?.year || "N/A",
        registeredAt: registrationDate,
        attended,
        feedbackRating,
      };
    })
    .filter(Boolean);

  return {
    students: normalizedStudents.filter((student) => student.studentId),
    events: normalizedEvents.filter((event) => event.eventId),
    registrations: normalizedRegistrations,
  };
}

export async function buildAnalyticsSnapshot(query = {}) {
  const range = parseRange(query);
  const cacheKey = getCacheKey(range);
  const cached = getCachedPayload(cacheKey);

  if (cached) {
    return cached;
  }

  const [users, events, registrations, attendanceRows] = await Promise.all([
    queryAll("users"),
    queryAll("events"),
    queryAll("registrations"),
    queryAll("attendance_status"),
  ]);

  const normalized = normalizeData(users, events, registrations, attendanceRows);

  const currentRows = normalized.registrations.filter((row) => inRange(row.registeredAt, range.current));
  const previousRows = normalized.registrations.filter((row) => inRange(row.registeredAt, range.previous));

  const currentEvents = normalized.events.filter((event) => inRange(event.eventDate, range.current));
  const totalStudents = normalized.students.length || new Set(normalized.registrations.map((row) => row.studentId).filter(Boolean)).size;

  const overview = getKpiBundle(currentRows, previousRows, normalized.registrations, totalStudents);
  const studentAnalytics = getStudentAnalytics(
    normalized.students,
    currentRows,
    previousRows,
    currentEvents.length > 0 ? currentEvents : normalized.events,
    range.current.end
  );
  const eventAnalytics = getEventAnalytics(currentEvents.length > 0 ? currentEvents : normalized.events, currentRows, studentAnalytics);
  const departmentAnalytics = getDepartmentAnalytics(normalized.students, currentEvents, currentRows, studentAnalytics);
  const timeAnalytics = getTimeAnalytics(normalized.registrations);
  const predictions = buildPredictions(normalized.events, normalized.registrations, eventAnalytics);
  const insights = buildInsights({ overview, studentAnalytics, eventAnalytics, departmentAnalytics, timeAnalytics });

  const payload = {
    generatedAt: new Date().toISOString(),
    range: {
      current: {
        start: range.current.start.toISOString(),
        end: range.current.end.toISOString(),
      },
      previous: {
        start: range.previous.start.toISOString(),
        end: range.previous.end.toISOString(),
      },
    },
    dataQuality: {
      students: normalized.students.length,
      events: normalized.events.length,
      registrations: normalized.registrations.length,
      currentPeriodRegistrations: currentRows.length,
    },
    overview,
    students: studentAnalytics,
    events: eventAnalytics,
    departments: departmentAnalytics,
    time: timeAnalytics,
    insights,
    predictions,
  };

  setCachedPayload(cacheKey, payload);
  return payload;
}

export function clearAnalyticsCache() {
  analyticsCache.clear();
}
