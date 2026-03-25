import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoClient } from "../client.js";
import { z } from "zod";

export function registerTagTools(server: McpServer, client: ZohoClient): void {
  server.tool(
    "zoho_get_tags",
    "Fetch all tags for a specific module",
    {
      module: z.string().describe("Module API name"),
    },
    async (args) => {
      const result = await client.get("/settings/tags", { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_tags",
    "Create new tags for a module",
    {
      module: z.string().describe("Module API name"),
      tags: z.array(z.string()).min(1).max(50).describe("Array of tag names to create"),
    },
    async (args) => {
      const body = { tags: args.tags.map((name) => ({ name })) };
      const result = await client.post("/settings/tags", body, { module: args.module });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_update_tag",
    "Rename an existing tag",
    {
      module: z.string().describe("Module API name"),
      tag_id: z.string().describe("Tag ID"),
      new_name: z.string().describe("New tag name"),
    },
    async (args) => {
      const result = await client.put(`/settings/tags/${args.tag_id}`, { tags: [{ name: args.new_name }] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_tag",
    "Delete a tag from the module",
    {
      tag_id: z.string().describe("Tag ID to delete"),
    },
    async (args) => {
      const result = await client.delete(`/settings/tags/${args.tag_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_add_tags_to_records",
    "Add tags to one or more records in a module",
    {
      module: z.string().describe("Module API name"),
      record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
      tag_names: z.array(z.string()).min(1).max(10).describe("Array of tag names to add"),
    },
    async (args) => {
      const result = await client.post(
        `/${args.module}/actions/add_tags`,
        { tag_names: args.tag_names, ids: args.record_ids }
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_remove_tags_from_records",
    "Remove tags from one or more records in a module",
    {
      module: z.string().describe("Module API name"),
      record_ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
      tag_names: z.array(z.string()).min(1).max(10).describe("Array of tag names to remove"),
    },
    async (args) => {
      const result = await client.post(
        `/${args.module}/actions/remove_tags`,
        { tag_names: args.tag_names, ids: args.record_ids }
      );
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

export function registerNoteTools(server: McpServer, client: ZohoClient): void {
  server.tool(
    "zoho_get_notes",
    "Fetch all notes or notes for a specific record",
    {
      module: z.string().optional().describe("Module API name (if fetching notes for a specific record)"),
      record_id: z.string().optional().describe("Record ID"),
      fields: z.string().optional().describe("Comma-separated field API names"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
    },
    async (args) => {
      let path = "/Notes";
      const params: Record<string, unknown> = {};
      if (args.module && args.record_id) {
        path = `/${args.module}/${args.record_id}/Notes`;
      }
      if (args.fields) params.fields = args.fields;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      const result = await client.get(path, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_note",
    "Create a note attached to a specific record in any module",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID to attach note to"),
      note_title: z.string().optional().describe("Note title"),
      note_content: z.string().describe("Note content/body"),
    },
    async (args) => {
      const data: Record<string, unknown> = {
        Note_Content: args.note_content,
        Parent_Id: args.record_id,
        se_module: args.module,
      };
      if (args.note_title) data.Note_Title = args.note_title;
      const result = await client.post("/Notes", { data: [data] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_update_note",
    "Update an existing note's title or content",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Parent record ID"),
      note_id: z.string().describe("Note ID"),
      note_title: z.string().optional().describe("Updated note title"),
      note_content: z.string().optional().describe("Updated note content"),
    },
    async (args) => {
      const data: Record<string, unknown> = { id: args.note_id };
      if (args.note_title) data.Note_Title = args.note_title;
      if (args.note_content) data.Note_Content = args.note_content;
      const result = await client.put(`/${args.module}/${args.record_id}/Notes/${args.note_id}`, { data: [data] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_note",
    "Delete a note from a record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Parent record ID"),
      note_id: z.string().describe("Note ID to delete"),
    },
    async (args) => {
      const result = await client.delete(`/${args.module}/${args.record_id}/Notes/${args.note_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_attachments",
    "List all attachments for a specific record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
    },
    async (args) => {
      const result = await client.get(`/${args.module}/${args.record_id}/Attachments`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_attachment",
    "Delete an attachment from a record",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      attachment_id: z.string().describe("Attachment ID to delete"),
    },
    async (args) => {
      const result = await client.delete(`/${args.module}/${args.record_id}/Attachments/${args.attachment_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}

export function registerUserTools(server: McpServer, client: ZohoClient): void {
  server.tool(
    "zoho_get_users",
    "Fetch users in the Zoho CRM organization",
    {
      type: z.enum([
        "AllUsers", "ActiveUsers", "DeactiveUsers", "ConfirmedUsers",
        "NotConfirmedUsers", "DeletedUsers", "ActiveConfirmedUsers",
        "AdminUsers", "ActiveConfirmedAdmins", "CurrentUser",
      ]).optional().describe("User type filter"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.type) params.type = args.type;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      const result = await client.get("/users", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_user",
    "Get detailed information about a specific user by their ID",
    {
      user_id: z.string().describe("User ID"),
    },
    async (args) => {
      const result = await client.get(`/users/${args.user_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_create_user",
    "Add a new user to the Zoho CRM organization (requires admin privileges)",
    {
      email: z.string().describe("Email address"),
      last_name: z.string().describe("Last name"),
      first_name: z.string().optional().describe("First name"),
      role: z.string().describe("Role ID"),
      profile: z.string().describe("Profile ID"),
    },
    async (args) => {
      const data: Record<string, unknown> = {
        email: args.email,
        last_name: args.last_name,
        role: { id: args.role },
        profile: { id: args.profile },
      };
      if (args.first_name) data.first_name = args.first_name;
      const result = await client.post("/users", { users: [data] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_update_user",
    "Update user details (requires admin privileges)",
    {
      user_id: z.string().describe("User ID"),
      fields: z.record(z.unknown()).describe("Fields to update (role, profile, first_name, last_name, etc.)"),
    },
    async (args) => {
      const result = await client.put(`/users/${args.user_id}`, { users: [{ id: args.user_id, ...args.fields }] });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_delete_user",
    "Delete/deactivate a user from the organization (requires admin privileges)",
    {
      user_id: z.string().describe("User ID to delete"),
      transfer_to: z.string().optional().describe("User ID to transfer records to"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.transfer_to) params.transfer_to = args.transfer_to;
      const result = await client.delete(`/users/${args.user_id}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_search_users",
    "Search for users by name, email, or other criteria",
    {
      criteria: z.string().describe("Search criteria (e.g., name, email)"),
      type: z.enum(["AllUsers", "ActiveUsers", "DeactiveUsers"]).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = { criteria: args.criteria };
      if (args.type) params.type = args.type;
      const result = await client.get("/users/search", params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "zoho_get_user_contacts",
    "Fetch contact list for the authenticated user with last meeting dates",
    {},
    async () => {
      const result = await client.get("/users/contacts");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
