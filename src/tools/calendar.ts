import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getConfig, buildToolResponse, buildErrorResponse } from "../services/zoho-client.js";

const CHARACTER_LIMIT = 100000;

function truncateResponse(text: string): string {
  if (text.length > CHARACTER_LIMIT) {
    return text.substring(0, CHARACTER_LIMIT) + "\n\n[Response truncated.]";
  }
  return text;
}

function formatResponse(data: unknown): string {
  return truncateResponse(JSON.stringify(data, null, 2));
}

function buildCalendarToolResponse(data: unknown): {
  content: Array<{ type: "text"; text: string }>;
} {
  return {
    content: [{ type: "text" as const, text: formatResponse(data) }],
  };
}

async function calendarRequest(
  path: string,
  method: string = "GET",
  body?: unknown,
  queryParams?: Record<string, string>,
  retried: boolean = false
): Promise<unknown> {
  const config = getConfig();

  // Refresh token if needed
  if (!config.accessToken) {
    const { refreshAccessToken } = await import("../services/zoho-client.js");
    await refreshAccessToken();
  }

  const accountsDomain = config.accountsDomain || "https://accounts.zoho.com";
  // Derive calendar domain from accounts domain
  // e.g. https://accounts.zoho.com -> https://calendar.zoho.com
  // e.g. https://accounts.zoho.eu -> https://calendar.zoho.eu
  const calendarDomain = accountsDomain
    .replace("accounts.zoho", "calendar.zoho")
    .replace(/\/$/, "");

  let url = `${calendarDomain}/api/v1/${path}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const headers: Record<string, string> = {
    Authorization: `Zoho-oauthtoken ${config.accessToken}`,
    "Content-Type": "application/json",
  };

  const fetchOptions: RequestInit = { method, headers };
  if (body) {
    fetchOptions.body = JSON.stringify(body);
  }

  const response = await fetch(url, fetchOptions);

  // Handle token expiry
  if (response.status === 401 && !retried) {
    const { refreshAccessToken } = await import("../services/zoho-client.js");
    await refreshAccessToken();
    return calendarRequest(path, method, body, queryParams, true);
  }

  if (response.status === 204) {
    return { status: "success", message: "No content" };
  }

  const responseText = await response.text();

  if (!response.ok) {
    let errorDetail: string;
    try {
      errorDetail = JSON.stringify(JSON.parse(responseText), null, 2);
    } catch {
      errorDetail = responseText;
    }
    throw new Error(`Zoho Calendar API error (${response.status}): ${errorDetail}`);
  }

  if (!responseText) return { status: "success" };
  return JSON.parse(responseText);
}

export function registerCalendarTools(server: McpServer): void {
  // ─── CALENDARS ───────────────────────────────────────────────────────────────

  server.registerTool(
    "zoho_calendar_get_calendars",
    {
      title: "Get Calendars",
      description: "Fetch all calendars for the authenticated user from Zoho Calendar.",
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await calendarRequest("calendars");
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_create_calendar",
    {
      title: "Create Calendar",
      description: "Create a new calendar in Zoho Calendar.",
      inputSchema: {
        name: z.string().describe("Calendar name"),
        description: z.string().optional().describe("Calendar description"),
        color: z.string().optional().describe("Calendar color (hex, e.g. #FF5733)"),
        timezone: z.string().optional().describe("Timezone (e.g. Asia/Jerusalem)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { name: params.name };
        if (params.description) body.description = params.description;
        if (params.color) body.color = params.color;
        if (params.timezone) body.timezone = params.timezone;
        const data = await calendarRequest("calendars", "POST", body);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_update_calendar",
    {
      title: "Update Calendar",
      description: "Update an existing calendar's properties.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        name: z.string().optional().describe("New calendar name"),
        description: z.string().optional().describe("New description"),
        color: z.string().optional().describe("New color (hex)"),
        timezone: z.string().optional().describe("New timezone"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        if (params.name) body.name = params.name;
        if (params.description) body.description = params.description;
        if (params.color) body.color = params.color;
        if (params.timezone) body.timezone = params.timezone;
        const data = await calendarRequest(`calendars/${params.calendar_id}`, "PUT", body);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_delete_calendar",
    {
      title: "Delete Calendar",
      description: "Delete a calendar from Zoho Calendar.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await calendarRequest(`calendars/${params.calendar_id}`, "DELETE");
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  // ─── EVENTS ──────────────────────────────────────────────────────────────────

  server.registerTool(
    "zoho_calendar_get_events",
    {
      title: "Get Calendar Events",
      description: "Fetch events from a specific calendar. Supports date range filtering.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        range_start: z.string().optional().describe("Start date-time (ISO 8601, e.g. 2026-03-01T00:00:00+02:00)"),
        range_end: z.string().optional().describe("End date-time (ISO 8601, e.g. 2026-03-31T23:59:59+02:00)"),
        limit: z.number().int().min(1).max(200).optional().describe("Max events to return (default 200)"),
        offset: z.number().int().min(0).optional().describe("Pagination offset"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.range_start) query.range_start = params.range_start;
        if (params.range_end) query.range_end = params.range_end;
        if (params.limit) query.limit = String(params.limit);
        if (params.offset) query.offset = String(params.offset);
        const data = await calendarRequest(`calendars/${params.calendar_id}/events`, "GET", undefined, query);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_get_event",
    {
      title: "Get Calendar Event",
      description: "Fetch a specific event by its UID from a calendar.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        event_id: z.string().describe("Event UID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await calendarRequest(`calendars/${params.calendar_id}/events/${params.event_id}`);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_create_event",
    {
      title: "Create Calendar Event",
      description: "Create a new event in a Zoho Calendar. Supports all-day events, timed events, recurrence, and attendees.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        title: z.string().describe("Event title/summary"),
        start: z.string().describe("Start date-time (ISO 8601, e.g. 2026-03-15T10:00:00+02:00)"),
        end: z.string().describe("End date-time (ISO 8601, e.g. 2026-03-15T11:00:00+02:00)"),
        all_day: z.boolean().optional().describe("Is this an all-day event?"),
        description: z.string().optional().describe("Event description/notes"),
        location: z.string().optional().describe("Event location"),
        attendees: z.array(z.object({
          email: z.string().describe("Attendee email"),
          name: z.string().optional().describe("Attendee name"),
        })).optional().describe("List of attendees"),
        reminder_minutes: z.number().int().optional().describe("Reminder in minutes before event"),
        recurrence: z.string().optional().describe("RRULE string for recurring events (e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR)"),
        color: z.string().optional().describe("Event color (hex)"),
        url: z.string().optional().describe("Event URL"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const eventData: Record<string, unknown> = {
          title: params.title,
          dateandtime: {
            start: params.start,
            end: params.end,
            timezone: "Asia/Jerusalem",
          },
        };

        if (params.all_day) {
          eventData.isallday = true;
        }
        if (params.description) eventData.description = params.description;
        if (params.location) eventData.location = params.location;
        if (params.color) eventData.color = params.color;
        if (params.url) eventData.url = params.url;

        if (params.attendees && params.attendees.length > 0) {
          eventData.attendees = params.attendees.map((a) => ({
            email: a.email,
            name: a.name || a.email,
          }));
        }

        if (params.reminder_minutes !== undefined) {
          eventData.reminders = [{ minutes: params.reminder_minutes, action: "popup" }];
        }

        if (params.recurrence) {
          eventData.recurrence = [params.recurrence];
        }

        const body = { eventdata: JSON.stringify(eventData) };
        const data = await calendarRequest(`calendars/${params.calendar_id}/events`, "POST", body);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_update_event",
    {
      title: "Update Calendar Event",
      description: "Update an existing event in a Zoho Calendar.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        event_id: z.string().describe("Event UID"),
        title: z.string().optional().describe("New event title"),
        start: z.string().optional().describe("New start date-time (ISO 8601)"),
        end: z.string().optional().describe("New end date-time (ISO 8601)"),
        description: z.string().optional().describe("New description"),
        location: z.string().optional().describe("New location"),
        attendees: z.array(z.object({
          email: z.string(),
          name: z.string().optional(),
        })).optional(),
        color: z.string().optional(),
        all_day: z.boolean().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const eventData: Record<string, unknown> = {};
        if (params.title) eventData.title = params.title;
        if (params.description) eventData.description = params.description;
        if (params.location) eventData.location = params.location;
        if (params.color) eventData.color = params.color;
        if (params.all_day !== undefined) eventData.isallday = params.all_day;

        if (params.start || params.end) {
          eventData.dateandtime = {
            ...(params.start && { start: params.start }),
            ...(params.end && { end: params.end }),
            timezone: "Asia/Jerusalem",
          };
        }

        if (params.attendees) {
          eventData.attendees = params.attendees.map((a) => ({
            email: a.email,
            name: a.name || a.email,
          }));
        }

        const body = { eventdata: JSON.stringify(eventData) };
        const data = await calendarRequest(
          `calendars/${params.calendar_id}/events/${params.event_id}`,
          "PUT",
          body
        );
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_delete_event",
    {
      title: "Delete Calendar Event",
      description: "Delete an event from a Zoho Calendar.",
      inputSchema: {
        calendar_id: z.string().describe("Calendar UID"),
        event_id: z.string().describe("Event UID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await calendarRequest(
          `calendars/${params.calendar_id}/events/${params.event_id}`,
          "DELETE"
        );
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  server.registerTool(
    "zoho_calendar_search_events",
    {
      title: "Search Calendar Events",
      description: "Search for events across all calendars or a specific calendar by keyword.",
      inputSchema: {
        search_term: z.string().describe("Search keyword"),
        calendar_id: z.string().optional().describe("Limit search to a specific calendar UID"),
        range_start: z.string().optional().describe("Start date-time filter (ISO 8601)"),
        range_end: z.string().optional().describe("End date-time filter (ISO 8601)"),
        limit: z.number().int().min(1).max(200).optional(),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = { searchword: params.search_term };
        if (params.range_start) query.range_start = params.range_start;
        if (params.range_end) query.range_end = params.range_end;
        if (params.limit) query.limit = String(params.limit);

        const path = params.calendar_id
          ? `calendars/${params.calendar_id}/events/search`
          : "events/search";

        const data = await calendarRequest(path, "GET", undefined, query);
        return buildCalendarToolResponse(data);
      } catch (error) {
        return buildErrorResponse(error);
      }
    }
  );

  console.error("Registered Zoho Calendar MCP tools (8 tools)");
}
