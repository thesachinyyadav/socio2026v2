const FEST_TABLE_CANDIDATES = ["fests", "fest"];

let cachedDatabaseFestTable = null;
let cachedSupabaseFestTable = null;

const isMissingRelationError = (error) => {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "").toLowerCase();
  return (
    code === "42P01" ||
    code === "PGRST205" ||
    (message.includes("relation") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("schema cache"))
  );
};

export async function getFestTableForDatabase(queryAllFn) {
  if (cachedDatabaseFestTable) {
    return cachedDatabaseFestTable;
  }

  let lastError = null;
  const existingTables = [];

  for (const tableName of FEST_TABLE_CANDIDATES) {
    try {
      const rows = await queryAllFn(tableName, { select: "fest_id", limit: 1 });
      const rowCount = Array.isArray(rows) ? rows.length : 0;

      existingTables.push({ tableName, rowCount });

      // Prefer the first table that is both present and non-empty.
      if (rowCount > 0) {
        cachedDatabaseFestTable = tableName;
        return tableName;
      }
    } catch (error) {
      if (isMissingRelationError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (existingTables.length > 0) {
    cachedDatabaseFestTable = existingTables[0].tableName;
    return cachedDatabaseFestTable;
  }

  throw lastError || new Error("Unable to resolve fest table name");
}

export async function getFestTableForSupabase(supabaseClient) {
  if (cachedSupabaseFestTable) {
    return cachedSupabaseFestTable;
  }

  let lastError = null;
  const existingTables = [];

  for (const tableName of FEST_TABLE_CANDIDATES) {
    const { data, error } = await supabaseClient
      .from(tableName)
      .select("fest_id")
      .limit(1);

    if (!error) {
      const rowCount = Array.isArray(data) ? data.length : 0;
      existingTables.push({ tableName, rowCount });

      // Prefer the first table that is both present and non-empty.
      if (rowCount > 0) {
        cachedSupabaseFestTable = tableName;
        return tableName;
      }
      continue;
    }

    if (isMissingRelationError(error)) {
      lastError = error;
      continue;
    }

    throw error;
  }

  if (existingTables.length > 0) {
    cachedSupabaseFestTable = existingTables[0].tableName;
    return cachedSupabaseFestTable;
  }

  throw lastError || new Error("Unable to resolve fest table name");
}
