import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { ZohoClient } from "../client.js";
import { z } from "zod";

export function registerRecordTools(server: McpServer, client: ZohoClient): void {
  // Get records
  server.tool(
    "zoho_get_records",
    "Fetch records from any Zoho CRM module with pagination, sorting and filtering",
    {
      module: z.string().describe("Module API name (e.g., Leads, Contacts, Accounts, Deals)"),
      fields: z.string().optional().describe("Comma-separated field API names (max 50)"),
      per_page: z.number().min(1).max(200).default(200).optional().describe("Records per page"),
      page: z.number().min(1).default(1).optional().describe("Page number"),
      page_token: z.string().optional().describe("Token for cursor-based pagination"),
      sort_by: z.string().optional().describe("Field to sort by"),
      sort_order: z.enum(["asc", "desc"]).optional().describe("Sort direction"),
      cvid: z.string().optional().describe("Custom view ID"),
      ids: z.string().optional().describe("Comma-separated record IDs"),
      include_child: z.boolean().optional().describe("Include child records"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.fields) params.fields = args.fields;
      if (args.per_page) params.per_page = args.per_page;
      if (args.page) params.page = args.page;
      if (args.page_token) params.page_token = args.page_token;
      if (args.sort_by) params.sort_by = args.sort_by;
      if (args.sort_order) params.sort_order = args.sort_order;
      if (args.cvid) params.cvid = args.cvid;
      if (args.ids) params.ids = args.ids;
      if (args.include_child !== undefined) params.include_child = args.include_child;
      const result = await client.get(`/${args.module}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get single record
  server.tool(
    "zoho_get_record",
    "Fetch a specific record by its ID from any Zoho CRM module",
    {
      module: z.string().describe("Module API name"),
      record_id: z.string().describe("Record ID"),
      fields: z.string().optional().describe("Comma-separated field API names"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.fields) params.fields = args.fields;
      const result = await client.get(`/${args.module}/${args.record_id}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Create records
  server.tool(
    "zoho_create_records",
    "Create one or more records in any Zoho CRM module (up to 100 per request)",
    {
      module: z.string().describe("Module API name"),
      records: z.array(z.record(z.unknown())).min(1).max(100).describe("Array of record objects"),
      trigger: z.string().optional().describe("Workflow triggers: workflow, approval, blueprint"),
    },
    async (args) => {
      const body: Record<string, unknown> = { data: args.records };
      if (args.trigger) body.trigger = [args.trigger];
      const result = await client.post(`/${args.module}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Update records
  server.tool(
    "zoho_update_records",
    "Update one or more existing records. Each record must include an 'id' field.",
    {
      module: z.string().describe("Module API name"),
      records: z.array(z.record(z.unknown())).min(1).max(100).describe("Array of record objects with 'id' field"),
      trigger: z.string().optional().describe("Workflow triggers"),
    },
    async (args) => {
      const body: Record<string, unknown> = { data: args.records };
      if (args.trigger) body.trigger = [args.trigger];
      const result = await client.put(`/${args.module}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Delete records
  server.tool(
    "zoho_delete_records",
    "Delete one or more records from any Zoho CRM module",
    {
      module: z.string().describe("Module API name"),
      ids: z.string().describe("Comma-separated record IDs to delete (max 100)"),
      wf_trigger: z.boolean().optional().describe("Trigger workflows on delete"),
    },
    async (args) => {
      const params: Record<string, unknown> = { ids: args.ids };
      if (args.wf_trigger !== undefined) params.wf_trigger = args.wf_trigger;
      const result = await client.delete(`/${args.module}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Search records
  server.tool(
    "zoho_search_records",
    "Search for records using criteria, email, phone, or full-text word search",
    {
      module: z.string().describe("Module API name"),
      criteria: z.string().optional().describe("Search criteria expression e.g. ((Last_Name:equals:Doe)and(Company:equals:Acme))"),
      email: z.string().optional().describe("Search by email"),
      phone: z.string().optional().describe("Search by phone"),
      word: z.string().optional().describe("Full-text search"),
      fields: z.string().optional().describe("Comma-separated field names"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.criteria) params.criteria = args.criteria;
      if (args.email) params.email = args.email;
      if (args.phone) params.phone = args.phone;
      if (args.word) params.word = args.word;
      if (args.fields) params.fields = args.fields;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      const result = await client.get(`/${args.module}/search`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Upsert records
  server.tool(
    "zoho_upsert_records",
    "Insert or update records based on duplicate check fields",
    {
      module: z.string().describe("Module API name"),
      records: z.array(z.record(z.unknown())).min(1).max(100),
      duplicate_check_fields: z.array(z.string()).optional().describe("Fields for duplicate checking"),
      trigger: z.string().optional(),
    },
    async (args) => {
      const body: Record<string, unknown> = { data: args.records };
      if (args.duplicate_check_fields) body.duplicate_check_fields = args.duplicate_check_fields;
      if (args.trigger) body.trigger = [args.trigger];
      const result = await client.post(`/${args.module}/upsert`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // COQL query
  server.tool(
    "zoho_coql_query",
    "Execute CRM Object Query Language (COQL) query. SQL-like SELECT syntax.",
    {
      select_query: z.string().describe("COQL SELECT query e.g. select Last_Name, Email from Leads where Company = 'Acme' limit 10"),
    },
    async (args) => {
      const result = await client.post("/coql", { select_query: args.select_query });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Mass update
  server.tool(
    "zoho_mass_update",
    "Update multiple records with the same field values",
    {
      module: z.string().describe("Module API name"),
      ids: z.array(z.string()).min(1).max(100).describe("Array of record IDs"),
      fields: z.record(z.unknown()).describe("Field-value pairs to apply to all records"),
    },
    async (args) => {
      const records = args.ids.map((id) => ({ id, ...args.fields }));
      const result = await client.put(`/${args.module}`, { data: records });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get record count
  server.tool(
    "zoho_get_record_count",
    "Get total count of records in a module",
    {
      module: z.string().describe("Module API name"),
      criteria: z.string().optional().describe("Filter criteria"),
      cvid: z.string().optional().describe("Custom view ID"),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.criteria) params.criteria = args.criteria;
      if (args.cvid) params.cvid = args.cvid;
      const result = await client.get(`/${args.module}/actions/count`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get deleted records
  server.tool(
    "zoho_get_deleted_records",
    "Retrieve deleted records from a module",
    {
      module: z.string().describe("Module API name"),
      type: z.enum(["all", "recycle", "permanent"]).optional().default("all"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.type) params.type = args.type;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      const result = await client.get(`/${args.module}/deleted`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Bulk read - create job
  server.tool(
    "zoho_bulk_read_create_job",
    "Create a bulk read job to export large amounts of data from a module",
    {
      module: z.string().describe("Module API name"),
      fields: z.array(z.string()).optional().describe("Field API names to export"),
      criteria: z.record(z.unknown()).optional().describe("Filter criteria object"),
      page: z.number().min(1).optional().describe("Page number for pagination"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        query: { module: { api_name: args.module } },
      };
      if (args.fields) (body.query as Record<string, unknown>).fields = args.fields.map((f) => ({ api_name: f }));
      if (args.criteria) (body.query as Record<string, unknown>).criteria = args.criteria;
      if (args.page) (body.query as Record<string, unknown>).page = args.page;
      const result = await client.post("/bulk/read", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Bulk read - get job status
  server.tool(
    "zoho_bulk_read_get_job",
    "Check the status of a bulk read job",
    {
      job_id: z.string().describe("Bulk read job ID"),
    },
    async (args) => {
      const result = await client.get(`/bulk/read/${args.job_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Bulk write - create job
  server.tool(
    "zoho_bulk_write_create_job",
    "Create a bulk write job to import large amounts of data into a module",
    {
      module: z.string().describe("Module API name"),
      file_id: z.string().describe("Uploaded file ID"),
      operation: z.enum(["insert", "update", "upsert"]).describe("Operation type"),
      find_by: z.string().optional().describe("Field API name for duplicate check (for upsert)"),
    },
    async (args) => {
      const body: Record<string, unknown> = {
        operation: args.operation,
        resource: [{ type: "data", module: { api_name: args.module }, file_id: args.file_id }],
      };
      if (args.find_by) (body.resource as Record<string, unknown>[])[0].find_by = args.find_by;
      const result = await client.post("/bulk/write", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Bulk write - get job status
  server.tool(
    "zoho_bulk_write_get_job",
    "Check the status of a bulk write job",
    {
      job_id: z.string().describe("Bulk write job ID"),
    },
    async (args) => {
      const result = await client.get(`/bulk/write/${args.job_id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Get related records
  server.tool(
    "zoho_get_related_records",
    "Fetch records related to a specific record through a related list",
    {
      module: z.string().describe("Parent module API name"),
      record_id: z.string().describe("Parent record ID"),
      related_list: z.string().describe("Related list API name"),
      fields: z.string().optional().describe("Comma-separated field API names"),
      page: z.number().min(1).optional(),
      per_page: z.number().min(1).max(200).optional(),
    },
    async (args) => {
      const params: Record<string, unknown> = {};
      if (args.fields) params.fields = args.fields;
      if (args.page) params.page = args.page;
      if (args.per_page) params.per_page = args.per_page;
      const result = await client.get(`/${args.module}/${args.record_id}/${args.related_list}`, params);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Update related records
  server.tool(
    "zoho_update_related_records",
    "Update or associate related records to a parent record",
    {
      module: z.string().describe("Parent module API name"),
      record_id: z.string().describe("Parent record ID"),
      related_list: z.string().describe("Related list API name"),
      records: z.array(z.record(z.unknown())).min(1).max(100).describe("Related records to associate"),
    },
    async (args) => {
      const result = await client.put(`/${args.module}/${args.record_id}/${args.related_list}`, { data: args.records });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  // Delink related records
  server.tool(
    "zoho_delink_related_records",
    "Remove the association between a parent record and related records",
    {
      module: z.string().describe("Parent module API name"),
      record_id: z.string().describe("Parent record ID"),
      related_list: z.string().describe("Related list API name"),
      ids: z.string().describe("Comma-separated related record IDs to delink"),
    },
    async (args) => {
      const result = await client.delete(`/${args.module}/${args.record_id}/${args.related_list}`, { ids: args.ids });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
