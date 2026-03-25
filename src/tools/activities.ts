import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoClient } from "../client.js";
import { z } from "zod";

export function registerActivityTools(server: McpServer, client: ZohoClient): void {
  // ==================== ACTIVITIES ====================

  server.tool(
    "zoho_get_activities",
    "Fetch activities (Tasks, Events, Calls) associated with records",
    {
      type: z.enum(["tasks", "events", "calls"]).optional().describe("Activity type filter"),
      fields: z.string().optional().describe("Comma-separated field API names"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
      sort_by: z.string().optional(),
      sort_order: z.enum(["asc", "desc"]).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.fields) params.fields = args.fields;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      if (args.sort_by) params.sort_by = args.sort_by;
      if (args.sort_order) params.sort_order = args.sort_order;
      const module = args.type === "tasks" ? "Tasks" : args.type === "events" ? "Events" : args.type === "calls" ? "Calls" : "Activities";
      const result = await client.get(`/${module}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== APPROVALS ====================

  server.tool(
    "zoho_get_approvals",
    "Fetch records pending approval. Returns records awaiting the current user's approval.",
    {},
    async () => {
      const result = await client.get("/approvals");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_approve_record",
    "Approve or reject a record that is pending approval",
    {
      record_id: z.string().describe("Record ID"),
      action: z.enum(["approve", "reject", "delegate"]).describe("Approval action"),
      comments: z.string().optional().describe("Comments for the approval/rejection"),
    },
    async (args) => {
      const body: Record<string, unknown> = { action: args.action };
      if (args.comments) body.comments = args.comments;
      const result = await client.post(`/approvals/${args.record_id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== LEAD CONVERSION ====================

  server.tool(
    "zoho_convert_lead",
    "Convert a lead to contact, account, and optionally a deal",
    {
      lead_id: z.string().describe("Lead record ID"),
      contact_id: z.string().optional().describe("Existing contact ID to link"),
      account_id: z.string().optional().describe("Existing account ID to link"),
      deal_name: z.string().optional().describe("Deal name if creating a deal"),
      deal_data: z.record(z.unknown()).optional().describe("Additional deal fields"),
      notify_lead_owner: z.boolean().optional(),
      notify_new_entity_owner: z.boolean().optional(),
      overwrite: z.boolean().optional(),
    },
    async (args) => {
      const convertData: Record<string, unknown> = {};
      if (args.contact_id) convertData.Contacts = { id: args.contact_id, overwrite: args.overwrite };
      if (args.account_id) convertData.Accounts = { id: args.account_id, overwrite: args.overwrite };
      if (args.deal_name) {
        convertData.Deals = { Deal_Name: args.deal_name, ...(args.deal_data || {}) };
      }
      if (args.notify_lead_owner !== undefined) convertData.notify_lead_owner = args.notify_lead_owner;
      if (args.notify_new_entity_owner !== undefined) convertData.notify_new_entity_owner = args.notify_new_entity_owner;
      const result = await client.post(`/Leads/${args.lead_id}/actions/convert`, { data: [convertData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== RECORD OWNERSHIP & SHARING ====================

  server.tool(
    "zoho_change_owner",
    "Transfer ownership of records to a different user",
    {
      module: z.string().describe("Module API name"),
      record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
      owner_id: z.string().describe("New owner user ID"),
      notify: z.boolean().optional().describe("Notify the new owner"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        owner: { id: args.owner_id },
        ids: args.record_ids,
      };
      if (args.notify !== undefined) body.notify = args.notify;
      const result = await client.post(`/${args.module}/actions/change_owner`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_share_record",
    "Share a record with specific users or groups with defined permissions",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      user_id: z.string().describe("User ID to share with"),
      permission: z.enum(["read-only", "read-write", "full-access"]).describe("Permission level"),
    },
    async (args) => {
      const body = {
        share: [{ user: { id: args.user_id }, permission: args.permission }],
      };
      const result = await client.post(`/${args.module}/${args.record_id}/actions/share`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_shared_details",
    "Get sharing details for a specific record - who has access and with what permissions",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
    },
    async (args) => {
      const result = await client.get(`/${args.module}/${args.record_id}/actions/share`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== EMAIL ====================

  server.tool(
    "zoho_send_email",
    "Send an email from Zoho CRM associated with a record",
    {
      module: z.string().describe("Module API name (e.g., Leads, Contacts)"),
      record_id: z.string().describe("Record ID"),
      from_email: z.string().describe("Sender email address (must be configured in CRM)"),
      to_emails: z.array(z.string()).min(1).describe("Array of recipient email addresses"),
      subject: z.string().describe("Email subject"),
      content: z.string().describe("Email body (HTML supported)"),
      cc: z.array(z.string()).optional().describe("CC email addresses"),
      bcc: z.array(z.string()).optional().describe("BCC email addresses"),
      mail_format: z.enum(["text", "html"]).optional().default("html"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        from: { user_name: args.from_email, email: args.from_email },
        to: args.to_emails.map((e) => ({ email: e })),
        subject: args.subject,
        content: args.content,
        mail_format: args.mail_format || "html",
      };
      if (args.cc && args.cc.length > 0) body.cc = args.cc.map((e) => ({ email: e }));
      if (args.bcc && args.bcc.length > 0) body.bcc = args.bcc.map((e) => ({ email: e }));
      const result = await client.post(`/${args.module}/${args.record_id}/actions/send_mail`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== RECORD LOCKING ====================

  server.tool(
    "zoho_lock_record",
    "Lock a record to prevent modifications",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      locked_reason: z.string().optional().describe("Reason for locking"),
    },
    async (args) => {
      const body: Record<string, unknown> = {};
      if (args.locked_reason) body.locked_reason = args.locked_reason;
      const result = await client.post(`/${args.module}/${args.record_id}/actions/lock`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_unlock_record",
    "Unlock a previously locked record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      lock_id: z.string().describe("Lock ID"),
    },
    async (args) => {
      const result = await client.delete(`/${args.module}/${args.record_id}/actions/lock/${args.lock_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== USER GROUPS ====================

  server.tool(
    "zoho_get_usergroups",
    "Fetch user groups for the authenticated user or their team",
    {
      mine: z.boolean().optional().describe("If true, returns only groups the authenticated user belongs to"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.mine !== undefined) params.mine = args.mine;
      const result = await client.get("/settings/user_groups", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
