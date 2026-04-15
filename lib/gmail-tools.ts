/**
 * Direct Gmail REST API Tools
 *
 * These tools call the Gmail API directly with the user's stored OAuth token.
 * This bypasses the Smithery-hosted MCP server for Gmail, which requires a
 * local process and file-based credentials rather than an HTTP Bearer token.
 *
 * Scopes required (already requested during OAuth):
 *   - https://www.googleapis.com/auth/gmail.readonly
 *   - https://www.googleapis.com/auth/gmail.send
 *   - https://www.googleapis.com/auth/gmail.modify
 *   - https://www.googleapis.com/auth/gmail.compose
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

/** Encode an email to base64url (required by Gmail API send) */
function encodeEmail(to: string, subject: string, body: string, from?: string): string {
  const message = [
    `To: ${to}`,
    from ? `From: ${from}` : "",
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    body,
  ].filter(Boolean).join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function buildGmailTools(accessToken: string) {
  const headers = { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" };

  return {
    /** List recent Gmail messages */
    gmail_list_emails: {
      description: "Lists recent emails from Gmail. Supports a search query (e.g. 'from:boss@company.com') and a maxResults limit.",
      parameters: {
        type: "object" as const,
        properties: {
          query: { type: "string", description: "Gmail search query (e.g. 'from:someone@example.com is:unread'). Leave empty for all recent messages." },
          maxResults: { type: "number", description: "Maximum number of emails to return (default: 10, max: 50)" },
        },
        required: [],
      },
      execute: async ({ query = "", maxResults = 10 }: { query?: string; maxResults?: number }) => {
        const params = new URLSearchParams({ maxResults: String(Math.min(maxResults, 50)) });
        if (query) params.set("q", query);

        const listRes = await fetch(`${GMAIL_API}/messages?${params}`, { headers });
        if (!listRes.ok) throw new Error(`Gmail list failed: ${await listRes.text()}`);
        const listData = await listRes.json();

        if (!listData.messages?.length) return { emails: [], total: 0 };

        // Fetch snippet + subject for each
        const emails = await Promise.all(
          listData.messages.slice(0, maxResults).map(async (m: any) => {
            const msgRes = await fetch(`${GMAIL_API}/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`, { headers });
            if (!msgRes.ok) return { id: m.id };
            const msg = await msgRes.json();
            const getHeader = (name: string) => msg.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";
            return {
              id: m.id,
              thread_id: m.threadId,
              subject: getHeader("Subject"),
              from: getHeader("From"),
              date: getHeader("Date"),
              snippet: msg.snippet,
            };
          })
        );

        return { emails, total: listData.resultSizeEstimate };
      },
    },

    /** Get full content of a single Gmail message */
    gmail_get_email: {
      description: "Gets the full content (body, headers) of a specific Gmail message by its ID.",
      parameters: {
        type: "object" as const,
        properties: {
          message_id: { type: "string", description: "The Gmail message ID returned by gmail_list_emails." },
        },
        required: ["message_id"],
      },
      execute: async ({ message_id }: { message_id: string }) => {
        const res = await fetch(`${GMAIL_API}/messages/${message_id}?format=full`, { headers });
        if (!res.ok) throw new Error(`Gmail get failed: ${await res.text()}`);
        const msg = await res.json();

        const getHeader = (name: string) => msg.payload?.headers?.find((h: any) => h.name === name)?.value ?? "";

        // Decode body
        let body = "";
        const parts = msg.payload?.parts || [msg.payload];
        for (const part of parts) {
          if (part?.mimeType === "text/plain" && part?.body?.data) {
            body = Buffer.from(part.body.data, "base64").toString("utf-8");
            break;
          }
        }

        return {
          id: msg.id,
          subject: getHeader("Subject"),
          from: getHeader("From"),
          to: getHeader("To"),
          date: getHeader("Date"),
          body: body || msg.snippet,
        };
      },
    },

    /** Send an email via Gmail */
    gmail_send_email: {
      description: "Sends an email via the authenticated Gmail account.",
      parameters: {
        type: "object" as const,
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Plain text email body." },
        },
        required: ["to", "subject", "body"],
      },
      execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
        const raw = encodeEmail(to, subject, body);
        const res = await fetch(`${GMAIL_API}/messages/send`, {
          method: "POST",
          headers,
          body: JSON.stringify({ raw }),
        });
        if (!res.ok) throw new Error(`Gmail send failed: ${await res.text()}`);
        const data = await res.json();
        return { success: true, message_id: data.id, thread_id: data.threadId };
      },
    },

    /** Create a Gmail draft */
    gmail_create_draft: {
      description: "Creates a draft email in Gmail without sending it.",
      parameters: {
        type: "object" as const,
        properties: {
          to: { type: "string", description: "Recipient email address." },
          subject: { type: "string", description: "Email subject." },
          body: { type: "string", description: "Plain text email body." },
        },
        required: ["to", "subject", "body"],
      },
      execute: async ({ to, subject, body }: { to: string; subject: string; body: string }) => {
        const raw = encodeEmail(to, subject, body);
        const res = await fetch(`${GMAIL_API}/drafts`, {
          method: "POST",
          headers,
          body: JSON.stringify({ message: { raw } }),
        });
        if (!res.ok) throw new Error(`Gmail draft failed: ${await res.text()}`);
        const data = await res.json();
        return { success: true, draft_id: data.id };
      },
    },
  };
}
