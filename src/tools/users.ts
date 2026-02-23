import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoRequest, buildToolResponse, buildErrorResponse } from "../services/zoho-client.js";

export function registerUserTools(server: McpServer): void {

  // ============ GET USERS ============
  server.registerTool(
    "zoho_get_users",
    {
      title: "Get Users",
      description: `Fetch users in the Zoho CRM organization.
Filter by type: AllUsers, ActiveUsers, DeactiveUsers, ConfirmedUsers, NotConfirmedUsers, DeletedUsers, ActiveConfirmedUsers, AdminUsers, ActiveConfirmedAdmins, CurrentUser.`,
      inputSchema: {
        type: z.enum([
          "AllUsers", "ActiveUsers", "DeactiveUsers", "ConfirmedUsers",
          "NotConfirmedUsers", "DeletedUsers", "ActiveConfirmedUsers",
          "AdminUsers", "ActiveConfirmedAdmins", "CurrentUser"
        ]).optional().describe("User type filter"),
        per_page: z.number().int().min(1).max(200).optional().describe("Records per page"),
        page: z.number().int().min(1).optional().describe("Page number"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.type) query.type = params.type;
        if (params.per_page) query.per_page = String(params.per_page);
        if (params.page) query.page = String(params.page);
        const data = await zohoRequest("users", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET USER BY ID ============
  server.registerTool(
    "zoho_get_user",
    {
      title: "Get User Details",
      description: `Get detailed information about a specific user by their ID.`,
      inputSchema: {
        user_id: z.string().describe("User ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`users/${params.user_id}`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ CREATE USER ============
  server.registerTool(
    "zoho_create_user",
    {
      title: "Create User",
      description: `Add a new user to the Zoho CRM organization. Requires admin privileges.`,
      inputSchema: {
        first_name: z.string().optional().describe("First name"),
        last_name: z.string().describe("Last name"),
        email: z.string().describe("Email address"),
        role: z.string().describe("Role ID"),
        profile: z.string().describe("Profile ID"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          users: [{
            first_name: params.first_name,
            last_name: params.last_name,
            email: params.email,
            role: params.role,
            profile: params.profile,
          }],
        };
        const data = await zohoRequest("users", "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ UPDATE USER ============
  server.registerTool(
    "zoho_update_user",
    {
      title: "Update User",
      description: `Update user details. Requires admin privileges.`,
      inputSchema: {
        user_id: z.string().describe("User ID"),
        fields: z.record(z.string(), z.unknown()).describe("Fields to update (role, profile, first_name, last_name, etc.)"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = { users: [{ id: params.user_id, ...params.fields }] };
        const data = await zohoRequest(`users/${params.user_id}`, "PUT", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ DELETE USER ============
  server.registerTool(
    "zoho_delete_user",
    {
      title: "Delete User",
      description: `Delete/deactivate a user from the organization. Requires admin privileges.
Optionally transfer their records to another user.`,
      inputSchema: {
        user_id: z.string().describe("User ID to delete"),
        transfer_to: z.string().optional().describe("User ID to transfer records to"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.transfer_to) query.transfer_and_delete = params.transfer_to;
        const data = await zohoRequest(`users/${params.user_id}`, "DELETE", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET ORGANIZATION ============
  server.registerTool(
    "zoho_get_organization",
    {
      title: "Get Organization Details",
      description: `Fetch details about the Zoho CRM organization including plan, license, company info.`,
      inputSchema: {},
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async () => {
      try {
        const data = await zohoRequest("org", "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ SEARCH USERS ============
  server.registerTool(
    "zoho_search_users",
    {
      title: "Search Users",
      description: `Search for users by name, email, or other criteria.`,
      inputSchema: {
        criteria: z.string().describe("Search criteria (e.g., name, email)"),
        type: z.enum(["AllUsers", "ActiveUsers", "DeactiveUsers"]).optional().describe("User type filter"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = { criteria: params.criteria };
        if (params.type) query.type = params.type;
        const data = await zohoRequest("users/search", "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );
}
