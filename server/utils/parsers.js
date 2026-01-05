export function parseOptionalFloat(value) {
  if (value === undefined || value === null) {
    return null;
  }
  const strValue = String(value).trim();
  if (strValue === "") {
    return null;
  }
  const num = parseFloat(strValue);
  return isNaN(num) ? null : num;
}

export function parseOptionalInt(value, defaultValue = null) {
  if (value === undefined || value === null) {
    return defaultValue;
  }
  const strValue = String(value).trim();
  if (strValue === "") {
    return defaultValue;
  }
  const num = parseInt(strValue, 10);
  return isNaN(num) ? defaultValue : num;
}

export const parseJsonField = (valStr, defaultVal) => {
  if (typeof valStr === "string" && valStr.trim() !== "") {
    try {
      return JSON.parse(valStr);
    } catch (e) {
      return defaultVal;
    }
  }
  return defaultVal;
};
