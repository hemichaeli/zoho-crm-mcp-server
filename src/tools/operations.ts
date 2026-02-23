import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoRequest, buildToolResponse, buildErrorResponse } from "../services/zoho-client.js";

export function registerOperationTools(server: McpServer): void {

  // ====================== TAGS ======================

  server.registerTool(
    "zoho_get_tags",
    {
      title: "Get Tags",
      description: `Fetch all tags for a specific module.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/tags?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_create_tags",
    {
      title: "Create Tags",
      description: `Create new tags for a module. Provide an array of tag names.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        tags: z.array(z.string()).min(1).max(50).describe("Array of tag names to create"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = { tags: params.tags.map(name => ({ name })) };
        const data = await zohoRequest(`settings/tags?module=${params.module}`, "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_update_tag",
    {
      title: "Update Tag",
      description: `Rename an existing tag.`,
      inputSchema: {
        tag_id: z.string().describe("Tag ID"),
        module: z.string().describe("Module API name"),
        new_name: z.string().describe("New tag name"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = { tags: [{ name: params.new_name }] };
        const data = await zohoRequest(`settings/tags/${params.tag_id}?module=${params.module}`, "PUT", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_delete_tag",
    {
      title: "Delete Tag",
      description: `Delete a tag from the module.`,
      inputSchema: {
        tag_id: z.string().describe("Tag ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/tags/${params.tag_id}`, "DELETE");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_add_tags_to_records",
    {
      title: "Add Tags to Records",
      description: `Add tags to one or more records in a module.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
        tag_names: z.array(z.string()).min(1).max(10).describe("Array of tag names to add"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          data: params.record_ids.map(id => ({ id })),
          tag_names: params.tag_names,
        };
        const data = await zohoRequest(`${params.module}/actions/add_tags`, "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_remove_tags_from_records",
    {
      title: "Remove Tags from Records",
      description: `Remove tags from one or more records in a module.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
        tag_names: z.array(z.string()).min(1).max(10).describe("Array of tag names to remove"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          data: params.record_ids.map(id => ({ id })),
          tag_names: params.tag_names,
        };
        const data = await zohoRequest(`${params.module}/actions/remove_tags`, "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== BLUEPRINT ======================

  server.registerTool(
    "zoho_get_blueprint",
    {
      title: "Get Blueprint",
      description: `Fetch the blueprint (process flow) for a specific record.
Returns available transitions and required fields for the current state.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`${params.module}/${params.record_id}/actions/blueprint`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_update_blueprint",
    {
      title: "Update Blueprint Transition",
      description: `Execute a blueprint transition for a record.
Provide the transition ID and any required fields for the transition.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        transition_id: z.string().describe("Transition ID"),
        data: z.record(z.string(), z.unknown()).optional().describe("Required field values for the transition"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          blueprint: [{
            transition_id: params.transition_id,
            data: params.data || {},
          }],
        };
        const data = await zohoRequest(`${params.module}/${params.record_id}/actions/blueprint`, "PUT", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== BULK OPERATIONS ======================

  server.registerTool(
    "zoho_bulk_read_create_job",
    {
      title: "Create Bulk Read Job",
      description: `Create a bulk read job to export large amounts of data from a module.
Returns a job ID to check status and download results.

Args:
  - module: Module API name
  - criteria: Optional filter criteria (group conditions)
  - fields: Fields to include in export
  - page: Page number for pagination`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        fields: z.array(z.string()).optional().describe("Field API names to export"),
        criteria: z.record(z.string(), z.unknown()).optional().describe("Filter criteria object"),
        page: z.number().int().min(1).optional().describe("Page number"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, unknown> = {
          module: { api_name: params.module },
        };
        if (params.fields) {
          query.file_type = "csv";
          query.fields = params.fields.map(f => ({ api_name: f }));
        }
        if (params.criteria) query.criteria = params.criteria;
        if (params.page) query.page = params.page;
        const body = { query };
        const data = await zohoRequest("bulk-read", "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_bulk_read_get_job",
    {
      title: "Get Bulk Read Job Status",
      description: `Check the status of a bulk read job. When complete, provides download URL.`,
      inputSchema: {
        job_id: z.string().describe("Bulk read job ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`bulk-read/${params.job_id}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_bulk_write_create_job",
    {
      title: "Create Bulk Write Job",
      description: `Create a bulk write job to import large amounts of data into a module.
First upload a CSV file, then create the job referencing the file.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        file_id: z.string().describe("Uploaded file ID"),
        operation: z.enum(["insert", "update", "upsert"]).describe("Operation type"),
        find_by: z.string().optional().describe("Field API name for duplicate check (for upsert)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const resource: Record<string, unknown> = {
          type: "data",
          module: { api_name: params.module },
          file_id: params.file_id,
        };
        if (params.find_by) resource.find_by = params.find_by;
        const body = {
          operation: params.operation,
          resource: [resource],
        };
        const data = await zohoRequest("bulk-write", "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_bulk_write_get_job",
    {
      title: "Get Bulk Write Job Status",
      description: `Check the status of a bulk write job.`,
      inputSchema: {
        job_id: z.string().describe("Bulk write job ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`bulk-write/${params.job_id}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== NOTIFICATIONS ======================

  server.registerTool(
    "zoho_enable_notifications",
    {
      title: "Enable Notifications (Watch)",
      description: `Subscribe to notifications for changes in a module.
Get notified when records are created, updated, or deleted.

Args:
  - channel_id: Unique channel identifier
  - events: Array of event types (e.g., ["Leads.create", "Leads.edit", "Leads.delete"])
  - notify_url: URL to receive notifications
  - token: Optional verification token`,
      inputSchema: {
        channel_id: z.string().describe("Unique channel ID (numeric string)"),
        events: z.array(z.string()).min(1).describe('Event types like "Leads.create", "Deals.edit"'),
        notify_url: z.string().describe("Webhook URL to receive notifications"),
        token: z.string().optional().describe("Optional verification token"),
        channel_expiry: z.string().optional().describe("Expiry datetime in ISO format"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const watchItem: Record<string, unknown> = {
          channel_id: params.channel_id,
          events: params.events,
          notify_url: params.notify_url,
        };
        if (params.token) watchItem.token = params.token;
        if (params.channel_expiry) watchItem.channel_expiry = params.channel_expiry;
        const body = { watch: [watchItem] };
        const data = await zohoRequest("actions/watch", "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_get_notification_details",
    {
      title: "Get Notification Details",
      description: `Fetch details about active notification channels.`,
      inputSchema: {
        channel_ids: z.string().optional().describe("Comma-separated channel IDs"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.channel_ids) query.channel_ids = params.channel_ids;
        const data = await zohoRequest("actions/watch", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_disable_notifications",
    {
      title: "Disable Notifications",
      description: `Unsubscribe from notifications for specific channels and events.`,
      inputSchema: {
        channel_ids: z.array(z.string()).min(1).describe("Channel IDs to disable"),
        events: z.array(z.string()).optional().describe("Specific events to disable"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          watch: params.channel_ids.map(id => ({
            channel_id: id,
            ...(params.events ? { events: params.events } : {}),
          })),
        };
        const data = await zohoRequest("actions/watch", "PATCH", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== TIMELINE ======================

  server.registerTool(
    "zoho_get_timeline",
    {
      title: "Get Record Timeline",
      description: `Fetch the timeline (activity history) of a specific record.
Shows all actions performed on the record including edits, notes, emails, etc.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        per_page: z.number().int().min(1).max(200).optional().describe("Records per page"),
        page_token: z.string().optional().describe("Page token for pagination"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.per_page) query.per_page = String(params.per_page);
        if (params.page_token) query.page_token = params.page_token;
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/__timeline`,
          "GET", undefined, query
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== ACTIVITIES ======================

  server.registerTool(
    "zoho_get_activities",
    {
      title: "Get Activities",
      description: `Fetch activities (Tasks, Events, Calls) associated with records.
Use this to get a combined view of all activity types.`,
      inputSchema: {
        type: z.enum(["tasks", "events", "calls"]).optional().describe("Activity type filter"),
        per_page: z.number().int().min(1).max(200).optional().describe("Records per page"),
        page: z.number().int().min(1).optional().describe("Page number"),
        fields: z.string().optional().describe("Comma-separated field API names"),
        sort_by: z.string().optional().describe("Field to sort by"),
        sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        let module = "Activities";
        if (params.type === "tasks") module = "Tasks";
        else if (params.type === "events") module = "Events";
        else if (params.type === "calls") module = "Calls";

        const query: Record<string, string> = {};
        if (params.per_page) query.per_page = String(params.per_page);
        if (params.page) query.page = String(params.page);
        if (params.fields) query.fields = params.fields;
        if (params.sort_by) query.sort_by = params.sort_by;
        if (params.sort_order) query.sort_order = params.sort_order;

        const data = await zohoRequest(module, "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== EMAIL ======================

  server.registerTool(
    "zoho_send_email",
    {
      title: "Send Email",
      description: `Send an email from Zoho CRM associated with a record.
The email is logged in the record's timeline.`,
      inputSchema: {
        module: z.string().describe("Module API name (e.g., Leads, Contacts)"),
        record_id: z.string().describe("Record ID"),
        from_email: z.string().describe("Sender email address (must be configured in CRM)"),
        to_emails: z.array(z.string()).min(1).describe("Array of recipient email addresses"),
        subject: z.string().describe("Email subject"),
        content: z.string().describe("Email body (HTML supported)"),
        cc: z.array(z.string()).optional().describe("CC email addresses"),
        bcc: z.array(z.string()).optional().describe("BCC email addresses"),
        mail_format: z.enum(["text", "html"]).optional().describe("Email format"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async (params) => {
      try {
        const emailData: Record<string, unknown> = {
          from: { user_name: params.from_email, email: params.from_email },
          to: params.to_emails.map(email => ({ email, user_name: email })),
          subject: params.subject,
          content: params.content,
          mail_format: params.mail_format || "html",
        };
        if (params.cc) emailData.cc = params.cc.map(email => ({ email, user_name: email }));
        if (params.bcc) emailData.bcc = params.bcc.map(email => ({ email, user_name: email }));

        const body = { data: [emailData] };
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/actions/send_mail`,
          "POST", body
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== RECORD LOCKING ======================

  server.registerTool(
    "zoho_lock_record",
    {
      title: "Lock Record",
      description: `Lock a record to prevent modifications. Locked records can only be edited by admins and the lock owner.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        locked_reason: z.string().optional().describe("Reason for locking"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = { data: [{}] };
        if (params.locked_reason) {
          (body.data as Record<string, unknown>[])[0].$locked_reason = params.locked_reason;
        }
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/Locking`,
          "POST", body
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_unlock_record",
    {
      title: "Unlock Record",
      description: `Unlock a previously locked record.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        lock_id: z.string().describe("Lock ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/Locking/${params.lock_id}`,
          "DELETE"
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== SHARE RECORD ======================

  server.registerTool(
    "zoho_share_record",
    {
      title: "Share Record",
      description: `Share a record with specific users or groups with defined permissions.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        user_id: z.string().describe("User ID to share with"),
        permission: z.enum(["read-only", "read-write", "full-access"]).describe("Permission level"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          data: [{
            share_related_records: false,
            shared_to: { id: params.user_id, type: "users" },
            permission: params.permission,
          }],
        };
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/actions/share`,
          "POST", body
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_get_shared_details",
    {
      title: "Get Shared Record Details",
      description: `Get sharing details for a specific record - who has access and with what permissions.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/actions/share`,
          "GET"
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== COMPOSITE API ======================

  server.registerTool(
    "zoho_composite_request",
    {
      title: "Composite API Request",
      description: `Execute up to 5 API calls in a single request.
Each sub-request can be a GET, POST, PUT, or DELETE operation.
Sub-requests can reference results from earlier sub-requests using ${"{"}\$.[reference_id].body.[field]${"}"} syntax.

Example sub-request: {"method":"GET","url":"/crm/v7/Leads","reference_id":"get_leads"}`,
      inputSchema: {
        requests: z.array(z.object({
          method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
          url: z.string().describe("API path (e.g., /crm/v7/Leads)"),
          reference_id: z.string().describe("Unique reference ID for this sub-request"),
          body: z.record(z.string(), z.unknown()).optional().describe("Request body (for POST/PUT)"),
        })).min(1).max(5).describe("Array of sub-requests (max 5)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = { __request: params.requests };
        const data = await zohoRequest("composite", "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== RECORD IMAGE ======================

  server.registerTool(
    "zoho_get_record_photo_url",
    {
      title: "Get Record Photo URL",
      description: `Get the photo/image URL for a record (e.g., Contact photo, Lead photo).`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        return buildToolResponse({
          photo_url: `${process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com"}/crm/v7/${params.module}/${params.record_id}/photo`,
          note: "Use this URL with an Authorization header to fetch the image."
        });
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== CURRENCY & DATA ENRICHMENT ======================

  server.registerTool(
    "zoho_get_currencies",
    {
      title: "Get Currencies",
      description: `Fetch all currencies configured in the CRM.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("org/currencies", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ====================== RECORD APPROVAL ======================

  server.registerTool(
    "zoho_get_approvals",
    {
      title: "Get Approval Records",
      description: `Fetch records pending approval. Returns records awaiting the current user's approval.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("actions/approvals", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  server.registerTool(
    "zoho_approve_record",
    {
      title: "Approve/Reject Record",
      description: `Approve or reject a record that is pending approval.`,
      inputSchema: {
        record_id: z.string().describe("Record ID"),
        action: z.enum(["approve", "reject", "delegate"]).describe("Approval action"),
        comments: z.string().optional().describe("Comments for the approval/rejection"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body: Record<string, unknown> = {};
        if (params.comments) body.comments = params.comments;
        const data = await zohoRequest(
          `actions/approvals/${params.record_id}/${params.action}`,
          "POST", body
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ===================== RECORD OWNER CHANGE ====================

  server.registerTool(
    "zoho_change_owner",
    {
      title: "Change Record Owner",
      description: `Transfer ownership of records to a different user.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
        owner_id: z.string().describe("New owner user ID"),
        notify: z.boolean().optional().describe("Notify the new owner"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          data: params.record_ids.map(id => ({
            id,
            Owner: { id: params.owner_id },
          })),
        };
        if (params.notify !== undefined) {
          (body as Record<string, unknown>).notify = params.notify;
        }
        const data = await zohoRequest(params.module, "PUT", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );
}
