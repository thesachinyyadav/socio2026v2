export const normalizeRegisterNumber = (value) =>
  String(value ?? "").trim().toUpperCase();

const parseVolunteerInput = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

export const normalizeVolunteerRecords = (value) =>
  parseVolunteerInput(value)
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const registerNumber = normalizeRegisterNumber(item.register_number);
      if (!registerNumber) return null;

      return {
        register_number: registerNumber,
        expires_at: typeof item.expires_at === "string" ? item.expires_at : "",
        assigned_by:
          typeof item.assigned_by === "string" ? item.assigned_by.trim() : "",
      };
    })
    .filter(Boolean);

export const computeVolunteerExpiry = ({ endDate, eventDate, endTime }) => {
  const dateValue = String(endDate || eventDate || "").trim();
  const timeValue = String(endTime || "").trim();
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)(?::([0-5]\d))?$/.exec(timeValue);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const [, year, month, day] = dateMatch.map(Number);
  const [, hour, minute, second = "0"] = timeMatch;
  const expiryDate = new Date(
    Date.UTC(year, month - 1, day, Number(hour), Number(minute), Number(second))
  );

  if (Number.isNaN(expiryDate.getTime())) {
    return null;
  }

  expiryDate.setUTCHours(expiryDate.getUTCHours() + 12);
  return expiryDate.toISOString();
};

const getExistingVolunteerMap = (existingVolunteers) => {
  const map = new Map();
  normalizeVolunteerRecords(existingVolunteers).forEach((volunteer) => {
    map.set(volunteer.register_number, volunteer);
  });
  return map;
};

export const buildVolunteerAssignments = async (
  rawVolunteers,
  { endDate, eventDate, endTime, assignedBy, existingVolunteers = [] }
) => {
  const incomingVolunteers = normalizeVolunteerRecords(rawVolunteers);
  if (incomingVolunteers.length === 0) return [];

  const expiresAt = computeVolunteerExpiry({ endDate, eventDate, endTime });
  if (!expiresAt) {
    const error = new Error("Volunteer access requires a valid end date and end time.");
    error.statusCode = 400;
    throw error;
  }

  const uniqueRegisterNumbers = Array.from(
    new Set(incomingVolunteers.map((volunteer) => volunteer.register_number))
  );

  const existingByRegisterNumber = getExistingVolunteerMap(existingVolunteers);
  const normalizedAssignedBy = String(assignedBy || "").trim();

  return uniqueRegisterNumbers.map((registerNumber) => {
    const existing = existingByRegisterNumber.get(registerNumber);
    return {
      register_number: registerNumber,
      expires_at: expiresAt,
      assigned_by: existing?.assigned_by || normalizedAssignedBy,
    };
  });
};

export const hasActiveVolunteerAccess = (volunteers, registerNumber, now = new Date()) => {
  const normalizedRegisterNumber = normalizeRegisterNumber(registerNumber);
  if (!normalizedRegisterNumber) return false;

  return normalizeVolunteerRecords(volunteers).some((volunteer) => {
    if (volunteer.register_number !== normalizedRegisterNumber) return false;
    const expiresAt = new Date(volunteer.expires_at);
    return !Number.isNaN(expiresAt.getTime()) && now < expiresAt;
  });
};
