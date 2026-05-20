import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeightRule,
  ImageRun,
  Packer,
  PageBreak,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";

export type IQACReportInput = {
  // Auto-derived (editable)
  department: string;
  campus: string;
  venue: string;
  eventTitle: string;
  noOfActivities: string;
  dateAndTime: string;
  academicYear: string;
  eventTypeFocus: string;
  blogLink: string;
  targetAudience: string;
  externalAgencies: string;
  externalContact: string;
  eventCoordinators: string;
  noOfStudentVolunteers: string;
  noOfAttendees: string;
  footerAddress: string;
  // Manual
  summary: string;
  outcome1: string;
  outcome2: string;
  goalAchievement: string;
  keyTakeaways: string;
  impactOnStakeholders: string;
  innovationsBestPractices: string;
  posAndPsos: string;
  needsOrGraduateAttributes: string;
  contemporaryRequirements: string;
  valueSystems: string;
  suggestionsForImprovement: string;
  signOffDate: string;
  // Checklist (boolean)
  checklist: Record<string, boolean>;
};

export type IQACReportEventData = {
  event_id: string;
  title: string;
  organizing_dept?: string;
  campus_hosted_at?: string | null;
  venue?: string;
  event_date?: string;
  end_date?: string;
  event_time?: string;
  category?: string;
  created_by?: string;
  total_participants?: number;
  attended_count?: number;
  total_registrations?: number;
  student_volunteers_count?: number;
};

export const CHECKLIST_ITEMS: { key: string; label: string }[] = [
  { key: "facing_sheet", label: "Facing Sheet (Page 1)" },
  { key: "summary_outcomes", label: "Summary and Outcomes Sheet (Page 2)" },
  { key: "suggestions_sheet", label: "Suggestions Sheet (Final Page)" },
  { key: "seal_sign", label: "Department Seal & Sign in Every Page" },
  { key: "posters", label: "Poster(s) of the event" },
  { key: "brochures", label: "Brochure(s) of the event" },
  { key: "speaker_profile", label: "Profile of any external speakers / details about collaborating agencies" },
  { key: "detailed_report", label: "Detailed Report of the Event with Photographs or Blog Post Printout" },
  { key: "geotagged_photos", label: "Photographs of the Event (Geotagged Photographs) are present in the Report" },
  { key: "subevent_summary", label: "Summary of Every Activity / sub events" },
  { key: "feedback", label: "Feedback of the Event (Not required in terms of a competition)" },
  { key: "registration_list", label: "Registration List (if any)" },
  { key: "attendees_list", label: "List of All Attendees / Beneficiaries" },
  { key: "external_attendees", label: "Details of External Attendees" },
  { key: "winners_list", label: "List of All Participants and Winners List (in case of a competition)" },
  { key: "volunteer_list", label: "List of Student Volunteers" },
  { key: "participant_certs", label: "Sample Certificates of Participants / Attendees" },
  { key: "winner_certs", label: "Sample Certificates of Winners (Any competitions)" },
  { key: "proposal", label: "Proposal / Planning Documents" },
  { key: "budgets", label: "Budgets" },
  { key: "email_comms", label: "Printout of Email Communication (sent from Sysadmin or Academic Office)" },
];

// Street addresses keyed on the exact `campus_hosted_at` string. The
// "CHRIST (Deemed to be University)" prefix is omitted because the campus
// header line directly above already includes it (matching the PDF layout
// for the Pune Lavasa template).
export const CAMPUS_ADDRESSES: Record<string, string> = {
  "Central Campus (Main)":
    "Hosur Road, Bhavani Nagar, S.G. Palya, Bengaluru, Karnataka 560029",
  "Bannerghatta Road Campus":
    "Bannerghatta Main Road, Hulimavu, Bengaluru, Karnataka 560076",
  "Yeshwanthpur Campus":
    "Nagasandra, Near Tumkur Road, Bangalore - 560 073, Karnataka, India",
  "Kengeri Campus":
    "Kanmanike, Kumbalgodu, Mysore Road, Bengaluru, Karnataka - 560074",
  "Delhi NCR Campus":
    "Mariam Nagar, Meerut Road, Delhi NCR, Ghaziabad, Uttar Pradesh - 201003",
  "Pune Lavasa Campus":
    "30 Valor Court, At Post: Dasve Lavasa, Taluka: Mulshi, Pune 412112, Maharashtra",
};

