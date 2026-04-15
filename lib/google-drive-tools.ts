/**
 * Direct Google Drive REST API Tools
 *
 * Calls the Drive API v3 directly with the user's stored OAuth token.
 * Bypasses @markuspfundstein/mcp-gsuite which requires a local process
 * and file-based credentials.
 *
 * Scopes required (requested during OAuth):
 *   - https://www.googleapis.com/auth/drive
 */

const DRIVE_API = "https://www.googleapis.com/drive/v3";

/** Maps common MIME types to friendly labels */
const MIME_LABELS: Record<string, string> = {
  "application/vnd.google-apps.spreadsheet": "Google Sheet",
  "application/vnd.google-apps.document": "Google Doc",
  "application/vnd.google-apps.presentation": "Google Slides",
  "application/vnd.google-apps.folder": "Folder",
  "application/pdf": "PDF",
  "text/plain": "Text",
  "image/jpeg": "JPEG Image",
  "image/png": "PNG Image",
};

function friendlyType(mimeType: string): string {
  return MIME_LABELS[mimeType] || mimeType;
}

export function buildGoogleDriveTools(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    /** Search files in Drive */
    drive_search_files: {
      description:
        "Searches Google Drive for files and folders matching a query. Returns name, type, size, and link.",
      parameters: {
        type: "object" as const,
        properties: {
          query: {
            type: "string",
            description:
              "Search query. Supports Drive query syntax (e.g. \"name contains 'report'\") or a plain text term.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of files to return (default: 10, max: 50).",
          },
          file_type: {
            type: "string",
            enum: ["any", "document", "spreadsheet", "presentation", "folder", "pdf"],
            description:
              "Filter by file type. Options: 'any' (default), 'document', 'spreadsheet', 'presentation', 'folder', 'pdf'.",
          },
        },
        required: ["query"],
      },
      execute: async ({
        query,
        maxResults = 10,
        file_type = "any",
      }: {
        query: string;
        maxResults?: number;
        file_type?: "any" | "document" | "spreadsheet" | "presentation" | "folder" | "pdf";
      }) => {
        const mimeMap: Record<string, string> = {
          document: "application/vnd.google-apps.document",
          spreadsheet: "application/vnd.google-apps.spreadsheet",
          presentation: "application/vnd.google-apps.presentation",
          folder: "application/vnd.google-apps.folder",
          pdf: "application/pdf",
        };

        let q = `trashed=false and fullText contains '${query.replace(/'/g, "\\'")}'`;
        if (file_type !== "any" && mimeMap[file_type]) {
          q += ` and mimeType='${mimeMap[file_type]}'`;
        }

        const params = new URLSearchParams({
          q,
          pageSize: String(Math.min(maxResults, 50)),
          fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,parents)",
          orderBy: "modifiedTime desc",
        });

        const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
        if (!res.ok) throw new Error(`Drive search failed: ${await res.text()}`);
        const data = await res.json();

        return {
          files: (data.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            type: friendlyType(f.mimeType),
            mimeType: f.mimeType,
            size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : null,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
          })),
          total: (data.files || []).length,
        };
      },
    },

    /** Get metadata for a file */
    drive_get_file: {
      description:
        "Gets detailed metadata for a specific Google Drive file by its ID (name, type, owners, created/modified dates).",
      parameters: {
        type: "object" as const,
        properties: {
          file_id: {
            type: "string",
            description: "The Drive file ID.",
          },
        },
        required: ["file_id"],
      },
      execute: async ({ file_id }: { file_id: string }) => {
        const params = new URLSearchParams({
          fields:
            "id,name,mimeType,size,createdTime,modifiedTime,webViewLink,owners,parents,description,starred",
        });
        const res = await fetch(`${DRIVE_API}/files/${file_id}?${params}`, { headers });
        if (!res.ok) throw new Error(`Drive get file failed: ${await res.text()}`);
        const f = await res.json();
        return {
          id: f.id,
          name: f.name,
          type: friendlyType(f.mimeType),
          mimeType: f.mimeType,
          size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : null,
          createdTime: f.createdTime,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
          owners: f.owners?.map((o: any) => o.emailAddress) ?? [],
          description: f.description,
          starred: f.starred,
        };
      },
    },

    /** List files in a specific folder */
    drive_list_folder: {
      description:
        "Lists files and subfolders inside a specific Google Drive folder. Use 'root' as folder_id for the root folder.",
      parameters: {
        type: "object" as const,
        properties: {
          folder_id: {
            type: "string",
            description: "The Drive folder ID. Use 'root' for the root My Drive folder.",
          },
          maxResults: {
            type: "number",
            description: "Maximum number of items to return (default: 20, max: 100).",
          },
        },
        required: ["folder_id"],
      },
      execute: async ({
        folder_id,
        maxResults = 20,
      }: {
        folder_id: string;
        maxResults?: number;
      }) => {
        const params = new URLSearchParams({
          q: `'${folder_id}' in parents and trashed=false`,
          pageSize: String(Math.min(maxResults, 100)),
          fields: "files(id,name,mimeType,size,modifiedTime,webViewLink)",
          orderBy: "folder,name",
        });
        const res = await fetch(`${DRIVE_API}/files?${params}`, { headers });
        if (!res.ok) throw new Error(`Drive list folder failed: ${await res.text()}`);
        const data = await res.json();
        return {
          items: (data.files || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            type: friendlyType(f.mimeType),
            size: f.size ? `${Math.round(Number(f.size) / 1024)} KB` : null,
            modifiedTime: f.modifiedTime,
            webViewLink: f.webViewLink,
          })),
          total: (data.files || []).length,
        };
      },
    },

    /** Read a text file's content from Drive (plain text / Google Doc export) */
    drive_read_file_content: {
      description:
        "Reads the text content of a Drive file. Works for Google Docs (exported as plain text) and plain text files. Not supported for binary files like images or PDFs.",
      parameters: {
        type: "object" as const,
        properties: {
          file_id: {
            type: "string",
            description: "The Drive file ID.",
          },
        },
        required: ["file_id"],
      },
      execute: async ({ file_id }: { file_id: string }) => {
        // First, check mime type
        const metaRes = await fetch(`${DRIVE_API}/files/${file_id}?fields=mimeType,name`, {
          headers,
        });
        if (!metaRes.ok) throw new Error(`Drive file lookup failed: ${await metaRes.text()}`);
        const meta = await metaRes.json();
        const mime = meta.mimeType as string;

        let downloadUrl: string;
        if (mime === "application/vnd.google-apps.document") {
          // Export Google Doc as plain text
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${file_id}/export?mimeType=text/plain`;
        } else if (mime.startsWith("text/") || mime === "application/json") {
          // Download as-is
          downloadUrl = `https://www.googleapis.com/drive/v3/files/${file_id}?alt=media`;
        } else {
          return {
            success: false,
            error: `Cannot read content of file type: ${friendlyType(mime)}. Only Google Docs and text files are supported.`,
          };
        }

        const contentRes = await fetch(downloadUrl, { headers });
        if (!contentRes.ok)
          throw new Error(`Drive read content failed: ${await contentRes.text()}`);
        const text = await contentRes.text();

        return {
          success: true,
          name: meta.name,
          type: friendlyType(mime),
          // Truncate to avoid LLM context overflow
          content: text.slice(0, 8000),
          truncated: text.length > 8000,
          charCount: text.length,
        };
      },
    },

    /** Move a file to a different folder */
    drive_move_file: {
      description: "Moves a Google Drive file to a different folder.",
      parameters: {
        type: "object" as const,
        properties: {
          file_id: {
            type: "string",
            description: "The Drive file ID to move.",
          },
          destination_folder_id: {
            type: "string",
            description: "The ID of the destination folder.",
          },
        },
        required: ["file_id", "destination_folder_id"],
      },
      execute: async ({
        file_id,
        destination_folder_id,
      }: {
        file_id: string;
        destination_folder_id: string;
      }) => {
        // Get current parents
        const metaRes = await fetch(`${DRIVE_API}/files/${file_id}?fields=parents`, { headers });
        if (!metaRes.ok) throw new Error(`Drive file lookup failed: ${await metaRes.text()}`);
        const meta = await metaRes.json();
        const removeParents = (meta.parents || []).join(",");

        const params = new URLSearchParams({
          addParents: destination_folder_id,
          removeParents,
          fields: "id,name,parents",
        });

        const res = await fetch(`${DRIVE_API}/files/${file_id}?${params}`, {
          method: "PATCH",
          headers,
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error(`Drive move failed: ${await res.text()}`);
        const data = await res.json();
        return { success: true, file_id: data.id, name: data.name, new_parents: data.parents };
      },
    },
  };
}
