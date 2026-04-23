# Socio Analytics Intelligence Architecture

## 1) System Architecture

### Backend (Node.js + Express)
- **Route layer**: `server/routes/analyticsRoutes.js`
- **Processing layer**: `server/services/analyticsEngine.js`
- **Auth**: Supabase JWT + `requireMasterAdmin`
- **Endpoints**:
  - `GET /api/analytics/overview`
  - `GET /api/analytics/students`
  - `GET /api/analytics/events`
  - `GET /api/analytics/departments`
  - `GET /api/analytics/insights`
  - `POST /api/analytics/refresh`

### Frontend (React/Next.js)
- **Dashboard UI**: `client/app/_components/Admin/DataExplorerDashboard.tsx`
- **API client**: `client/lib/masterAdminAnalyticsApi.ts`
- Renders KPI cards, event analytics, engagement analytics, department analytics, insights, and predictive hooks.

## 2) Data Processing Logic

### KPI Metrics
Computed dynamically with period-over-period change:
1. Participation Rate
2. Attendance Rate
3. Drop-off Rate
4. Average Events per Student
5. Active Students Percentage (last 30 days)

### Student Engagement
- Engagement score formula: `5 × attended - 3 × noShows`
- Active/Inactive segmentation
- Top engaged students
- At-risk students (low score or inactivity > 30 days)

### Event Analytics
- Attendance rate per event
- Event success score:
  - `0.5 × attendanceRate + 0.3 × avgFeedback(1-5 mapped to 0-100) + 0.2 × repeatParticipation`
- Category performance
- Drop-off funnel: Registered → Attended → Feedback

### Department Analytics
- Participation rate by department
- Events hosted by department
- Average engagement score by department

### Time Analytics
- Peak attendance day + hour
- Monthly engagement trend
- Growth rate (latest month vs previous month)

### Insights Engine
Rule-based, data-driven insights generated from live metrics.
Examples include trend shifts, top categories, participation gaps, and risk cohorts.

### Predictive Hook
Heuristic prediction layer (ML-ready contract):
- Attendance prediction for upcoming events
- Drop-off risk forecast

## 3) Performance Design
- Single analytics snapshot computation shared across endpoints.
- In-memory cache (`60s TTL`) in analytics engine to avoid redundant recomputation.
- Endpoint-specific responses slice from shared snapshot.

## 4) Example API Responses

## `GET /api/analytics/overview`
```json
{
  "generatedAt": "2026-04-23T10:45:12.000Z",
  "range": {
    "current": { "start": "2026-01-24T00:00:00.000Z", "end": "2026-04-23T10:45:12.000Z" },
    "previous": { "start": "2025-10-26T13:14:47.999Z", "end": "2026-01-23T23:59:59.999Z" }
  },
  "kpis": [
    { "key": "participationRate", "label": "Participation Rate", "value": 42.8, "unit": "%", "changePct": 7.4 },
    { "key": "attendanceRate", "label": "Attendance Rate", "value": 68.2, "unit": "%", "changePct": 4.1 }
  ],
  "funnel": { "registered": 1250, "attended": 853, "feedback": 514 },
  "growthRate": 9.2
}
```

## `GET /api/analytics/students`
```json
{
  "segmentation": { "active": 613, "inactive": 402 },
  "topEngaged": [
    {
      "studentId": "u123",
      "name": "Asha Mathew",
      "department": "Computer Science",
      "year": "3",
      "engagementScore": 34,
      "attendedCount": 8,
      "noShows": 2
    }
  ],
  "atRisk": [
    {
      "studentId": "u987",
      "name": "Rohan D",
      "department": "Physics",
      "year": "2",
      "engagementScore": -6,
      "atRiskReason": "Low engagement score"
    }
  ]
}
```

## `GET /api/analytics/events`
```json
{
  "attendanceByEvent": [
    {
      "eventId": "EVT-102",
      "title": "Innovation Sprint",
      "category": "Technical",
      "attendanceRate": 81.3,
      "avgFeedback": 4.4,
      "repeatParticipation": 37.5,
      "successScore": 71.8
    }
  ],
  "predictions": {
    "attendancePrediction": [
      {
        "eventId": "EVT-205",
        "title": "AI Hack Night",
        "predictedAttendanceRate": 74.2,
        "predictedDropOffRisk": 25.8,
        "confidence": "high"
      }
    ]
  }
}
```

## `GET /api/analytics/departments`
```json
{
  "departments": [
    {
      "department": "Computer Science",
      "participationRate": 63.5,
      "eventsHosted": 18,
      "avgEngagementScore": 11.8,
      "participatingStudents": 267,
      "totalStudents": 420
    }
  ]
}
```

## `GET /api/analytics/insights`
```json
{
  "insights": [
    {
      "type": "risk",
      "title": "Participation trend",
      "statement": "Participation dropped by 12.0% versus the previous period.",
      "confidence": "high"
    },
    {
      "type": "opportunity",
      "title": "Top-performing event category",
      "statement": "Technical leads with 78.3% attendance and average success score 69.5.",
      "confidence": "high"
    }
  ],
  "peakAttendanceTime": {
    "day": "Friday",
    "hour": "4 PM",
    "attendedCount": 182
  }
}
```

## 5) Notes
- The implementation is schema-tolerant and maps field variants where possible.
- Predictive hooks are intentionally heuristic and can be swapped with ML services later without changing dashboard contracts.
