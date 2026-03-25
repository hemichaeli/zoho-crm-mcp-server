import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoClient } from "../client.js";
import { z } from "zod";

export function registerMetadataTools(server: McpServer, client: ZohoClient): void {
  // Get all modules
  server.tool(
    "zoho_get_modules",
    "Fetch metadata of all available modules in the Zoho CRM account",
    {},
    async () => {
      const result = await client.get("/settings/modules");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get single module
  server.tool(
    "zoho_get_module",
    "Get detailed metadata for a specific module by its API name",
    {
      module: z.string().describe("Module API name (e.g., Leads, Contacts)"),
    },
    async (args) => {
      const result = await client.get(`/settings/modules/${args.module}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get fields
  server.tool(
    "zoho_get_fields",
    "Fetch all field metadata for a specific module (API names, labels, types, picklist values, etc.)",
    {
      module: z.string().describe("Module API name"),
      type: z.enum(["all", "unused"]).optional().describe("Filter: all or unused fields"),
    },
    async (args) => {
      const params: Record<string, unknown> = { module: args.module };
      if (args.type) params.type = args.type;
      const result = await client.get("/settings/fields", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get single field
  server.tool(
    "zoho_get_field",
    "Get detailed metadata for a specific field by its ID",
    {
      module: z.string().describe("Module API name"),
      field_id: z.string().describe("Field ID"),
    },
    async (args) => {
      const result = await client.get(`/settings/fields/${args.field_id}`, { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get layouts
  server.tool(
    "zoho_get_layouts",
    "Fetch all layouts for a specific module",
    {
      module: z.string().describe("Module API name"),
    },
    async (args) => {
      const result = await client.get("/settings/layouts", { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get single layout
  server.tool(
    "zoho_get_layout",
    "Get detailed layout information including sections and field arrangement",
    {
      module: z.string().describe("Module API name"),
      layout_id: z.string().describe("Layout ID"),
    },
    async (args) => {
      const result = await client.get(`/settings/layouts/${args.layout_id}`, { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get custom views
  server.tool(
    "zoho_get_custom_views",
    "Fetch all custom views (saved filters) for a module",
    {
      module: z.string().describe("Module API name"),
    },
    async (args) => {
      const result = await client.get("/settings/custom_views", { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get single custom view
  server.tool(
    "zoho_get_custom_view",
    "Get detailed information about a specific custom view including its filter criteria",
    {
      module: z.string().describe("Module API name"),
      custom_view_id: z.string().describe("Custom view ID"),
    },
    async (args) => {
      const result = await client.get(`/settings/custom_views/${args.custom_view_id}`, { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get related lists
  server.tool(
    "zoho_get_related_lists",
    "Fetch all related lists for a specific module",
    {
      module: z.string().describe("Module API name"),
    },
    async (args) => {
      const result = await client.get("/settings/related_lists", { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get organization
  server.tool(
    "zoho_get_organization",
    "Fetch details about the Zoho CRM organization including plan, license, company info",
    {},
    async () => {
      const result = await client.get("/org");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get currencies
  server.tool(
    "zoho_get_currencies",
    "Fetch all currencies configured in the CRM",
    {},
    async () => {
      const result = await client.get("/org/currencies");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get profiles
  server.tool(
    "zoho_get_profiles",
    "Fetch all profiles (permission sets) defined in the Zoho CRM organization",
    {},
    async () => {
      const result = await client.get("/settings/profiles");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get roles
  server.tool(
    "zoho_get_roles",
    "Fetch all roles defined in the Zoho CRM organization",
    {},
    async () => {
      const result = await client.get("/settings/roles");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get territories
  server.tool(
    "zoho_get_territories",
    "Fetch all territories defined in the Zoho CRM organization",
    {},
    async () => {
      const result = await client.get("/settings/territories");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get pipelines
  server.tool(
    "zoho_get_pipelines",
    "Fetch all pipelines for a module (typically Deals), including pipeline stages",
    {
      layout_id: z.string().optional().describe("Layout ID to filter pipelines"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.layout_id) params.layout_id = args.layout_id;
      const result = await client.get("/settings/pipeline", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get scoring rules
  server.tool(
    "zoho_get_scoring_rules",
    "Fetch scoring rules configured for lead/contact scoring in the CRM",
    {
      module: z.string().optional().describe("Module API name to filter"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.module) params.module = args.module;
      const result = await client.get("/settings/scoring_rules", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get assignment rules
  server.tool(
    "zoho_get_assignment_rules",
    "Fetch assignment rules for automatic record assignment to users",
    {
      module: z.string().optional().describe("Module API name to filter"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.module) params.module = args.module;
      const result = await client.get("/settings/automation/assignment_rules", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get wizards
  server.tool(
    "zoho_get_wizards",
    "Fetch all wizards configured in the CRM",
    {
      module: z.string().optional().describe("Module API name to filter"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.module) params.module = args.module;
      const result = await client.get("/settings/wizards", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get record photo URL
  server.tool(
    "zoho_get_record_photo_url",
    "Get the photo/image URL for a record (e.g., Contact photo)",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
    },
    async (args) => {
      const result = await client.get(`/${args.module}/${args.record_id}/photo`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get timeline
  server.tool(
    "zoho_get_timeline",
    "Fetch the timeline (activity history) of a specific record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      per_page: z.number().min(1).max(200).optional(),
      page_token: z.string().optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.per_page) params.per_page = args.per_page;
      if (args.page_token) params.page_token = args.page_token;
      const result = await client.get(`/${args.module}/${args.record_id}/timeline`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get blueprint
  server.tool(
    "zoho_get_blueprint",
    "Fetch the blueprint (process flow) for a specific record with available transitions",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
    },
    async (args) => {
      const result = await client.get(`/${args.module}/${args.record_id}/actions/blueprint`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Update blueprint
  server.tool(
    "zoho_update_blueprint",
    "Execute a blueprint transition for a record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      transition_id: z.string().describe("Transition ID"),
      data: z.record(z.unknown()).optional().describe("Required field values for the transition"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        blueprint: [{ transition_id: args.transition_id, data: args.data || {} }],
      };
      const result = await client.put(`/${args.module}/${args.record_id}/actions/blueprint`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
