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
  // Optional appendix pages
  includeHelpTextPage: boolean;
  includeMetricsPage: boolean;
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
  { key: "subevent_summary", label: "Summary of Every Activity/ sub events (based on No of Activities in page 1)" },
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
    "Hosur Road, Near Dairy Circle, Bengaluru, Karnataka - 560029, India",
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
    includeHelpTextPage: false,
    includeMetricsPage: false,
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

// Same as valueParas, but when the field is empty renders the PDF
// instruction text in italic navy as a hint. Used for the Relevance
// mapping cells and the Suggestions cell.
function valueOrPlaceholderParas(value: string, placeholder: string): Paragraph[] {
  if (value && value.trim().length > 0) {
    return value.split("\n").map((line) => para(line || " "));
  }
  return placeholder
    .split("\n")
    .map((line) => para([text(line, { italics: true, color: HELP_TEXT_NAVY })]));
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
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
    children: [para([text(label, { bold: false })])],
  });
}

function valueCell(value: string, widthPct: number) {
  return new TableCell({
    width: { size: widthPct, type: WidthType.PERCENTAGE },
    borders: cellBorder,
    margins: { top: 60, bottom: 60, left: 120, right: 120 },
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
        margins: { top: 80, bottom: 80, left: 120, right: 120 },
        children: [
          para([text(label, { bold: true, size: 22 })], {
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

const BAR_BLUE = "002060";
const HELP_TEXT_NAVY = "1F4E79"; // navy used for help/metrics/checklist instructional text

// Shading-based solid-color bar via a borderless table cell.
function solidBlueBar(heightTwips: number): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        height: { value: heightTwips, rule: HeightRule.EXACT },
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, color: "auto", fill: BAR_BLUE },
            borders: noBorder,
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
            children: [new Paragraph({ children: [text(" ", { size: 2 })] })],
          }),
        ],
      }),
    ],
  });
}

const blueBarParagraph = () => solidBlueBar(90);
const thinBlueBar = () => solidBlueBar(40);

// Bar implemented as a paragraph TOP BORDER (not a shaded cell).
// Word does NOT dim paragraph borders the way it dims shaded fills, so this
// stays full-saturation navy even when placed inside a footer.
function footerBarParagraph(): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 20 },
    children: [text(" ", { size: 2 })],
    border: {
      top: { style: BorderStyle.SINGLE, color: BAR_BLUE, size: 36, space: 1 },
    },
  });
}

// First page header: empty — the logo block in the body covers branding
function buildFirstPageHeader(_input: IQACReportInput): Header {
  return new Header({
    children: [para(" ", { spacing: 0 })],
  });
}

// Default header (pages 2+): empty — campus line lives only in the footer
function buildDefaultHeader(_input: IQACReportInput): Header {
  return new Header({
    children: [para(" ", { spacing: 0 })],
  });
}

