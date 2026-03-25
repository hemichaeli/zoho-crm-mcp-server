import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoClient } from "../client.js";
import { z } from "zod";

export function registerAutomationTools(server: McpServer, client: ZohoClient): void {
  // ==================== WORKFLOW RULES ====================

  server.tool(
    "zoho_get_workflow_rules",
    "Fetch all workflow automation rules in the CRM",
    {
      module: z.string().optional().describe("Module API name to filter"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.module) params.module = args.module;
      const result = await client.get("/settings/automation/workflow_rules", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_workflow_rule",
    "Get details of a specific workflow rule by ID",
    {
      rule_id: z.string().describe("Workflow rule ID"),
    },
    async (args) => {
      const result = await client.get(`/settings/automation/workflow_rules/${args.rule_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_workflow_rule",
    "Create a new workflow automation rule in Zoho CRM. Supports triggers: on record create/edit/delete, field update, or scheduled. Actions can include tag updates, field updates, email alerts, webhooks, and Deluge functions.",
    {
      name: z.string().describe("Rule name"),
      module: z.string().describe("Module API name (e.g., Contacts, Leads)"),
      trigger: z.enum(["CREATE", "EDIT", "DELETE", "FIELD_UPDATE", "SCHEDULED"]).describe("Trigger event"),
      description: z.string().optional().describe("Rule description"),
      active: z.boolean().optional().default(true).describe("Whether the rule is active"),
      actions: z.array(z.record(z.unknown())).optional().describe("Array of action objects"),
      conditions: z.record(z.unknown()).optional().describe("Condition criteria"),
    },
    async (args) => {
      const ruleData: Record<string, unknown> = {
        name: args.name,
        module: { api_name: args.module },
        trigger: { type: args.trigger },
        active: args.active !== undefined ? args.active : true,
      };
      if (args.description) ruleData.description = args.description;
      if (args.actions) ruleData.actions = args.actions;
      if (args.conditions) ruleData.conditions = args.conditions;
      const result = await client.post("/settings/automation/workflow_rules", { workflow_rules: [ruleData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_update_workflow_rule",
    "Update an existing workflow rule",
    {
      rule_id: z.string().describe("Workflow rule ID"),
      name: z.string().optional().describe("Rule name"),
      active: z.boolean().optional().describe("Enable/disable the rule"),
      description: z.string().optional().describe("Rule description"),
      actions: z.array(z.record(z.unknown())).optional().describe("Updated actions"),
      conditions: z.record(z.unknown()).optional().describe("Updated conditions"),
    },
    async (args) => {
      const ruleData: Record<string, unknown> = { id: args.rule_id };
      if (args.name !== undefined) ruleData.name = args.name;
      if (args.active !== undefined) ruleData.active = args.active;
      if (args.description !== undefined) ruleData.description = args.description;
      if (args.actions !== undefined) ruleData.actions = args.actions;
      if (args.conditions !== undefined) ruleData.conditions = args.conditions;
      const result = await client.put(`/settings/automation/workflow_rules/${args.rule_id}`, { workflow_rules: [ruleData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_workflow_rule",
    "Delete a workflow rule by ID",
    {
      rule_id: z.string().describe("Workflow rule ID"),
    },
    async (args) => {
      const result = await client.delete(`/settings/automation/workflow_rules/${args.rule_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== DELUGE FUNCTIONS ====================

  server.tool(
    "zoho_get_functions",
    "Fetch all Deluge functions defined in the CRM",
    {
      type: z.enum(["org", "module"]).optional().describe("Function type filter"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.type) params.type = args.type;
      const result = await client.get("/settings/functions", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_function",
    "Get details of a specific Deluge function",
    {
      function_id: z.string().describe("Function ID"),
    },
    async (args) => {
      const result = await client.get(`/settings/functions/${args.function_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_function",
    "Create a new Deluge custom function in Zoho CRM. Functions can be triggered by workflow rules, buttons, or schedules. Write Deluge code to automate complex business logic.",
    {
      name: z.string().describe("Function API name (alphanumeric, no spaces)"),
      display_name: z.string().describe("Human-readable display name"),
      source: z.string().describe("Deluge code for the function body"),
      description: z.string().optional().describe("Function description"),
      type: z.enum(["org", "module"]).optional().default("org").describe("Function scope: org-level or module-level"),
      module: z.string().optional().describe("Module API name (required if type is 'module')"),
      arguments: z.array(z.object({
        name: z.string().describe("Argument name"),
        type: z.string().describe("Argument type (e.g., STRING, INT, MAP)"),
        description: z.string().optional().describe("Argument description"),
      })).optional().describe("Input arguments for the function"),
    },
    async (args) => {
      const funcData: Record<string, unknown> = {
        name: args.name,
        display_name: args.display_name,
        source: args.source,
        type: args.type || "org",
      };
      if (args.description) funcData.description = args.description;
      if (args.module) funcData.module = { api_name: args.module };
      if (args.arguments && args.arguments.length > 0) funcData.arguments = args.arguments;
      const result = await client.post("/settings/functions", { functions: [funcData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_update_function",
    "Update an existing Deluge function's code or metadata",
    {
      function_id: z.string().describe("Function ID"),
      display_name: z.string().optional().describe("Updated display name"),
      source: z.string().optional().describe("Updated Deluge code"),
      description: z.string().optional().describe("Updated description"),
      arguments: z.array(z.object({
        name: z.string(),
        type: z.string(),
        description: z.string().optional(),
      })).optional().describe("Updated input arguments"),
    },
    async (args) => {
      const funcData: Record<string, unknown> = { id: args.function_id };
      if (args.display_name !== undefined) funcData.display_name = args.display_name;
      if (args.source !== undefined) funcData.source = args.source;
      if (args.description !== undefined) funcData.description = args.description;
      if (args.arguments !== undefined) funcData.arguments = args.arguments;
      const result = await client.put(`/settings/functions/${args.function_id}`, { functions: [funcData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_execute_function",
    "Execute a Deluge function with optional arguments",
    {
      function_name: z.string().describe("Function API name"),
      arguments: z.record(z.unknown()).optional().describe("Arguments to pass to the function"),
    },
    async (args) => {
      const params: Record<string, unknown> = { auth_type: "oauth" };
      const body: Record<string, unknown> = {};
      if (args.arguments) body.arguments = JSON.stringify(args.arguments);
      const result = await client.post(`/functions/${args.function_name}/actions/execute`, body, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== SCHEDULES ====================

  server.tool(
    "zoho_get_schedules",
    "Fetch all scheduled jobs configured in the CRM",
    {},
    async () => {
      const result = await client.get("/settings/automation/schedules");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_schedule",
    "Create a new scheduled job",
    {
      name: z.string().describe("Schedule name"),
      description: z.string().optional().describe("Schedule description"),
      interval: z.number().optional().describe("Interval in minutes"),
      cron_expression: z.string().optional().describe("Cron expression for scheduling"),
      function_id: z.string().optional().describe("Function ID to execute"),
      active: z.boolean().optional().default(true),
    },
    async (args) => {
      const scheduleData: Record<string, unknown> = {
        name: args.name,
        active: args.active !== undefined ? args.active : true,
      };
      if (args.description) scheduleData.description = args.description;
      if (args.interval) scheduleData.interval = args.interval;
      if (args.cron_expression) scheduleData.cron_expression = args.cron_expression;
      if (args.function_id) scheduleData.function = { id: args.function_id };
      const result = await client.post("/settings/automation/schedules", { schedules: [scheduleData] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_schedule",
    "Delete a scheduled job by ID",
    {
      schedule_id: z.string().describe("Schedule ID"),
    },
    async (args) => {
      const result = await client.delete(`/settings/automation/schedules/${args.schedule_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== NOTIFICATIONS (WEBHOOKS) ====================

  server.tool(
    "zoho_enable_notifications",
    "Subscribe to notifications (webhooks) for changes in a module",
    {
      channel_id: z.string().describe("Unique channel ID (numeric string)"),
      events: z.array(z.string()).min(1).describe("Event types e.g. ['Leads.create', 'Deals.edit']"),
      notify_url: z.string().describe("Webhook URL to receive notifications"),
      token: z.string().optional().describe("Optional verification token"),
      channel_expiry: z.string().optional().describe("Expiry datetime in ISO format"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        watch: [
          {
            channel_id: args.channel_id,
            events: args.events,
            channel_expiry: args.channel_expiry || new Date(Date.now() + 24 * 3600000).toISOString(),
            notify_url: args.notify_url,
          },
        ],
      };
      if (args.token) (body.watch as Record<string, unknown>[])[0].token = args.token;
      const result = await client.post("/actions/watch", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_disable_notifications",
    "Unsubscribe from notifications for specific channels",
    {
      channel_ids: z.array(z.string()).min(1).describe("Channel IDs to disable"),
      events: z.array(z.string()).optional().describe("Specific events to disable"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        watch: args.channel_ids.map((id) => {
          const item: Record<string, unknown> = { channel_id: id };
          if (args.events) item.events = args.events;
          return item;
        }),
      };
      const result = await client.delete("/actions/watch", body as Record<string, unknown>);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_notification_details",
    "Fetch details about active notification channels",
    {
      channel_ids: z.string().optional().describe("Comma-separated channel IDs"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.channel_ids) params.channel_ids = args.channel_ids;
      const result = await client.get("/actions/watch", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // ==================== COMPOSITE REQUEST ====================

  server.tool(
    "zoho_composite_request",
    "Execute up to 5 API calls in a single request with sub-request referencing",
    {
      requests: z.array(z.object({
        method: z.enum(["GET", "POST", "PUT", "DELETE"]).describe("HTTP method"),
        url: z.string().describe("API path (e.g., /crm/v7/Leads)"),
        reference_id: z.string().describe("Unique reference ID for this sub-request"),
        body: z.record(z.unknown()).optional().describe("Request body for POST/PUT"),
      })).min(1).max(5).describe("Array of sub-requests (max 5)"),
    },
    async (args) => {
      const result = await client.post("/composite", { requests: args.requests });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
