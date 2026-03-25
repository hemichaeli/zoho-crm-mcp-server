import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import axios from "axios";
import { ZohoClient } from "./client.js";
import { registerRecordTools } from "./tools/records.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerTagTools, registerNoteTools, registerUserTools } from "./tools/tags-notes-users.js";
import { registerAutomationTools } from "./tools/automation.js";
import { registerActivityTools } from "./tools/activities.js";

const WEBHOOK_CHANNEL_ID = "77001";
const WEBHOOK_URL = "https://zoho-crm-mcp-server-production-f0c4.up.railway.app/webhook/zoho-tags";
const WEBHOOK_TOKEN = "nasig-tag-automation";
const WEBHOOK_EVENTS = ["LinkingModule2.create", "LinkingModule2.delete"];
const RENEWAL_INTERVAL_MS = 23 * 60 * 60 * 1000;

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

async function getZohoToken(): Promise<string> {
  const accountsDomain = process.env.ZOHO_ACCOUNTS_DOMAIN || "https://accounts.zoho.com";
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.ZOHO_CLIENT_ID || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET || "",
    refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
  });
  const res = await axios.post(
    `${accountsDomain}/oauth/v2/token`,
    params.toString(),
    { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
  );
  return res.data.access_token as string;
}

async function renewNotification(): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  try {
    const token = await getZohoToken();
    const result = await axios.post(
      `${apiDomain}/crm/v2/actions/watch`,
      {
        watch: [{
          channel_id: WEBHOOK_CHANNEL_ID,
          events: WEBHOOK_EVENTS,
          channel_expiry: expiry,
          token: WEBHOOK_TOKEN,
          notify_url: WEBHOOK_URL,
        }],
      },
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const code = result.data?.watch?.[0]?.code;
    if (code === "SUCCESS") {
      console.error(`[cron] Notification renewed until ${expiry}`);
    } else {
      console.error(`[cron] Renewal unexpected:`, JSON.stringify(result.data));
    }
  } catch (err) {
    console.error(`[cron] Renewal failed:`, err instanceof Error ? err.message : String(err));
  }
}

async function addTag(contactId: string): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const token = await getZohoToken();
  // ZOHO add_tags: POST with tag_names (strings) + ids
  await axios.post(
    `${apiDomain}/crm/v7/Contacts/actions/add_tags`,
    { tag_names: ["נציג"], ids: [contactId] },
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
}

async function removeTag(contactId: string): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const token = await getZohoToken();
  // ZOHO remove_tags: POST with tag_names (strings) + ids
  await axios.post(
    `${apiDomain}/crm/v7/Contacts/actions/remove_tags`,
    { tag_names: ["נציג"], ids: [contactId] },
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  );
}

async function fetchContactIdFromLinkingRecord(recordId: string, token: string): Promise<string | null> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    const res = await axios.get(
      `${apiDomain}/crm/v7/LinkingModule2/${recordId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const f1 = res.data?.data?.[0]?.field1;
    return f1?.id ? String(f1.id) : null;
  } catch {
    return null;
  }
}

async function handleNasigTag(
  operation: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  let contactId: string | null = null;

  const field1 = payload["field1"] as Record<string, unknown> | string | undefined;
  if (field1 && typeof field1 === "object" && field1["id"]) {
    contactId = String(field1["id"]);
  } else if (field1 && typeof field1 === "string") {
    contactId = field1;
  }

  if (!contactId && (operation === "insert" || operation === "create")) {
    const ids = payload["ids"] as string | undefined;
    const recordId = ids ? ids.split(",")[0].trim() : null;
    if (recordId) {
      const token = await getZohoToken();
      contactId = await fetchContactIdFromLinkingRecord(recordId, token);
    }
  }

  if (!contactId) {
    return { success: false, message: `Could not resolve Contact ID. Operation: ${operation}` };
  }

  try {
    if (operation === "insert" || operation === "create") {
      await addTag(contactId);
      console.error(`[webhook] Added tag נציג to Contact ${contactId}`);
      return { success: true, message: `Added tag נציג to Contact ${contactId}` };
    } else if (operation === "delete") {
      await removeTag(contactId);
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

  await renewNotification();
  setInterval(() => renewNotification(), RENEWAL_INTERVAL_MS);

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "zoho-crm-mcp-server", version: "1.0.0" });
  });

  app.post("/webhook/zoho-tags", async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      console.error("[webhook] Received:", JSON.stringify(body));
      const queryParams = (body["query_params"] ?? body) as Record<string, unknown>;
      const module = String(queryParams["module"] ?? "");
      const operation = String(queryParams["operation"] ?? "").toLowerCase();
      const ids = String(queryParams["ids"] ?? "");

      if (module !== "LinkingModule2") {
        return res.json({ ok: true, skipped: true, reason: "not LinkingModule2" });
      }

      const enrichedPayload: Record<string, unknown> = { ...body, ids, operation };
      const result = await handleNasigTag(operation, enrichedPayload);
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
    console.error(`Webhook: http://localhost:${port}/webhook/zoho-tags`);
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