export function deriveAcademicYear(eventDate?: string): string {
  if (!eventDate) return "";
  const d = new Date(eventDate);
  if (Number.isNaN(d.getTime())) return "";
  const month = d.getMonth();
  const year = d.getFullYear();
  if (month >= 5) return `${year}-${year + 1}`;
  return `${year - 1}-${year}`;
}

function formatDateTime(eventDate?: string, endDate?: string, time?: string): string {
  if (!eventDate) return "";
  const formatOne = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  };
  const dateStr =
    endDate && endDate !== eventDate
      ? `${formatOne(eventDate)} to ${formatOne(endDate)}`
      : formatOne(eventDate);
  return time ? `${dateStr}, ${time}` : dateStr;
}

export function deriveDefaultsFromEvent(event: IQACReportEventData): IQACReportInput {
  const campus = event.campus_hosted_at || "";
  return {
    department: event.organizing_dept || "",
    campus,
    venue: event.venue || "",
    eventTitle: event.title || "",
    noOfActivities: "1",
    dateAndTime: formatDateTime(event.event_date, event.end_date, event.event_time),
    academicYear: deriveAcademicYear(event.event_date),
    eventTypeFocus: event.category || "",
    blogLink: "",
    targetAudience: "",
    externalAgencies: "",
    externalContact: "",
    eventCoordinators: event.created_by || "",
    noOfStudentVolunteers:
      typeof event.student_volunteers_count === "number"
        ? event.student_volunteers_count === 0
          ? "None"
          : String(event.student_volunteers_count)
        : "",
    noOfAttendees:
      typeof event.total_registrations === "number"
        ? String(event.total_registrations)
        : typeof event.total_participants === "number"
        ? String(event.total_participants)
        : "",
    footerAddress: CAMPUS_ADDRESSES[campus] || "",
    summary: "",
    outcome1: "",
    outcome2: "",
    goalAchievement: "",
    keyTakeaways: "",
    impactOnStakeholders: "",
    innovationsBestPractices: "",
    posAndPsos: "",
    needsOrGraduateAttributes: "",
    contemporaryRequirements: "",
    valueSystems: "",
    suggestionsForImprovement: "",
    signOffDate: new Date().toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
    checklist: Object.fromEntries(CHECKLIST_ITEMS.map((c) => [c.key, false])),
  };
}

// ─── docx helpers ────────────────────────────────────────────────────────
const NAVY = "1F4E79"; // exact navy matching the IQAC PDF
const NAVY_LIGHT = "2E5496";
const BAR_BG = "EAF0FA"; // section header band
const SERIF = "Palatino Linotype";

// Returns paragraphs containing the user's text, or a single blank
// paragraph if the field is empty (table cells require at least one).
function valueParas(value: string): Paragraph[] {
  if (value && value.trim().length > 0) {
    return value.split("\n").map((line) => para(line || " "));
  }
  return [para(" ")];
}

const text = (
  value: string,
  opts: { bold?: boolean; color?: string; size?: number; italics?: boolean; font?: string } = {}
) =>
  new TextRun({
    text: value || "",
    bold: opts.bold,
    color: opts.color,
    size: opts.size ?? 22,
    italics: opts.italics,
    font: opts.font ?? SERIF,
  });

const para = (
  runs: TextRun[] | string,
  opts: {
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    spacing?: number;
    bottomBorder?: { color: string; size: number };
    topBorder?: { color: string; size: number };
  } = {}
) =>
  new Paragraph({
    alignment: opts.alignment,
    spacing: { after: opts.spacing ?? 80 },
    children: typeof runs === "string" ? [text(runs)] : runs,
    border:
      opts.bottomBorder || opts.topBorder
        ? {
            ...(opts.bottomBorder
              ? {
                  bottom: {
                    style: BorderStyle.SINGLE,
                    color: opts.bottomBorder.color,
                    size: opts.bottomBorder.size,
                    space: 1,
                  },
                }
              : {}),
            ...(opts.topBorder
              ? {
                  top: {
                    style: BorderStyle.SINGLE,
                    color: opts.topBorder.color,
                    size: opts.topBorder.size,
                    space: 1,
                  },
                }
              : {}),
          }
        : undefined,
  });

