import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { zohoRequest, buildToolResponse, buildErrorResponse } from "../services/zoho-client.js";

export function registerRelatedTools(server: McpServer): void {

  // ============ GET RELATED RECORDS ============
  server.registerTool(
    "zoho_get_related_records",
    {
      title: "Get Related Records",
      description: `Fetch records related to a specific record through a related list.
For example, get all Contacts related to an Account, or all Notes for a Deal.

Args:
  - module: Parent module API name (e.g., Accounts)
  - record_id: Parent record ID
  - related_list: Related list API name (e.g., Contacts, Notes, Deals)
  - fields: Fields to retrieve
  - per_page / page: Pagination`,
      inputSchema: {
        module: z.string().describe("Parent module API name"),
        record_id: z.string().describe("Parent record ID"),
        related_list: z.string().describe("Related list API name"),
        fields: z.string().optional().describe("Comma-separated field API names"),
        per_page: z.number().int().min(1).max(200).optional().describe("Records per page"),
        page: z.number().int().min(1).optional().describe("Page number"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.fields) query.fields = params.fields;
        if (params.per_page) query.per_page = String(params.per_page);
        if (params.page) query.page = String(params.page);
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/${params.related_list}`,
          "GET", undefined, query
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ ADD RELATED RECORD ============
  server.registerTool(
    "zoho_update_related_records",
    {
      title: "Update Related Records",
      description: `Update or associate related records to a parent record.
For example, link Contacts to an Account, or associate Products to a Deal.`,
      inputSchema: {
        module: z.string().describe("Parent module API name"),
        record_id: z.string().describe("Parent record ID"),
        related_list: z.string().describe("Related list API name"),
        records: z.array(z.record(z.string(), z.unknown())).min(1).max(100).describe("Related records to update/associate"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = { data: params.records };
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/${params.related_list}`,
          "PUT", body
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ DELETE RELATED RECORDS ============
  server.registerTool(
    "zoho_delink_related_records",
    {
      title: "Delink Related Records",
      description: `Remove the association between a parent record and related records.
This does not delete the records, only removes the relationship.`,
      inputSchema: {
        module: z.string().describe("Parent module API name"),
        record_id: z.string().describe("Parent record ID"),
        related_list: z.string().describe("Related list API name"),
        ids: z.string().describe("Comma-separated related record IDs to delink"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = { ids: params.ids };
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/${params.related_list}`,
          "DELETE", undefined, query
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET NOTES ============
  server.registerTool(
    "zoho_get_notes",
    {
      title: "Get Notes",
      description: `Fetch all notes or notes for a specific record.
Notes can be associated with Leads, Contacts, Accounts, Deals, and other modules.`,
      inputSchema: {
        module: z.string().optional().describe("Module API name (if fetching notes for a specific record)"),
        record_id: z.string().optional().describe("Record ID (if fetching notes for a specific record)"),
        per_page: z.number().int().min(1).max(200).optional().describe("Records per page"),
        page: z.number().int().min(1).optional().describe("Page number"),
        fields: z.string().optional().describe("Comma-separated field API names"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const query: Record<string, string> = {};
        if (params.per_page) query.per_page = String(params.per_page);
        if (params.page) query.page = String(params.page);
        if (params.fields) query.fields = params.fields;

        let path: string;
        if (params.module && params.record_id) {
          path = `${params.module}/${params.record_id}/Notes`;
        } else {
          path = "Notes";
        }
        const data = await zohoRequest(path, "GET", undefined, query);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ CREATE NOTE ============
  server.registerTool(
    "zoho_create_note",
    {
      title: "Create Note",
      description: `Create a note attached to a specific record in any module.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID to attach note to"),
        note_title: z.string().optional().describe("Note title"),
        note_content: z.string().describe("Note content/body"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
    },
    async (params) => {
      try {
        const body = {
          data: [{
            Note_Title: params.note_title || "",
            Note_Content: params.note_content,
            Parent_Id: { id: params.record_id },
            se_module: params.module,
          }],
        };
        const data = await zohoRequest(`${params.module}/${params.record_id}/Notes`, "POST", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ UPDATE NOTE ============
  server.registerTool(
    "zoho_update_note",
    {
      title: "Update Note",
      description: `Update an existing note's title or content.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Parent record ID"),
        note_id: z.string().describe("Note ID"),
        note_title: z.string().optional().describe("Updated note title"),
        note_content: z.string().optional().describe("Updated note content"),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const noteData: Record<string, unknown> = { id: params.note_id };
        if (params.note_title !== undefined) noteData.Note_Title = params.note_title;
        if (params.note_content !== undefined) noteData.Note_Content = params.note_content;
        const body = { data: [noteData] };
        const data = await zohoRequest(`${params.module}/${params.record_id}/Notes/${params.note_id}`, "PUT", body);
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ DELETE NOTE ============
  server.registerTool(
    "zoho_delete_note",
    {
      title: "Delete Note",
      description: `Delete a note from a record.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Parent record ID"),
        note_id: z.string().describe("Note ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/Notes/${params.note_id}`,
          "DELETE"
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ GET ATTACHMENTS ============
  server.registerTool(
    "zoho_get_attachments",
    {
      title: "Get Attachments",
      description: `List all attachments for a specific record.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
      },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(`${params.module}/${params.record_id}/Attachments`, "GET");
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );

  // ============ DELETE ATTACHMENT ============
  server.registerTool(
    "zoho_delete_attachment",
    {
      title: "Delete Attachment",
      description: `Delete an attachment from a record.`,
      inputSchema: {
        module: z.string().describe("Module API name"),
        record_id: z.string().describe("Record ID"),
        attachment_id: z.string().describe("Attachment ID to delete"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    },
    async (params) => {
      try {
        const data = await zohoRequest(
          `${params.module}/${params.record_id}/Attachments/${params.attachment_id}`,
          "DELETE"
        );
        return buildToolResponse(data);
      } catch (error) { return buildErrorResponse(error); }
    }
  );
}
