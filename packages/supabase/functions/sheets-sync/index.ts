/**
 * SUPABASE <-> GOOGLE SHEETS SMART SYNC
 * -------------------------------------
 * This script performs a one-way synchronization from Supabase to Google Sheets.
 * It is "Smart" because it:
 * 1. UPDATES existing rows if data changed (preserves manual columns in the Sheet).
 * 2. INSERTS new rows from Supabase.
 * 3. DELETES rows in the Sheet that were removed from Supabase.
 * * USAGE:
 * 1. Install dependencies:
 * npm install @supabase/supabase-js google-spreadsheet google-auth-library dotenv
 * npm install -D typescript ts-node @types/node
 * * 2. Create a .env file with:
 * SUPABASE_URL=...
 * SUPABASE_SERVICE_KEY=...
 * GOOGLE_SHEET_ID=...
 * SYNC_TABLE_NAME=...
 * SYNC_WORKSHEET_NAME=Sheet1
 * SYNC_TABLE_PRIMARY_KEY=id
 * * 3. Place your Google Service Account JSON key in the root as 'credentials.json'
 * * 4. Run:
 * npx ts-node sync-smart.ts
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    GoogleSpreadsheet,
    GoogleSpreadsheetRow,
} from "npm:google-spreadsheet";
import { JWT } from "npm:google-auth-library";

const GOOGLE_SHEET_ID = Deno.env.get("GOOGLE_SHEET_ID")!;
const SYNC_WORKSHEET_NAME = Deno.env.get("SYNC_WORKSHEET_NAME")!;
const SYNC_TABLE_PRIMARY_KEY = Deno.env.get("SYNC_TABLE_PRIMARY_KEY")!;

const GOOGLE_CREDS_PATH = "./credentials.json";

function validateConfig() {
    const missing = [];
    if (!GOOGLE_SHEET_ID) missing.push("GOOGLE_SHEET_ID");
    if (!SYNC_TABLE_PRIMARY_KEY) missing.push("SYNC_TABLE_PRIMARY_KEY");

    if (missing.length > 0) {
        console.error(
            `❌ Missing required environment variables: ${missing.join(", ")}`,
        );
        process.exit(1);
    }

    if (!fs.existsSync(GOOGLE_CREDS_PATH)) {
        console.error(`❌ Credentials file not found at: ${GOOGLE_CREDS_PATH}`);
        process.exit(1);
    }
}

// --- Helpers ---

async function getGoogleSheetDoc(): Promise<GoogleSpreadsheet> {
    const serviceAccountAuth = new JWT({
        keyFile: GOOGLE_CREDS_PATH,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(GOOGLE_SHEET_ID!, serviceAccountAuth);
    await doc.loadInfo();
    return doc;
}

/**
 * Normalizes values for reliable comparison.
 * - Converts null/undefined to empty string.
 * - Converts numbers/booleans to strings.
 * - Trims whitespace.
 */
function normalizeValue(val: any): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "boolean") return val.toString().toUpperCase(); // Sheets uses TRUE/FALSE
    if (typeof val === "object") return JSON.stringify(val); // Handle JSON columns simply
    return String(val).trim();
}

// --- Main Logic ---

async function performSmartSync() {
    console.log(`\n🔄 Starting Smart Sync for table: [voice_actors]`);
    validateConfig();

    // 1. Fetch Supabase Data
    const { data: supabaseRows, error } = await supabaseAdmin
        .from("voice_actors")
        .select("*");

    if (error) {
        console.error("❌ Supabase Error:", error.message);
        process.exit(1);
    }
    console.log(`📥 Supabase: Retrieved ${supabaseRows.length} rows.`);

    // 2. Fetch Google Sheet Data
    const doc = await getGoogleSheetDoc();
    const sheet = SYNC_WORKSHEET_NAME
        ? doc.sheetsByTitle[SYNC_WORKSHEET_NAME]
        : doc.sheetsByIndex[0];

    if (!sheet) {
        console.error(`❌ Worksheet "${SYNC_WORKSHEET_NAME}" not found.`);
        process.exit(1);
    }

    const sheetRows = await sheet.getRows();
    console.log(`📄 Sheet: Found ${sheetRows.length} existing rows.`);

    // 3. Map Sheet Rows by Primary Key for O(1) lookup
    // Map structure: <PrimaryKey, GoogleSpreadsheetRow>
    const sheetRowMap = new Map<string, GoogleSpreadsheetRow<any>>();

    sheetRows.forEach((row) => {
        const rawPk = row.get(SYNC_TABLE_PRIMARY_KEY!);
        if (rawPk) {
            sheetRowMap.set(normalizeValue(rawPk), row);
        }
    });

    // 4. Iterate Supabase Rows (Upsert Strategy)
    let updatedCount = 0;
    let insertedCount = 0;
    const processedSupabaseIds = new Set<string>();

    console.log("⚡ Processing updates and inserts...");

    for (const sbRow of supabaseRows) {
        const pkValue = normalizeValue(sbRow[SYNC_TABLE_PRIMARY_KEY!]);
        processedSupabaseIds.add(pkValue);

        if (sheetRowMap.has(pkValue)) {
            // --- ROW EXISTS: Check for changes ---
            const sheetRow = sheetRowMap.get(pkValue)!;
            let hasChanged = false;

            for (const [key, val] of Object.entries(sbRow)) {
                // Only update if the column header actually exists in the sheet
                // This prevents errors if Supabase has more columns than the Sheet
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
                await sheetRow.save(); // Persist changes to API
                updatedCount++;
            }
        } else {
            // --- ROW DOES NOT EXIST: Insert ---
            await sheet.addRow(sbRow);
            insertedCount++;
        }
    }

    // 5. Handle Deletions
    // Any ID in the Sheet that was NOT in the Supabase batch should be deleted
    let deletedCount = 0;
    const rowsToDelete = sheetRows.filter((row) => {
        const pk = normalizeValue(row.get(SYNC_TABLE_PRIMARY_KEY!));
        return pk && !processedSupabaseIds.has(pk);
    });

    if (rowsToDelete.length > 0) {
        console.log(`🗑️  Found ${rowsToDelete.length} rows to delete...`);
        // Delete in reverse to avoid index shifting issues
        for (const row of rowsToDelete.reverse()) {
            await row.delete();
            deletedCount++;
        }
    }

    // 6. Summary
    console.log("\n✅ Sync Complete!");
    console.table({
        Inserted: insertedCount,
        Updated: updatedCount,
        Deleted: deletedCount,
        "Total Rows (Sheet)": supabaseRows.length,
    });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
    createErrorResponse,
    createResponse,
    handleOptions,
} from "../_shared/http-utils.ts";
import { DatabaseClient } from "../_shared/database.ts";
import { supabase } from "../_shared/database.ts";
import { supabaseAdmin } from "../_shared/database.ts";

Deno.serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return handleOptions();
    }

    try {
        await performSmartSync();

        return createResponse({
            status: "success",
        });
    } catch (error) {
        console.error("❌ Unhandled Error:", error);
        return createErrorResponse(
            error instanceof Error
                ? error.message
                : "An unknown error occurred",
        );
    }
});