const cellBorder = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "000000" },
};

const noBorder = {
  top: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  bottom: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  left: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
  right: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
};

function labelCell(label: string, widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: [para([text(label, { bold: false })])],
  });
}

function valueCell(value: string, widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    margins: { top: 120, bottom: 120, left: 140, right: 140 },
    children: (value || " ").split("\n").map((line) => para(line || " ")),
  });
}

function sectionHeaderRow(label: string) {
  return new TableRow({
    children: [
      new TableCell({
        columnSpan: 2,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: cellBorder,
        margins: { top: 160, bottom: 160, left: 120, right: 120 },
        children: [
          para([text(label, { bold: true, size: 24 })], {
            alignment: AlignmentType.CENTER,
          }),
        ],
      }),
    ],
  });
}

function kvRow(label: string, value: string) {
  return new TableRow({
    children: [labelCell(label, 32), valueCell(value, 68)],
  });
}

const BAR_BLUE = "1F4E79";

const blueBarParagraph = () =>
  new Paragraph({
    spacing: { before: 120, after: 120 },
    border: {
      bottom: { style: BorderStyle.SINGLE, color: BAR_BLUE, size: 18, space: 1 },
    },
    children: [text(" ", { size: 2 })],
  });

const thinBlueBar = () =>
  new Paragraph({
    spacing: { before: 60, after: 60 },
    border: {
      bottom: { style: BorderStyle.SINGLE, color: BAR_BLUE, size: 8, space: 1 },
    },
    children: [text(" ", { size: 2 })],
  });

// First page header: empty — the logo block in the body covers branding
function buildFirstPageHeader(_input: IQACReportInput): Header {
  return new Header({
    children: [para(" ", { spacing: 0 })],
  });
}

// Default header (pages 2+): same campus line, no address
function buildDefaultHeader(input: IQACReportInput): Header {
  const campusLine = `CHRIST (Deemed to be University)${
    input.campus ? `, ${input.campus} Campus` : ""
  }${input.venue ? ` - '${input.venue}'` : ""}`;
  return new Header({
    children: [
      para([text(campusLine, { size: 18 })], {
        alignment: AlignmentType.CENTER,
        spacing: 40,
      }),
      thinBlueBar(),
    ],
  });
}

function buildFooter(input: IQACReportInput): Footer {
  const campusLine = `CHRIST (Deemed to be University)${
    input.campus ? `, ${input.campus} Campus` : ""
  }${input.venue ? ` - '${input.venue}'` : ""}`;
  return new Footer({
    children: [
      thinBlueBar(),
      para([text(campusLine, { size: 18 })], {
        alignment: AlignmentType.CENTER,
        spacing: 40,
      }),
    ],
  });
}

// First page footer: includes address line
function buildFirstPageFooter(input: IQACReportInput): Footer {
  const campusLine = `CHRIST (Deemed to be University)${
    input.campus ? `, ${input.campus} Campus` : ""
  }${input.venue ? ` - '${input.venue}'` : ""}`;
  return new Footer({
    children: [
      thinBlueBar(),
      para([text(campusLine, { size: 18 })], {
        alignment: AlignmentType.CENTER,
        spacing: 40,
      }),
      ...(input.footerAddress
        ? [
            para([text(input.footerAddress, { size: 18 })], {
              alignment: AlignmentType.CENTER,
              spacing: 40,
            }),
          ]
        : []),
    ],
  });
}

async function loadLogoBytes(): Promise<Uint8Array | null> {
  try {
    const res = await fetch("/images/christ-logo.png");
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

// Top-right CHRIST logo block (used on page 1 only)
function buildLogoBlock(logoBytes: Uint8Array | null): Paragraph[] {
  if (logoBytes) {
    return [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 0, after: 40 },
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 280, height: 90 },
            type: "png",
          }),
        ],
      }),
    ];
  }
  return [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 0, after: 40 },
      children: [
        text("CHRIST (Deemed to be University)", { bold: true, size: 28 }),
      ],
    }),
  ];
}

