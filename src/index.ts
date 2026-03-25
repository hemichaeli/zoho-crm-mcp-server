import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import { ZohoClient } from "./client.js";
import { registerRecordTools } from "./tools/records.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerTagTools, registerNoteTools, registerUserTools } from "./tools/tags-notes-users.js";
import { registerAutomationTools } from "./tools/automation.js";
import { registerActivityTools } from "./tools/activities.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "zoho-crm-mcp-server",
    version: "1.0.0",
  });

  const client = new ZohoClient();

  registerRecordTools(server, client);
  registerMetadataTools(server, client);
  registerTagTools(server, client);
  registerNoteTools(server, client);
  registerUserTools(server, client);
  registerAutomationTools(server, client);
  registerActivityTools(server, client);

  return server;
}

// Webhook handler: add/remove "נציג" tag on Contacts based on LinkingModule2 events
async function handleNasigTag(
  client: ZohoClient,
  operation: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  // Extract Contact ID from field1 - ZOHO sends it as object with id or as string
  let contactId: string | null = null;

  // Try payload.field1 (ZOHO sometimes includes field data)
  const field1 = payload["field1"] as Record<string, unknown> | string | undefined;
  if (field1 && typeof field1 === "object" && field1["id"]) {
    contactId = String(field1["id"]);
  } else if (field1 && typeof field1 === "string") {
    contactId = field1;
  }

  // For insert: if no field1 in payload, fetch the record
  if (!contactId && (operation === "insert" || operation === "create")) {
    const ids = payload["ids"] as string | undefined;
    const recordId = ids ? ids.split(",")[0].trim() : null;
    if (recordId) {
      try {
        const result = await client.get<{ data: Record<string, unknown>[] }>(
          `/LinkingModule2/${recordId}`
        );
        const record = result?.data?.[0];
        const f1 = record?.["field1"] as Record<string, unknown> | undefined;
        if (f1?.["id"]) {
          contactId = String(f1["id"]);
        }
      } catch (err) {
        console.error("[webhook] Failed to fetch LinkingModule2 record:", err);
      }
    }
  }

  if (!contactId) {
    return { success: false, message: `Could not resolve Contact ID from payload. Operation: ${operation}` };
  }

  try {
    if (operation === "insert" || operation === "create") {
      // Add "נציג" tag
      await client.post(`/Contacts/actions/add_tags`, {
        ids: [contactId],
        tags: [{ name: "נציג" }],
      });
      console.error(`[webhook] Added tag נציג to Contact ${contactId}`);
      return { success: true, message: `Added tag נציג to Contact ${contactId}` };
    } else if (operation === "delete") {
      // Remove "נציג" tag
      await client.delete(`/Contacts/actions/remove_tags`, {
        ids: contactId,
        tag_names: "נציג",
      });
      console.error(`[webhook] Removed tag נציג from Contact ${contactId}`);
      return { success: true, message: `Removed tag נציג from Contact ${contactId}` };
    } else {
      return { success: false, message: `Unknown operation: ${operation}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Tag operation failed:`, msg);
    return { success: false, message: msg };
  }
}

async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  const zohoClient = new ZohoClient();

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "zoho-crm-mcp-server", version: "1.0.0" });
  });

  // Webhook: receives ZOHO Notifications for LinkingModule2 create/delete
  app.post("/webhook/zoho-tags", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      console.error("[webhook] Received:", JSON.stringify(body));

      // ZOHO notification structure: body may have query_params or top-level fields
      const queryParams = (body["query_params"] ?? body) as Record<string, unknown>;
      const module = String(queryParams["module"] ?? "");
      const operation = String(queryParams["operation"] ?? "").toLowerCase();
      const ids = String(queryParams["ids"] ?? "");

      if (module !== "LinkingModule2") {
        return res.json({ ok: true, skipped: true, reason: "not LinkingModule2" });
      }

      // Merge top-level payload fields (ZOHO sometimes sends field data at root)
      const enrichedPayload: Record<string, unknown> = {
        ...body,
        ids,
        operation,
      };

      const result = await handleNasigTag(zohoClient, operation, enrichedPayload);
      return res.json({ ok: result.success, message: result.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[webhook] Error:", msg);
      return res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => {
    console.error(`ZOHO CRM MCP Server running on http://localhost:${port}/mcp`);
    console.error(`Webhook endpoint: http://localhost:${port}/webhook/zoho-tags`);
  });
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("ZOHO CRM MCP Server running on stdio");
}

const transport = process.env.TRANSPORT || "http";
if (transport === "http") {
  runHTTP().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
} else {
  runStdio().catch((err) => {
    console.error("Server error:", err);
    process.exit(1);
  });
}
