/**
 * Direct Google Calendar REST API Tools
 *
 * Calls the Calendar API directly with the user's stored OAuth token.
 * Bypasses @markuspfundstein/mcp-gsuite which requires a local process
 * and file-based credentials.
 *
 * Scopes required (requested during OAuth):
 *   - https://www.googleapis.com/auth/calendar
 */

const CAL_API = "https://www.googleapis.com/calendar/v3";

export function buildGoogleCalendarTools(accessToken: string) {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  return {
    /** List upcoming calendar events */
    calendar_list_events: {
      description:
        "Lists upcoming events from the user's primary Google Calendar. Supports filtering by date range and a max result count.",
      parameters: {
        type: "object" as const,
        properties: {
          maxResults: {
            type: "number",
            description: "Maximum number of events to return (default: 10, max: 50).",
          },
          timeMin: {
            type: "string",
            description:
              "Lower bound (inclusive) for an event's start time (RFC3339, e.g. '2025-04-15T00:00:00Z'). Defaults to now.",
          },
          timeMax: {
            type: "string",
            description:
              "Upper bound (exclusive) for an event's start time (RFC3339, e.g. '2025-04-30T23:59:59Z').",
          },
          query: {
            type: "string",
            description: "Free-text search term to filter events by title or description.",
          },
        },
        required: [],
      },
      execute: async ({
        maxResults = 10,
        timeMin,
        timeMax,
        query,
      }: {
        maxResults?: number;
        timeMin?: string;
        timeMax?: string;
        query?: string;
      }) => {
        const params = new URLSearchParams({
          maxResults: String(Math.min(maxResults, 50)),
          singleEvents: "true",
          orderBy: "startTime",
          timeMin: timeMin || new Date().toISOString(),
        });
        if (timeMax) params.set("timeMax", timeMax);
        if (query) params.set("q", query);

        const res = await fetch(`${CAL_API}/calendars/primary/events?${params}`, { headers });
        if (!res.ok) throw new Error(`Calendar list failed: ${await res.text()}`);
        const data = await res.json();

        const events = (data.items || []).map((e: any) => ({
          id: e.id,
          summary: e.summary,
          description: e.description,
          location: e.location,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          status: e.status,
          htmlLink: e.htmlLink,
          attendees: e.attendees?.map((a: any) => a.email) ?? [],
        }));

        return { events, total: events.length };
      },
    },

    /** Get a single calendar event by ID */
    calendar_get_event: {
      description: "Gets the full details of a specific Google Calendar event by its ID.",
      parameters: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "string",
            description: "The event ID returned by calendar_list_events.",
          },
        },
        required: ["event_id"],
      },
      execute: async ({ event_id }: { event_id: string }) => {
        const res = await fetch(`${CAL_API}/calendars/primary/events/${event_id}`, { headers });
        if (!res.ok) throw new Error(`Calendar get event failed: ${await res.text()}`);
        const e = await res.json();
        return {
          id: e.id,
          summary: e.summary,
          description: e.description,
          location: e.location,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          status: e.status,
          htmlLink: e.htmlLink,
          attendees: e.attendees?.map((a: any) => ({ email: a.email, status: a.responseStatus })) ?? [],
          organizer: e.organizer?.email,
          created: e.created,
          updated: e.updated,
        };
      },
    },

    /** Create a calendar event / send an invite */
    calendar_create_event: {
      description:
        "Creates a new event on the user's primary Google Calendar and sends email invites to all attendees. Supports Google Meet links, timezones, reminders, and all-day events.",
      parameters: {
        type: "object" as const,
        properties: {
          summary: {
            type: "string",
            description: "Event title (e.g. 'Team Sync', 'Product Review').",
          },
          description: {
            type: "string",
            description: "Event description, agenda, or notes shown to all attendees.",
          },
          location: {
            type: "string",
            description: "Physical address or virtual meeting URL.",
          },
          start_datetime: {
            type: "string",
            description:
              "Start date/time in RFC3339 format including timezone offset (e.g. '2025-04-20T14:00:00+08:00'). For all-day events use 'YYYY-MM-DD'.",
          },
          end_datetime: {
            type: "string",
            description:
              "End date/time in RFC3339 format (e.g. '2025-04-20T15:00:00+08:00'). For all-day events use 'YYYY-MM-DD'.",
          },
          timezone: {
            type: "string",
            description:
              "IANA timezone name for the event (e.g. 'Asia/Singapore', 'America/New_York'). Defaults to UTC if omitted.",
          },
          attendee_emails: {
            type: "array",
            items: { type: "string" },
            description:
              "List of attendee email addresses to invite. Each attendee receives a Google Calendar email invitation.",
          },
          add_google_meet: {
            type: "boolean",
            description:
              "If true, automatically generates a Google Meet video conference link and attaches it to the event.",
          },
          all_day: {
            type: "boolean",
            description:
              "If true, treats start_datetime and end_datetime as plain dates (YYYY-MM-DD) to create an all-day event.",
          },
          email_reminders_minutes: {
            type: "array",
            items: { type: "number" },
            description:
              "List of minutes before the event to send email reminders to all attendees (e.g. [1440, 60] for 1 day and 1 hour before).",
          },
          popup_reminder_minutes: {
            type: "number",
            description:
              "Minutes before the event to show a popup reminder (e.g. 10). Defaults to 10 if not specified.",
          },
          guests_can_invite_others: {
            type: "boolean",
            description: "Whether attendees can invite other guests. Defaults to false.",
          },
          guests_can_modify: {
            type: "boolean",
            description: "Whether attendees can modify the event. Defaults to false.",
          },
        },
        required: ["summary", "start_datetime", "end_datetime"],
      },
      execute: async ({
        summary,
        description,
        location,
        start_datetime,
        end_datetime,
        timezone,
        attendee_emails = [],
        add_google_meet = false,
        all_day = false,
        email_reminders_minutes = [],
        popup_reminder_minutes,
        guests_can_invite_others = false,
        guests_can_modify = false,
      }: {
        summary: string;
        description?: string;
        location?: string;
        start_datetime: string;
        end_datetime: string;
        timezone?: string;
        attendee_emails?: string[];
        add_google_meet?: boolean;
        all_day?: boolean;
        email_reminders_minutes?: number[];
        popup_reminder_minutes?: number;
        guests_can_invite_others?: boolean;
        guests_can_modify?: boolean;
      }) => {
        const tz = timezone || "UTC";

        // Build start/end — all-day events use { date } instead of { dateTime }
        const start = all_day
          ? { date: start_datetime.slice(0, 10) }
          : { dateTime: start_datetime, timeZone: tz };
        const end = all_day
          ? { date: end_datetime.slice(0, 10) }
          : { dateTime: end_datetime, timeZone: tz };

        // Build reminders
        const overrides: any[] = [];
        for (const mins of email_reminders_minutes) {
          overrides.push({ method: "email", minutes: mins });
        }
        if (popup_reminder_minutes !== undefined) {
          overrides.push({ method: "popup", minutes: popup_reminder_minutes });
        }

        const body: any = {
          summary,
          start,
          end,
          guestsCanInviteOthers: guests_can_invite_others,
          guestsCanModify: guests_can_modify,
          reminders: overrides.length > 0
            ? { useDefault: false, overrides }
            : { useDefault: true },
        };

        if (description) body.description = description;
        if (location) body.location = location;

        if (attendee_emails.length > 0) {
          body.attendees = attendee_emails.map((email) => ({ email }));
          // sendUpdates=all ensures Google sends the invite email to each attendee
        }

        // Google Meet: pass conferenceData with a createRequest
        let queryParams = "sendUpdates=all";
        if (add_google_meet) {
          body.conferenceData = {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
          queryParams += "&conferenceDataVersion=1";
        }

        const res = await fetch(
          `${CAL_API}/calendars/primary/events?${queryParams}`,
          { method: "POST", headers, body: JSON.stringify(body) }
        );
        if (!res.ok) throw new Error(`Calendar create event failed: ${await res.text()}`);
        const e = await res.json();

        const meetLink =
          e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
          null;

        return {
          success: true,
          event_id: e.id,
          calendar_link: e.htmlLink,
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          timezone: tz,
          attendees: attendee_emails,
          invites_sent: attendee_emails.length > 0,
          google_meet_link: meetLink,
        };
      },
    },

    /** Update an existing calendar event */
    calendar_update_event: {
      description:
        "Updates an existing Google Calendar event. Can change the title, description, time, location, attendees, or add a Google Meet link. Only fields you provide are changed.",
      parameters: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "string",
            description: "The event ID to update (from calendar_list_events or calendar_create_event).",
          },
          summary: { type: "string", description: "New event title." },
          description: { type: "string", description: "New description or agenda." },
          location: { type: "string", description: "New physical or virtual location." },
          start_datetime: {
            type: "string",
            description: "New start date/time in RFC3339 format.",
          },
          end_datetime: {
            type: "string",
            description: "New end date/time in RFC3339 format.",
          },
          timezone: {
            type: "string",
            description: "IANA timezone name (e.g. 'Asia/Singapore').",
          },
          add_attendee_emails: {
            type: "array",
            items: { type: "string" },
            description: "Additional attendee emails to add to the event.",
          },
          add_google_meet: {
            type: "boolean",
            description: "If true, adds a Google Meet link to the event.",
          },
        },
        required: ["event_id"],
      },
      execute: async ({
        event_id,
        summary,
        description,
        location,
        start_datetime,
        end_datetime,
        timezone,
        add_attendee_emails = [],
        add_google_meet = false,
      }: {
        event_id: string;
        summary?: string;
        description?: string;
        location?: string;
        start_datetime?: string;
        end_datetime?: string;
        timezone?: string;
        add_attendee_emails?: string[];
        add_google_meet?: boolean;
      }) => {
        // Fetch existing event first to merge changes
        const existing = await fetch(
          `${CAL_API}/calendars/primary/events/${event_id}`,
          { headers }
        );
        if (!existing.ok) throw new Error(`Calendar get event failed: ${await existing.text()}`);
        const current = await existing.json();

        const tz = timezone || current.start?.timeZone || "UTC";
        const patch: any = { ...current };

        if (summary) patch.summary = summary;
        if (description) patch.description = description;
        if (location) patch.location = location;
        if (start_datetime) patch.start = { dateTime: start_datetime, timeZone: tz };
        if (end_datetime) patch.end = { dateTime: end_datetime, timeZone: tz };

        // Merge new attendees with existing ones (deduplicated)
        if (add_attendee_emails.length > 0) {
          const existingEmails = new Set(
            (current.attendees || []).map((a: any) => a.email)
          );
          const newAttendees = add_attendee_emails
            .filter((e) => !existingEmails.has(e))
            .map((email) => ({ email }));
          patch.attendees = [...(current.attendees || []), ...newAttendees];
        }

        let queryParams = "sendUpdates=all";
        if (add_google_meet && !current.conferenceData) {
          patch.conferenceData = {
            createRequest: {
              requestId: `meet-${Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          };
          queryParams += "&conferenceDataVersion=1";
        }

        const res = await fetch(
          `${CAL_API}/calendars/primary/events/${event_id}?${queryParams}`,
          { method: "PUT", headers, body: JSON.stringify(patch) }
        );
        if (!res.ok) throw new Error(`Calendar update event failed: ${await res.text()}`);
        const e = await res.json();

        const meetLink =
          e.conferenceData?.entryPoints?.find((ep: any) => ep.entryPointType === "video")?.uri ||
          null;

        return {
          success: true,
          event_id: e.id,
          calendar_link: e.htmlLink,
          summary: e.summary,
          start: e.start?.dateTime || e.start?.date,
          end: e.end?.dateTime || e.end?.date,
          attendees: (e.attendees || []).map((a: any) => a.email),
          google_meet_link: meetLink,
        };
      },
    },

    /** Delete a calendar event */
    calendar_delete_event: {
      description: "Deletes (cancels) a specific Google Calendar event by its ID.",
      parameters: {
        type: "object" as const,
        properties: {
          event_id: {
            type: "string",
            description: "The event ID to delete.",
          },
        },
        required: ["event_id"],
      },
      execute: async ({ event_id }: { event_id: string }) => {
        const res = await fetch(`${CAL_API}/calendars/primary/events/${event_id}`, {
          method: "DELETE",
          headers,
        });
        if (!res.ok && res.status !== 204) {
          throw new Error(`Calendar delete event failed: ${await res.text()}`);
        }
        return { success: true, deleted_event_id: event_id };
      },
    },
  };
}
