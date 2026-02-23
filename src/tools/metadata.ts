import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoRequest, buildToolResponse, buildErrorResponse } from "../services/zoho-client.js";

export function registerMetadataTools(server: McpServer): void {

  // ============ GET MODULES ============
  server.registerTool(
    "zoho_get_modules",
    {
      title: "Get Modules",
      description: `Fetch metadata of all available modules in the Zoho CRM account.
Returns module API names, labels, visibility, and configuration details.
Use this to discover available modules before performing CRUD operations.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("settings/modules", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET MODULE BY API NAME ============
  server.registerTool(
    "zoho_get_module",
    {
      title: "Get Module Details",
      description: `Get detailed metadata for a specific module by its API name.
Returns fields, layouts, related lists, custom views, and more.`,
      inputSchema: {
        module: z.string().describe("Module API name (e.g., Leads, Contacts)"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/modules/${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET FIELDS ============
  server.registerTool(
    "zoho_get_fields",
    {
      title: "Get Fields",
      description: `Fetch all field metadata for a specific module.
Returns field API names, labels, data types, required status, picklist values, etc.
Essential for building queries and understanding record structure.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        type: z.enum(["all", "unused"]).optional().describe("Filter: all or unused fields"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.type) query.type = params.type;
        const data = await zohoRequest(`settings/fields?module=${params.module}`, "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET FIELD BY ID ============
  server.registerTool(
    "zoho_get_field",
    {
      title: "Get Field Details",
      description: `Get detailed metadata for a specific field by its ID.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        field_id: z.string().describe("Field ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/fields/${params.field_id}?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET LAYOUTS ============
  server.registerTool(
    "zoho_get_layouts",
    {
      title: "Get Layouts",
      description: `Fetch all layouts for a specific module.
Layouts define how fields are organized in the CRM UI for each module.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/layouts?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET LAYOUT BY ID ============
  server.registerTool(
    "zoho_get_layout",
    {
      title: "Get Layout Details",
      description: `Get detailed layout information including sections and field arrangement.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        layout_id: z.string().describe("Layout ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/layouts/${params.layout_id}?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET CUSTOM VIEWS ============
  server.registerTool(
    "zoho_get_custom_views",
    {
      title: "Get Custom Views",
      description: `Fetch all custom views (saved filters) for a module.
Custom views define predefined record filters with specific criteria.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/custom_views?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET CUSTOM VIEW BY ID ============
  server.registerTool(
    "zoho_get_custom_view",
    {
      title: "Get Custom View Details",
      description: `Get detailed information about a specific custom view including its filter criteria.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        custom_view_id: z.string().describe("Custom view ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/custom_views/${params.custom_view_id}?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET RELATED LISTS ============
  server.registerTool(
    "zoho_get_related_lists",
    {
      title: "Get Related Lists",
      description: `Fetch all related lists for a specific module.
Related lists show relationships between modules (e.g., Contacts related to an Account).`,
      inputSchema: {
        module: z.string().describe("Module API name"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`settings/related_lists?module=${params.module}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET ROLES ============
  server.registerTool(
    "zoho_get_roles",
    {
      title: "Get Roles",
      description: `Fetch all roles defined in the Zoho CRM organization.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("settings/roles", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET PROFILES ============
  server.registerTool(
    "zoho_get_profiles",
    {
      title: "Get Profiles",
      description: `Fetch all profiles (permission sets) defined in the Zoho CRM organization.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("settings/profiles", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET TERRITORIES ============
  server.registerTool(
    "zoho_get_territories",
    {
      title: "Get Territories",
      description: `Fetch all territories defined in the Zoho CRM organization.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("settings/territories", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET PIPELINES ============
  server.registerTool(
    "zoho_get_pipelines",
    {
      title: "Get Pipelines",
      description: `Fetch all pipelines for a module (typically Deals). Includes pipeline stages.`,
      inputSchema: {
        layout_id: z.string().optional().describe("Layout ID to filter pipelines"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.layout_id) query.layout_id = params.layout_id;
        const data = await zohoRequest("settings/pipeline", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET SCORING RULES ============
  server.registerTool(
    "zoho_get_scoring_rules",
    {
      title: "Get Scoring Rules",
      description: `Fetch scoring rules configured for lead/contact scoring in the CRM.`,
      inputSchema: {
        module: z.string().optional().describe("Module API name to filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.module) query.module = params.module;
        const data = await zohoRequest("settings/scoring_rules", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET WIZARDS ============
  server.registerTool(
    "zoho_get_wizards",
    {
      title: "Get Wizards",
      description: `Fetch all wizards configured in the CRM. Wizards guide users through multi-step record creation.`,
      inputSchema: {
        module: z.string().optional().describe("Module API name to filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.module) query.module = params.module;
        const data = await zohoRequest("settings/wizards", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET ASSIGNMENT RULES ============
  server.registerTool(
    "zoho_get_assignment_rules",
    {
      title: "Get Assignment Rules",
      description: `Fetch assignment rules for automatic record assignment to users.`,
      inputSchema: {
        module: z.string().optional().describe("Module API name to filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.module) query.module = params.module;
        const data = await zohoRequest("settings/assignment_rules", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );
}