function buildFooter(input: IQACReportInput): Footer {
  const campusLine = `CHRIST (Deemed to be University)${
    input.campus ? `, ${input.campus} Campus` : ""
  }${input.venue ? ` - '${input.venue}'` : ""}`;
  return new Footer({
    children: [
      footerBarParagraph(),
      para([text(campusLine, { size: 24, color: "000000", bold: true })], {
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
      footerBarParagraph(),
      para([text(campusLine, { size: 24, color: "000000", bold: true })], {
        alignment: AlignmentType.CENTER,
        spacing: 40,
      }),
      ...(input.footerAddress
        ? [
            para([text(input.footerAddress, { size: 24, color: "000000", bold: true })], {
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
        spacing: { before: 0, after: 20 },
        children: [
          new ImageRun({
            data: logoBytes,
            transformation: { width: 230, height: 74 },
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
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              para([text("Event Coordinators: ", { bold: true }), text(input.eventCoordinators)], { spacing: 40 }),
              para(
                [
                  text("No of Student Volunteers: ", { bold: true }),
                  text(input.noOfStudentVolunteers),
                ],
                { spacing: 40 }
              ),
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
  // Each line renders italic-navy placeholder when empty, bold-black label
  // + value when filled. Shared with the Analysis section below.
  const labeledLineOrPlaceholder = (
    prefix: string,
    value: string,
    placeholderTail: string
  ): Paragraph => {
    if (value && value.trim().length > 0) {
      return para([text(prefix, { bold: true }), text(value)]);
    }
    return para([
      text(prefix, { italics: true, color: HELP_TEXT_NAVY }),
      text(placeholderTail, { italics: true, color: HELP_TEXT_NAVY }),
    ]);
  };

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
            children: [
              labeledLineOrPlaceholder("1. ", input.outcome1, "Outcome 1"),
              labeledLineOrPlaceholder("2. ", input.outcome2, "Outcome 2"),
              labeledLineOrPlaceholder(
                "● Goal Achievement: ",
                input.goalAchievement,
                "(Were the event objectives met? Explain how and to what extent)"
              ),
              labeledLineOrPlaceholder(
                "● Key Takeaways: ",
                input.keyTakeaways,
                "(Summarise the key points and outcomes from the event for participants)"
              ),
            ],
          }),
        ],
      }),
    ],
  });

  // ─── Analysis ────────────────────────────────────────────────────────
  // Uses the shared labeledLineOrPlaceholder helper defined above.
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
            children: [
              labeledLineOrPlaceholder(
                "● Impact on Stakeholders: ",
                input.impactOnStakeholders,
                "(How did the event impact different groups – students, staff, industry, etc.)"
              ),
              labeledLineOrPlaceholder(
                "● Innovations/Best Practices: ",
                input.innovationsBestPractices,
                "(What worked well? What was unique or impactful about this event?)"
              ),
            ],
          }),
        ],
      }),
    ],
  });

  const relevanceHeading = para(
    [text("Relevance of the Event", { bold: true, size: 26 })],
    { spacing: 160 }
  );

  const mappingValueCell = (value: string, placeholder: string): TableCell =>
    new TableCell({
      width: { size: 60, type: WidthType.PERCENTAGE },
      borders: cellBorder,
      margins: { top: 60, bottom: 60, left: 120, right: 120 },
      children: valueOrPlaceholderParas(value, placeholder),
    });

  const mappingTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 40, type: WidthType.PERCENTAGE },
            borders: cellBorder,
            margins: { top: 60, bottom: 60, left: 120, right: 120 },
            children: [
              para([text("PO's     &     PSO's", { bold: true })], {
                spacing: 0,
              }),
              para(
                [
                  text(
                    "In case of Centres/University Level Events, it can be related to the adherence to Vision / Mission of the University / objectives of Centre.",
                    { italics: true, color: HELP_TEXT_NAVY }
                  ),
                ],
                { spacing: 0 }
              ),
            ],
          }),
          mappingValueCell(
            input.posAndPsos,
            "You may type down any POs/PSOs that the activity can be mapped under"
          ),
        ],
      }),
      new TableRow({
        children: [
          labelCell("Local, Regional,\nNational, Global needs\nOr\nGraduate Attributes", 40),
          mappingValueCell(
            input.needsOrGraduateAttributes,
            "Please map with the subject code and subject name (if it is related to subjects), or else, add Graduate Attributes"
          ),
        ],
      }),
      new TableRow({
        children: [
          labelCell(
            "Contemporary Requirements\n(Employability/\nentrepreneurship/ skill development / Professional Requirements)",
            40
          ),
          mappingValueCell(
            input.contemporaryRequirements,
            "Please map with the subject code and subject name"
          ),
        ],
      }),
      new TableRow({
        children: [
          labelCell(
            "Support to Value Systems\n(Cross Cutting Issues such as Gender, Environmental aspects, SDGs, Social Commitment, etc)",
            40
          ),
          mappingValueCell(
            input.valueSystems,
            "Please map with the subject code and subject name\nSDG goal number and the subject code should be mapped properly."
          ),
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
            children: valueOrPlaceholderParas(
              input.suggestionsForImprovement,
              "(This page must be at the end of the report, before all the attachments mentioned in the next page. The observations could be made by Department Level IQAC based on the feedback received from various attendees. Furthermore, various strategies could be suggested for better organisation of the upcoming events)"
            ),
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
  // Per-item rich-text renderer: handles the two items with embedded italic
  // ("or") or bold ("No of Activities") spans; everything else is plain navy.
  const checklistRuns = (item: { key: string; label: string }): TextRun[] => {
    if (item.key === "detailed_report") {
      return [
        text("Detailed Report of the Event with Photographs ", { color: HELP_TEXT_NAVY }),
        text("or", { color: HELP_TEXT_NAVY, italics: true }),
        text(" Blog Post Printout", { color: HELP_TEXT_NAVY }),
      ];
    }
    if (item.key === "subevent_summary") {
      return [
        text("Summary of Every Activity/ sub events (based on ", { color: HELP_TEXT_NAVY }),
        text("No of Activities", { color: HELP_TEXT_NAVY, bold: true }),
        text(" in page 1)", { color: HELP_TEXT_NAVY }),
      ];
    }
    return [text(item.label, { color: HELP_TEXT_NAVY })];
  };

  const checklistParagraphs: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.JUSTIFIED,
      spacing: { before: 120, after: 240 },
      children: [
        text(
          "The instructions given in blue need to be removed, and the content added in the columns should be in black and not in italics. ^^ The above two pages will have to be merged with the Event Report, and the following checklist could be used for ensuring all attachments are present. The checklist has to be submitted to IQAC for report verification",
          { color: HELP_TEXT_NAVY, italics: true }
        ),
      ],
    }),
    ...CHECKLIST_ITEMS.map((item) =>
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 60 },
        children: checklistRuns(item),
      })
    ),
  ];

  // ─── Optional Page: HELP TEXT FOR FILLING FACING SHEET ──────────────────
  // Bulleted help/instructions page, navy text, matches PDF reference.
  const helpTextItems: Array<TextRun[]> = [
    [text("Please do not alter the Font, Styles, etc. of the document", { color: HELP_TEXT_NAVY })],
    [
      text("For report making, it is advisable to work on ", { color: HELP_TEXT_NAVY }),
      text("Google Docs", { color: HELP_TEXT_NAVY, bold: true }),
      text(" itself, by creating a ", { color: HELP_TEXT_NAVY }),
      text("New Copy of this document", { color: HELP_TEXT_NAVY, bold: true }),
      text(" (File → Make a Copy)", { color: HELP_TEXT_NAVY }),
    ],
    [text("Please provide all relevant documents mentioned in the Checklist", { color: HELP_TEXT_NAVY })],
    [
      text("Department", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " - Academic Departments shall mention the Schools Name (E.g., School of Sciences, School of Business and Management (UG), etc). Offices, Centres, and Cells shall mention their respective name (CCHS, Office of Admission, CDL, etc.)",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("Title of the Event -", { color: HELP_TEXT_NAVY, bold: true }),
      text(" Entire title of Event", { color: HELP_TEXT_NAVY }),
    ],
    [
      text("No of Activities -", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " Number of sub events / activities / sessions / etc. conducted under the banner of the above-mentioned title. For instance, an intra-department fest would consist of multiple events",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("Date and Time -", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " The format DD - Month - YY to be used (e.g.: 22 November 2022), followed by timings in HH/MM to HH / MM format (in 12 Hour format). In case of multiple dates and timings, the same could be mentioned. If the event is a full day event, then the time need not be mentioned.",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("Event Type", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " (Focus) - Please mention the major focus. For instance - Skill Enhancement Initiative, Knowledge Sharing Session, Alumni Interaction, Guest Lectures, Seminars, Webinars, Workshops, Conferences, Invited Lectures, Sports or Cultural Activity, Sports or Cultural Competition, Department Fests and Competition, Peer Learning Sessions, Extension Activity, Quality Improvement Programme, Remedial Sessions, etc (please see the next page of help text to get more clarity)",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("Blog Link:", { color: HELP_TEXT_NAVY, bold: true }),
      text(" Link of the Blog Event Report", { color: HELP_TEXT_NAVY }),
    ],
    [
      text("Target Audience:", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " Students / Faculty Members / Administrative Staff / External Students / Staff of Other Institutions / Open to Public / …",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("No of Attendees / Participants:", { color: HELP_TEXT_NAVY, bold: true }),
      text(" Try to give External / Internal numbers separately", { color: HELP_TEXT_NAVY }),
    ],
    [
      text("Summary of the Event:", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " It is not the Event Report; but a short summary of various activities and highlights of the event",
        { color: HELP_TEXT_NAVY }
      ),
    ],
    [
      text("Suggestions for Improvement", { color: HELP_TEXT_NAVY, bold: true }),
      text(
        " also can include extracts from the Review Meeting Discussions, and observations from various stakeholders",
        { color: HELP_TEXT_NAVY }
      ),
    ],
  ];

  const helpTextPage: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 240 },
      children: [
        new TextRun({
          text: "HELP TEXT FOR FILLING FACING SHEET",
          bold: true,
          color: HELP_TEXT_NAVY,
          size: 26,
          underline: { type: "single", color: HELP_TEXT_NAVY },
          font: SERIF,
        }),
      ],
    }),
    ...helpTextItems.map(
      (runs) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 100 },
          alignment: AlignmentType.JUSTIFIED,
          children: runs,
        })
    ),
    new Paragraph({
      spacing: { before: 240, after: 120 },
      children: [
        text("Please contact ", { color: HELP_TEXT_NAVY }),
        text("Internal Quality Assurance Cell", { color: HELP_TEXT_NAVY, bold: true }),
        text(" for any clarifications", { color: HELP_TEXT_NAVY }),
      ],
    }),
  ];

  // ─── Optional Page: VARIOUS METRICS OF EVENTS ────────────────────────────
  const metricsItems: Array<{ code: string; text: string }> = [
    {
      code: "1.3.1",
      text: "Any events done as part of content delivery on Cross Cutting Issues (Professional Ethics, Gender, Human Values, Environment and Sustainability, etc.)",
    },
    {
      code: "2.2.1",
      text: "Any events conducted for specific groups of students (advanced learners, slow learners) - Remedial Classes, Additional Sessions, Guest Lectures, Workshops for Advanced Learners, etc.",
    },
    {
      code: "2.3.1",
      text: "Any events conducted for Content Delivery/Teaching-Learning/ Assessments and Evaluation - Guest Lectures, Creative CIAs, Group Activities",
    },
    {
      code: "2.3.2",
      text: "Any workshops or tool-based programmes, demonstrations of advanced tools, etc. Any training/QIPs/FDPs done on Digital Tools for better teaching.",
    },
    {
      code: "3.1.1",
      text: "Any research, innovation, incubation promotion activities for students and faculty members including external workshops, conferences, training sessions, etc.",
    },
    {
      code: "3.3.2",
      text: "Workshops, Seminars, Events, etc. conducted on Research Methodology, Intellectual Property Rights (IPR), Entrepreneurship, Skill Development, etc.",
    },
    { code: "3.4.1", text: "Any events related to Research Writing, Code of Ethics, Plagiarism Check" },
    { code: "3.6.3", text: "Extension and Outreach programmes including service learning" },
    {
      code: "3.7.1",
      text: "Collaborative Activity Reports under MoUs/MoAs/Collaboration Letters. Can be both outside (CHRIST Faculty Members as Resource People), or for our Staff or Students",
    },
    {
      code: "5.1.2",
      text: "Career Counselling (both Educational and Job Opportunities), Placement Talks, Placement Drive Reports, Guidance for Competitive Examinations. [Any event that supports the students in their career]",
    },
    {
      code: "5.1.3",
      text: "Skill Enhancement Initiatives for Students including events, publications, magazines, talks, workshops - Soft Skill Development/ Language and Communication Skill Development/Life Skills (Yoga, Fitness, Health & Hygiene, Routines)/ New trends in area of study/ Literacy Drives etc.",
    },
    {
      code: "5.3.2",
      text: "Annual Report of Student Association of the Department including the Event Reports",
    },
    {
      code: "5.3.3",
      text: "Any cultural/sports/academic competitions and events that are done for students",
    },
    { code: "6.3.3", text: "Reports of Departmental FDPs/QIPs/Training Sessions" },
    { code: "7.1.1", text: "Any events conducted for Gender Equity (safety and security, counselling)" },
    {
      code: "7.1.8",
      text: "Any events specific to different regional cultures, and other diversities, celebrations etc.",
    },
    { code: "7.1.9", text: "Events related to Constitutional Obligations" },
    { code: "7.1.11", text: "Events celebrating commemorative days (or special days), festivals etc." },
    {
      code: "7.2.1",
      text: "Events related to the Claimed Best Practices of the Department (separate copy if required)",
    },
  ];

  const metricsPage: (Paragraph | Table)[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 80 },
      children: [
        new TextRun({
          text: "VARIOUS METRICS OF EVENTS",
          bold: true,
          color: HELP_TEXT_NAVY,
          size: 26,
          underline: { type: "single", color: HELP_TEXT_NAVY },
          font: SERIF,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 220 },
      children: [
        text("(Do not mention any metrics numbers on Report)", { color: HELP_TEXT_NAVY }),
      ],
    }),
    ...metricsItems.map(
      (item) =>
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 80 },
          alignment: AlignmentType.JUSTIFIED,
          children: [
            text(`${item.code} - `, { color: HELP_TEXT_NAVY }),
            text(item.text, { color: HELP_TEXT_NAVY }),
          ],
        })
    ),
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
          page: { margin: { top: 400, right: 1000, bottom: 1000, left: 1000 } },
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
          para(" ", { spacing: 120 }),
          para(
            [
              text(input.eventTitle || "EVENT TITLE", {
                bold: true,
                size: 28,
              }),
            ],
            { alignment: AlignmentType.CENTER, spacing: 40 }
          ),
          para([text("ACTIVITY REPORT", { bold: true, size: 22 })], {
            alignment: AlignmentType.CENTER,
            spacing: 140,
          }),
          para(" ", { spacing: 120 }),
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
          para(
            [
              text(
                "Please map the event as per the below skills (if applicable) and identify the course/s for which they can be mapped too as well (Please map multiple courses if applicable for each column).",
                { italics: true, color: HELP_TEXT_NAVY }
              ),
            ],
            { spacing: 80 }
          ),
          para(
            [
              text(
                "List the course in the following format: *Course Code*_*Course Name*_Mapping (LRNG, Skills, Cross Cutting)",
                { italics: true, color: HELP_TEXT_NAVY }
              ),
            ],
            { spacing: 80 }
          ),
          para(
            [
              text(
                "(Writeup involving at least 40 words can be given under appropriate heads on each requirement, if any)",
                { italics: true, color: HELP_TEXT_NAVY }
              ),
            ],
            { spacing: 160 }
          ),
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

          // ─── OPTIONAL: Help Text page (page 7) ────────────────────
          ...(input.includeHelpTextPage
            ? [new Paragraph({ children: [new PageBreak()] }), ...helpTextPage]
            : []),

          // ─── OPTIONAL: Metrics page (page 8) ──────────────────────
          ...(input.includeMetricsPage
            ? [new Paragraph({ children: [new PageBreak()] }), ...metricsPage]
            : []),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  const safeTitle = (input.eventTitle || filenameBase).replace(/[^a-z0-9_\- ]/gi, "_").trim();
  saveAs(blob, `${safeTitle || filenameBase}-IQAC-Report.docx`);
}
