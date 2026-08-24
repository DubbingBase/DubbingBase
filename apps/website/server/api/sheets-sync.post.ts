import { requireAdmin } from "../utils/auth";
import { useSupabaseAdmin } from "../utils/db/client";

export default defineEventHandler(async (event) => {
  requireAdmin(event);

  try {
    const config = useRuntimeConfig();

    const GOOGLE_SHEET_ID = config.googleSheetId as string;
    const SYNC_WORKSHEET_NAME = config.syncWorksheetName as string;
    const SYNC_TABLE_PRIMARY_KEY = config.syncTablePrimaryKey as string;

    if (!GOOGLE_SHEET_ID || !SYNC_TABLE_PRIMARY_KEY) {
      return {
        status: "skipped",
        message:
          "Google Sheets sync is not configured (missing googleSheetId or syncTablePrimaryKey).",
      };
    }

    let GoogleSpreadsheet: any;
    let JWT: any;
    try {
      // @ts-ignore
      const gsModule = await import("google-spreadsheet");
      // @ts-ignore
      const authModule = await import("google-auth-library");
      GoogleSpreadsheet = gsModule.GoogleSpreadsheet;
      JWT = authModule.JWT;
    } catch {
      return {
        status: "skipped",
        message:
          "google-spreadsheet package is not available in current runtime.",
      };
    }

    const supabase = useSupabaseAdmin();

    console.log(`\n🔄 Starting Smart Sync for table: [voice_actors]`);

    // 1. Fetch all voice_actors from database
    const { data: supabaseRows, error } = await supabase
      .from("voice_actors")
      .select("*");

    if (error) throw error;

    if (!supabaseRows || supabaseRows.length === 0) {
      console.log("No voice actors found in database.");
      return { status: "success", inserted: 0, updated: 0, deleted: 0 };
    }

    console.log(`📥 Database: Retrieved ${supabaseRows.length} rows.`);

    // 2. Authenticate with Google Sheets
    const serviceAccountAuth = new JWT({
      email: config.googleServiceAccountEmail as string,
      key: ((config.googleServiceAccountKey as string) || "").replace(
        /\\n/g,
        "\n",
      ),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    const sheet = SYNC_WORKSHEET_NAME
      ? doc.sheetsByTitle[SYNC_WORKSHEET_NAME]
      : doc.sheetsByIndex[0];

    if (!sheet) {
      throw new Error(`Worksheet "${SYNC_WORKSHEET_NAME}" not found.`);
    }

    const sheetRows = await sheet.getRows();
    console.log(`📄 Sheet: Found ${sheetRows.length} existing rows.`);

    // 3. Map Sheet Rows by Primary Key
    const sheetRowMap = new Map<string, any>();
    sheetRows.forEach((row: any) => {
      const rawPk = row.get(SYNC_TABLE_PRIMARY_KEY);
      if (rawPk) {
        sheetRowMap.set(normalizeValue(rawPk), row);
      }
    });

    // 4. Upsert
    let updatedCount = 0;
    let insertedCount = 0;
    const processedSupabaseIds = new Set<string>();

    for (const sbRow of supabaseRows) {
      const pkValue = normalizeValue((sbRow as any)[SYNC_TABLE_PRIMARY_KEY]);
      processedSupabaseIds.add(pkValue);

      if (sheetRowMap.has(pkValue)) {
        const sheetRow = sheetRowMap.get(pkValue)!;
        let hasChanged = false;

        for (const [key, val] of Object.entries(sbRow)) {
          if (sheet.headerValues.includes(key)) {
            const sheetVal = normalizeValue(sheetRow.get(key));
            const sbVal = normalizeValue(val);

            if (sheetVal !== sbVal) {
              sheetRow.set(key, val);
              hasChanged = true;
            }
          }
        }

        if (hasChanged) {
          await sheetRow.save();
          updatedCount++;
        }
      } else {
        await sheet.addRow(sbRow);
        insertedCount++;
      }
    }

    // 5. Handle Deletions
    let deletedCount = 0;
    const rowsToDelete = sheetRows.filter((row: any) => {
      const pk = normalizeValue(row.get(SYNC_TABLE_PRIMARY_KEY));
      return pk && !processedSupabaseIds.has(pk);
    });

    if (rowsToDelete.length > 0) {
      for (const row of rowsToDelete.reverse()) {
        await row.delete();
        deletedCount++;
      }
    }

    return {
      status: "success",
      inserted: insertedCount,
      updated: updatedCount,
      deleted: deletedCount,
    };
  } catch (error) {
    console.error("❌ Unhandled Error in sheets-sync:", error);
    throw createError({
      statusCode: 500,
      message:
        error instanceof Error ? error.message : "An unknown error occurred",
    });
  }
});

function normalizeValue(val: any): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val.toString().toUpperCase();
  if (typeof val === "object") return JSON.stringify(val);
  return String(val).trim();
}
