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
- Renders KPI cards, event analytics, engagement analytics, department analytics, insights, and advanced analytics graphs.

## 2) Data Processing Logic

### KPI Metrics
Computed dynamically with period-over-period change:
1. Participation Rate
2. Attendance Rate
3. Drop-off Rate
4. Average Events per Student
5. Active Students Percentage (last 30 days)

### Student Engagement
- Participation Rate: `unique students who attended ≥1 event / total students × 100`
- Average Events per Student: `total attendances / total students`
- Engagement score formula: `(5 × events attended) + (10 × events organized) - (3 × noShows)`
- Active/Inactive segmentation
- Top engaged students
- At-risk students (low score or inactivity > 30 days)
- Student behavior intelligence:
  - No-show rate per student
  - Retention rate (`students with ≥2 attended / students with ≥1 attended × 100`)
  - Engagement drop detection (previous period vs current period attended activity)

### Event Analytics
- Attendance rate per event
- Event success score:
  - `0.5 × attendanceRate + 0.3 × avgFeedback(1-5 mapped to 0-100) + 0.2 × repeatParticipation`
- Drop-off rate: `(registered - attended) / registered × 100`
- Category performance
- Category popularity index (attendance-weighted by event count)
- Drop-off funnel: Registered → Attended → Feedback

### Department Analytics
- Participation rate by department
- Events hosted by department
- Contribution index by department (`events hosted by dept / total events × 100`)
- Cross-department engagement (`students attending outside their department`)
- Average engagement score by department

### Time Analytics
- Peak attendance day + hour
- Event timing efficiency by day-hour slot (`attendance rate by slot`)
- Monthly engagement trend
- Growth rate (latest month vs previous month)

### Insights Engine
Rule-based, data-driven insights generated from live metrics.
Examples include trend shifts, top categories, participation gaps, and risk cohorts.

### Advanced Analytics Graph Layer
The dashboard replaces the predictive hook UI block with grouped analytics graphs covering:
- Student engagement
- Event performance
- Department analytics
- Time and behavior analytics
- Student behavior intelligence

Note: predictive outputs are still available in backend contracts and can be surfaced later if required.

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
- Predictive outputs remain heuristic and ML-ready in the API layer, even though the dashboard now prioritizes graph-first analytics sections.