export async function generateIQACDocx(input: IQACReportInput, filenameBase = "iqac-event-report") {
  // Fetch logo bytes once before constructing the document
  const logoBytes = await loadLogoBytes();

  // ─── Page 1: Facing Sheet ──────────────────────────────────────────
  const locationValue = `CHRIST (Deemed to be University)${
    input.campus ? `, ${input.campus} Campus` : ""
  }${input.venue ? ` - '${input.venue}'` : ""}`;

  const facingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow("EVENT INFORMATION"),
      kvRow("Department", input.department),
      kvRow("Location", locationValue),
      kvRow("Event Title", input.eventTitle),
      kvRow("No of Activities", input.noOfActivities),
      kvRow("Date and Time", input.dateAndTime),
      kvRow("Venue", input.venue),
      kvRow("Academic Year", input.academicYear),
      kvRow("Event Type (Focus)", input.eventTypeFocus),
      kvRow("Blog Link", input.blogLink),
      sectionHeaderRow("PARTICIPANTS INFORMATION"),
      kvRow("Target Audience", input.targetAudience),
      kvRow("Details of any External Agencies, Speakers, Guests with Affiliation", input.externalAgencies),
      kvRow("Website / Contact of External Members", input.externalContact),
      new TableRow({
        children: [
          labelCell("Organising Committee Details", 32),
          new TableCell({
            width: { size: 68, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 120, bottom: 120, left: 140, right: 140 },
            children: [
              para([text("Event Coordinators: ", { bold: true }), text(input.eventCoordinators)]),
              para([
                text("No of Student Volunteers: ", { bold: true }),
                text(input.noOfStudentVolunteers),
              ]),
            ],
          }),
        ],
      }),
      kvRow("No of Attendees / Participants", input.noOfAttendees),
    ],
  });

  // ─── Summary ─────────────────────────────────────────────────────────
  const summaryTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow("SUMMARY OF THE OVERALL EVENT"),
      new TableRow({
        height: { value: 5000, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            columnSpan: 2,
            borders: cellBorder,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: valueParas(input.summary),
          }),
        ],
      }),
    ],
  });

  // ─── Outcomes ────────────────────────────────────────────────────────
  // Each line only renders if the user filled the field.
  const labeledLine = (prefix: string, value: string): Paragraph | null => {
    if (!value || value.trim().length === 0) return null;
    return para([text(prefix, { bold: true }), text(value)]);
  };
  const outcomeChildren = [
    labeledLine("1. ", input.outcome1),
    labeledLine("2. ", input.outcome2),
    labeledLine("● Goal Achievement: ", input.goalAchievement),
    labeledLine("● Key Takeaways: ", input.keyTakeaways),
  ].filter((p): p is Paragraph => p !== null);

  const outcomesTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow("OUTCOMES OF THE EVENT"),
      new TableRow({
        height: { value: 2500, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            columnSpan: 2,
            borders: cellBorder,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: outcomeChildren.length > 0 ? outcomeChildren : [para(" ")],
          }),
        ],
      }),
    ],
  });

  // ─── Analysis ────────────────────────────────────────────────────────
  const analysisChildren = [
    labeledLine("● Impact on Stakeholders: ", input.impactOnStakeholders),
    labeledLine("● Innovations/Best Practices: ", input.innovationsBestPractices),
  ].filter((p): p is Paragraph => p !== null);

  const analysisTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow("ANALYSIS"),
      new TableRow({
        height: { value: 3800, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            columnSpan: 2,
            borders: cellBorder,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: analysisChildren.length > 0 ? analysisChildren : [para(" ")],
          }),
        ],
      }),
    ],
  });

  const relevanceHeading = para(
    [text("Relevance of the Event", { bold: true, size: 26 })],
    { spacing: 160 }
  );

  const mappingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          labelCell(
            "PO's & PSO's\nIn case of Centres/University Level Events, it can be related to the adherence to Vision / Mission of the University / objectives of Centre.",
            40
          ),
          valueCell(input.posAndPsos, 60),
        ],
      }),
      new TableRow({
        children: [
          labelCell("Local, Regional,\nNational, Global needs\nOr\nGraduate Attributes", 40),
          valueCell(input.needsOrGraduateAttributes, 60),
        ],
      }),
      new TableRow({
        children: [
          labelCell(
            "Contemporary Requirements\n(Employability/\nentrepreneurship/ skill development / Professional Requirements)",
            40
          ),
          valueCell(input.contemporaryRequirements, 60),
        ],
      }),
      new TableRow({
        children: [
          labelCell(
            "Support to Value Systems\n(Cross Cutting Issues such as Gender, Environmental aspects, SDGs, Social Commitment, etc)",
            40
          ),
          valueCell(input.valueSystems, 60),
        ],
      }),
    ],
  });

  // ─── Suggestions ─────────────────────────────────────────────────────
  const suggestionsTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      sectionHeaderRow("SUGGESTIONS FOR IMPROVEMENT • FEEDBACK FROM IQAC"),
      new TableRow({
        height: { value: 4000, rule: HeightRule.ATLEAST },
        children: [
          new TableCell({
            columnSpan: 2,
            borders: cellBorder,
            margins: { top: 200, bottom: 200, left: 200, right: 200 },
            children: valueParas(input.suggestionsForImprovement),
          }),
        ],
      }),
    ],
  });

  // ─── Sign-off block ───────────────────────────────────────────────────
  const signOffTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [para([text("Head / Coordinator", { bold: true })])],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder,
            children: [
              para([text("Faculty Coordinator / Organiser", { bold: true })], {
                alignment: AlignmentType.RIGHT,
              }),
              para([text("IQAC", { bold: true })], {
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  // ─── Checklist ────────────────────────────────────────────────────────
  const checklistParagraphs: Paragraph[] = [
    para([text("ATTACHMENT CHECKLIST", { bold: true, size: 28 })], {
      alignment: AlignmentType.CENTER,
      spacing: 200,
    }),
    thinBlueBar(),
    ...CHECKLIST_ITEMS.map((item) => {
      const checked = input.checklist[item.key];
      return para(
        [
          text(checked ? "☒  " : "☐  ", { bold: true, size: 24 }),
          text(item.label),
        ],
        { spacing: 100 }
      );
    }),
  ];

  // ─── Document ──────────────────────────────────────────────────────────
  const doc = new Document({
    creator: "SOCIO",
    title: `${input.eventTitle || "Event"} - IQAC Activity Report`,
    description: "IQAC event activity report generated from SOCIO",
    styles: {
      default: {
        document: { run: { font: SERIF, size: 22 } },
      },
    },
    sections: [
      {
        properties: {
          titlePage: true,
          page: { margin: { top: 500, right: 1100, bottom: 1200, left: 1100 } },
        },
        headers: {
          first: buildFirstPageHeader(input),
          default: buildDefaultHeader(input),
        },
        footers: {
          first: buildFirstPageFooter(input),
          default: buildFooter(input),
        },
        children: [
          // ─── PAGE 1 ────────────────────────────────────────────────
          ...buildLogoBlock(logoBytes),
          blueBarParagraph(),
          para(
            [
              text(input.eventTitle || "EVENT TITLE", {
                bold: true,
                size: 36,
              }),
            ],
            { alignment: AlignmentType.CENTER, spacing: 80 }
          ),
          para([text("ACTIVITY REPORT", { bold: true, size: 28 })], {
            alignment: AlignmentType.CENTER,
            spacing: 320,
          }),
          facingTable,

          // ─── PAGE 2: Summary + Outcomes ───────────────────────────
          new Paragraph({ children: [new PageBreak()] }),
          summaryTable,
          para(" ", { spacing: 240 }),
          outcomesTable,

          // ─── PAGE 4: Analysis + Mapping ───────────────────────────
          new Paragraph({ children: [new PageBreak()] }),
          analysisTable,
          para(" ", { spacing: 240 }),
          relevanceHeading,
          mappingTable,

          // ─── PAGE 5: Suggestions + sign-off ───────────────────────
          new Paragraph({ children: [new PageBreak()] }),
          suggestionsTable,
          para(" ", { spacing: 320 }),
          para([text("Date: ", { bold: true }), text(input.signOffDate)]),
          para(" ", { spacing: 400 }),
          signOffTable,

          // ─── PAGE 6: Checklist ────────────────────────────────────
          new Paragraph({ children: [new PageBreak()] }),
          ...checklistParagraphs,
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = (input.eventTitle || filenameBase).replace(/[^a-z0-9_\- ]/gi, "_").trim();
  saveAs(blob, `${safeTitle || filenameBase}-IQAC-Report.docx`);
}
