/**
 * Direct Google Sheets REST API Tools
 *
 * Calls the Sheets API v4 directly with the user's stored OAuth token.
 * Bypasses @markuspfundstein/mcp-gsuite which requires a local process
 * and file-based credentials.
 *
 * Scopes required (requested during OAuth):
 *   - https://www.googleapis.com/auth/spreadsheets
 *   - https://www.googleapis.com/auth/drive.readonly
 */

const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DRIVE_API = "https://www.googleapis.com/drive/v3";

export function buildGoogleSheetsTools(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    /** List user's spreadsheets from Drive */
    sheets_list_spreadsheets: {
      description:
        "Lists the user's Google Sheets spreadsheets from Drive. Supports a search query and max result count.",
      parameters: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description: "Optional search term to filter spreadsheets by name.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of spreadsheets to return (default: 10, max: 50).",
          },
        },
        required: [],
      },
      execute: async ({
        query,
        maxResults = 10,
      }: {
        query?: string;
        maxResults?: number;
      }) => {
        let q = "mimeType='application/vnd.google-apps.spreadsheet' and trashed=false";
        if (query) q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
        const params = new URLSearchParams({
          q,
          pageSize: String(Math.min(maxResults, 50)),
          fields: "files(id,name,webViewLink,modifiedTime)",
        });
        const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
        if (!res.ok) throw new Error(`Sheets list failed: ${await res.text()}`);
        const data = await res.json();
        return { spreadsheets: data.files || [] };
      },
    },

    /** Read values from a sheet range */
    sheets_read_range: {
      description:
        "Reads cell values from a specific range in a Google Sheets spreadsheet (e.g. 'Sheet1!A1:D10').",
      parameters: {
        type: "object" as const,
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The spreadsheet ID (from the URL or returned by sheets_list_spreadsheets).",
          },
          range: {
            type: "string",
            description: "A1 notation range (e.g. 'Sheet1!A1:D10' or 'A1:Z100').",
          },
        },
        required: ["spreadsheet_id", "range"],
      },
      execute: async ({ spreadsheet_id, range }: { spreadsheet_id: string; range: string }) => {
        const params = new URLSearchParams({ valueRenderOption: "FORMATTED_VALUE" });
        const res = await fetch(
          `${SHEETS_API}/${spreadsheet_id}/values/${encodeURIComponent(range)}?${params}`,
          { headers }
        );
        if (!res.ok) throw new Error(`Sheets read failed: ${await res.text()}`);
        const data = await res.json();
        return {
          range: data.range,
          rows: data.values || [],
          rowCount: (data.values || []).length,
        };
      },
    },

    /** Write/update values in a sheet range */
    sheets_write_range: {
      description:
        "Writes values to a specific range in a Google Sheets spreadsheet. Overwrites existing values.",
      parameters: {
        type: "object" as const,
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The spreadsheet ID.",
          },
          range: {
            type: "string",
            description: "A1 notation range to write to (e.g. 'Sheet1!A1').",
          },
          values: {
            type: "array",
            items: { type: "array", items: {} },
            description:
              "2D array of values to write. Each inner array is one row. Example: [['Name','Score'],['Alice',95]].",
          },
        },
        required: ["spreadsheet_id", "range", "values"],
      },
      execute: async ({
        spreadsheet_id,
        range,
        values,
      }: {
        spreadsheet_id: string;
        range: string;
        values: any[][];
      }) => {
        const res = await fetch(
          `${SHEETS_API}/${spreadsheet_id}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
          {
            method: "PUT",
            headers,
            body: JSON.stringify({ range, majorDimension: "ROWS", values }),
          }
        );
        if (!res.ok) throw new Error(`Sheets write failed: ${await res.text()}`);
        const data = await res.json();
        return {
          success: true,
          updatedRange: data.updatedRange,
          updatedRows: data.updatedRows,
          updatedCells: data.updatedCells,
        };
      },
    },

    /** Append rows to a sheet */
    sheets_append_rows: {
      description:
        "Appends new rows of data to the end of an existing table in a Google Sheets spreadsheet.",
      parameters: {
        type: "object" as const,
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The spreadsheet ID.",
          },
          range: {
            type: "string",
            description:
              "The range that identifies the table to append to (e.g. 'Sheet1!A1'). The API will find the first empty row.",
          },
          values: {
            type: "array",
            items: { type: "array", items: {} },
            description: "2D array of rows to append. Example: [['Bob',88],['Carol',72]].",
          },
        },
        required: ["spreadsheet_id", "range", "values"],
      },
      execute: async ({
        spreadsheet_id,
        range,
        values,
      }: {
        spreadsheet_id: string;
        range: string;
        values: any[][];
      }) => {
        const res = await fetch(
          `${SHEETS_API}/${spreadsheet_id}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
          {
            method: "POST",
            headers,
            body: JSON.stringify({ majorDimension: "ROWS", values }),
          }
        );
        if (!res.ok) throw new Error(`Sheets append failed: ${await res.text()}`);
        const data = await res.json();
        return {
          success: true,
          updatedRange: data.updates?.updatedRange,
          updatedRows: data.updates?.updatedRows,
        };
      },
    },

    /** Get sheet metadata (sheet names, dimensions) */
    sheets_get_metadata: {
      description:
        "Gets the metadata for a Google Sheets spreadsheet: title, sheet names, and row/column dimensions.",
      parameters: {
        type: "object" as const,
        properties: {
          spreadsheet_id: {
            type: "string",
            description: "The spreadsheet ID.",
          },
        },
        required: ["spreadsheet_id"],
      },
      execute: async ({ spreadsheet_id }: { spreadsheet_id: string }) => {
        const params = new URLSearchParams({
          fields: "spreadsheetId,properties.title,sheets.properties",
        });
        const res = await fetch(`${SHEETS_API}/${spreadsheet_id}?${params}`, { headers });
        if (!res.ok) throw new Error(`Sheets metadata failed: ${await res.text()}`);
        const data = await res.json();
        return {
          spreadsheet_id: data.spreadsheetId,
          title: data.properties?.title,
          sheets: (data.sheets || []).map((s: any) => ({
            title: s.properties?.title,
            sheetId: s.properties?.sheetId,
            rowCount: s.properties?.gridProperties?.rowCount,
            columnCount: s.properties?.gridProperties?.columnCount,
          })),
        };
      },
    },

    /** Create a new Google Sheets spreadsheet */
    sheets_create_spreadsheet: {
      description:
        "Creates a new Google Sheets spreadsheet with a given title. Optionally define named sheets and seed each sheet with initial data rows (e.g. headers + data). Returns the new spreadsheet ID and a direct link to open it.",
      parameters: {
        type: "object" as const,
        properties: {
          title: {
            type: "string",
            description: "The title of the new spreadsheet (e.g. 'Q2 Sales Report').",
          },
          sheets: {
            type: "array",
            description:
              "Optional list of sheets to create inside the spreadsheet. If omitted, a single 'Sheet1' is created.",
            items: {
              type: "object",
              properties: {
                title: {
                  type: "string",
                  description: "Name of the sheet tab (e.g. 'Summary', 'Raw Data').",
                },
                data: {
                  type: "array",
                  items: { type: "array", items: {} },
                  description:
                    "Optional 2D array of initial values to write into this sheet starting at A1. Example: [['Name','Score'],['Alice',95],['Bob',88]].",
                },
              },
              required: ["title"],
            },
          },
        },
        required: ["title"],
      },
      execute: async ({
        title,
        sheets: sheetDefs = [],
      }: {
        title: string;
        sheets?: { title: string; data?: any[][] }[];
      }) => {
        // Build the creation payload — define sheet tabs upfront
        const sheetTitles = sheetDefs.length > 0 ? sheetDefs : [{ title: "Sheet1" }];
        const body: any = {
          properties: { title },
          sheets: sheetTitles.map((s, idx) => ({
            properties: { sheetId: idx, title: s.title },
          })),
        };

        const createRes = await fetch(SHEETS_API, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
        if (!createRes.ok)
          throw new Error(`Sheets create failed: ${await createRes.text()}`);
        const created = await createRes.json();

        const spreadsheetId: string = created.spreadsheetId;
        const spreadsheetUrl: string = created.spreadsheetUrl;

        // Write seed data for each sheet that has data defined
        const sheetsWithData = sheetTitles.filter((s) => s.data && s.data.length > 0);
        if (sheetsWithData.length > 0) {
          const valueRanges = sheetsWithData.map((s) => ({
            range: `${s.title}!A1`,
            majorDimension: "ROWS",
            values: s.data,
          }));

          const batchRes = await fetch(
            `${SHEETS_API}/${spreadsheetId}/values:batchUpdate`,
            {
              method: "POST",
              headers,
              body: JSON.stringify({
                valueInputOption: "USER_ENTERED",
                data: valueRanges,
              }),
            }
          );
          if (!batchRes.ok)
            throw new Error(`Sheets seed data write failed: ${await batchRes.text()}`);
        }

        return {
          success: true,
          spreadsheet_id: spreadsheetId,
          title,
          url: spreadsheetUrl,
          sheets: sheetTitles.map((s) => s.title),
          seeded_sheets: sheetsWithData.map((s) => s.title),
        };
      },
    },
  };
}
