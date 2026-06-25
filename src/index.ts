import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";
import axios from "axios";
import { ZohoClient } from "./client.js";
import { registerRecordTools } from "./tools/records.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerTagTools, registerNoteTools, registerUserTools as registerUserToolsFromTNU } from "./tools/tags-notes-users.js";
import { registerAutomationTools } from "./tools/automation.js";
import { registerActivityTools } from "./tools/activities.js";
import { registerCalendarTools } from "./tools/calendar.js";

const WEBHOOK_CHANNEL_ID = "77001";
const WEBHOOK_URL = "https://zoho-crm-mcp-server-production-f0c4.up.railway.app/webhook/zoho-tags";
const WEBHOOK_TOKEN = "nasig-tag-automation";
const WEBHOOK_EVENTS = ["LinkingModule2.create", "LinkingModule2.delete"];
const RENEWAL_INTERVAL_MS = 23 * 60 * 60 * 1000;

const ENTERPRISE_TAG_MAP: Record<string, string> = {
  "\u05DE\u05EA\u05D7\u05DD \u05E2\u05D9\u05D1\u05D5\u05D9 \u05D5\u05D7\u05D9\u05D6\u05D5\u05E7 \u05D1\u05DF \u05D2\u05D5\u05E8\u05D9\u05D5\u05DF - \u05D4\u05DB\u05E9\u05E8\u05EA \u05D4\u05D9\u05E9\u05D5\u05D1": "\u05D1\u05DF-\u05D2\u05D5\u05E8\u05D9\u05D5\u05DF",
  "\u05E8\u05D0\u05E9\u05D5\u05DF \u05DC\u05E6\u05D9\u05D5\u05DF - \u05D6'\u05D1\u05D5\u05D8\u05D9\u05E0\u05E1\u05E7\u05D9": "\u05D6'\u05D1\u05D5\u05D8\u05D9\u05E0\u05E1\u05E7\u05D9",
  "\u05D0\u05D5\u05E8 \u05D9\u05D4\u05D5\u05D3\u05D4 - \u05D4\u05D7\u05E6\u05D1 / \u05D9\u05E7\u05D5\u05EA\u05D9\u05D0\u05DC \u05D0\u05D3\u05DD": "\u05D0\u05D5\u05E8-\u05D9\u05D4\u05D5\u05D3\u05D4",
  "\u05E8\u05DE\u05EA \u05D2\u05DF - \u05EA\u05E4\u05D0\u05E8\u05EA \u05D9\u05E9\u05E8\u05D0\u05DC": "\u05E8\u05DE\u05EA-\u05D2\u05DF",
};

interface BuildingInfo {
  id: string;
  enterpriseSlug: string;
  subZone: string;
  street: string;
  streetNum: string;
}

let _server: McpServer | null = null;

function getServer(): McpServer {
  if (_server) return _server;
  const server = new McpServer({ name: "zoho-crm-mcp-server", version: "1.2.2" });
  const client = new ZohoClient();
  registerRecordTools(server, client);
  registerMetadataTools(server, client);
  registerTagTools(server, client);
  registerNoteTools(server, client);
  registerUserToolsFromTNU(server, client);
  registerAutomationTools(server, client);
  registerActivityTools(server, client);
  registerCalendarTools(server, client);
  _server = server;
  console.error("MCP server v1.2.2 initialized");
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
  const res = await axios.post(`${accountsDomain}/oauth/v2/token`, params.toString(), { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  return res.data.access_token as string;
}

function zohoExpiryDate(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`;
}

async function renewNotification(): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const expiry = zohoExpiryDate(24 * 60 * 60 * 1000);
  try {
    const token = await getZohoToken();
    const result = await axios.post(`${apiDomain}/crm/v2/actions/watch`, { watch: [{ channel_id: WEBHOOK_CHANNEL_ID, events: WEBHOOK_EVENTS, channel_expiry: expiry, token: WEBHOOK_TOKEN, notify_url: WEBHOOK_URL }] }, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    const code = result.data?.watch?.[0]?.code;
    console.error(code === "SUCCESS" ? `[cron] Notification renewed until ${expiry}` : `[cron] Renewal unexpected: ${JSON.stringify(result.data)}`);
  } catch (err) {
    console.error(`[cron] Renewal failed:`, err instanceof Error ? err.message : String(err));
  }
}

async function fetchBuildingInfo(buildingId: string, token: string): Promise<BuildingInfo | null> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    const res = await axios.get(`${apiDomain}/crm/v7/Buildings/${buildingId}?fields=id,Street,field4,field,enterptise`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    const b = res.data?.data?.[0];
    if (!b) return null;
    const entName = b.enterptise?.name || "";
    const entSlug = ENTERPRISE_TAG_MAP[entName] || entName.replace(/\s+/g, "-").substring(0, 20);
    return { id: buildingId, enterpriseSlug: entSlug, subZone: b.field?.name || "", street: (b.Street || "").replace(/\s+/g, "-"), streetNum: String(b.field4 || "") };
  } catch { return null; }
}

function buildingToTags(b: BuildingInfo): string[] {
  const tags: string[] = ["\u05E0\u05E6\u05D9\u05D2"];
  if (b.enterpriseSlug) tags.push(`\u05E0\u05E6\u05D9\u05D2-${b.enterpriseSlug}`);
  if (b.enterpriseSlug && b.subZone) tags.push(`\u05E0\u05E6\u05D9\u05D2-${b.enterpriseSlug}-${b.subZone}`);
  if (b.street && b.streetNum) tags.push(`\u05E0\u05E6\u05D9\u05D2-${b.street}-${b.streetNum}`);
  return tags;
}

async function fetchContactBuildings(contactId: string, token: string): Promise<BuildingInfo[]> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    const res = await axios.get(`${apiDomain}/crm/v7/LinkingModule2?fields=id,field0,field1&per_page=200`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    const buildingIds: string[] = (res.data?.data || []).filter((r: Record<string, unknown>) => (r.field1 as Record<string, string> | undefined)?.id === contactId).map((r: Record<string, unknown>) => (r.field0 as Record<string, string> | undefined)?.id || "").filter(Boolean);
    const buildings: BuildingInfo[] = [];
    for (const bid of buildingIds) { const info = await fetchBuildingInfo(bid, token); if (info) buildings.push(info); }
    return buildings;
  } catch { return []; }
}

async function updateAssetNasigCheckbox(contactId: string, buildingId: string | null, value: boolean, token: string): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    const res = await axios.get(`${apiDomain}/crm/v7/Assets?fields=id,field19,field16,field68&per_page=200`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
    const toUpdate = (res.data?.data || []).filter((a: Record<string, unknown>) => {
      const f19 = a.field19 as Record<string, string> | undefined;
      if (f19?.id !== contactId) return false;
      if (value && buildingId) return (a.field16 as Record<string, string> | undefined)?.id === buildingId;
      return true;
    });
    if (!toUpdate.length) return;
    for (let i = 0; i < toUpdate.length; i += 100) {
      await axios.put(`${apiDomain}/crm/v7/Assets`, { data: toUpdate.slice(i, i + 100).map((a: Record<string, unknown>) => ({ id: a.id, field68: value })) }, { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } });
    }
  } catch (err) { console.error(`[webhook] updateAssetNasigCheckbox failed:`, err instanceof Error ? err.message : String(err)); }
}

async function handleNasigOperation(operation: string, payload: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  let contactId: string | null = null, buildingId: string | null = null;
  const f1 = payload["field1"] as Record<string, unknown> | string | undefined;
  const f0 = payload["field0"] as Record<string, unknown> | string | undefined;
  if (f1 && typeof f1 === "object" && (f1 as Record<string,string>)["id"]) contactId = String((f1 as Record<string,string>)["id"]);
  else if (typeof f1 === "string") contactId = f1;
  if (f0 && typeof f0 === "object" && (f0 as Record<string,string>)["id"]) buildingId = String((f0 as Record<string,string>)["id"]);
  else if (typeof f0 === "string") buildingId = f0;
  if ((!contactId || !buildingId) && (operation === "insert" || operation === "create")) {
    const ids = payload["ids"] as string | undefined;
    const recordId = ids ? ids.split(",")[0].trim() : null;
    if (recordId) {
      try {
        const token = await getZohoToken();
        const res = await axios.get(`${apiDomain}/crm/v7/LinkingModule2/${recordId}`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
        const rec = res.data?.data?.[0];
        if (!contactId) contactId = rec?.field1?.id ? String(rec.field1.id) : null;
        if (!buildingId) buildingId = rec?.field0?.id ? String(rec.field0.id) : null;
      } catch { /* ignore */ }
    }
  }
  if (!contactId) return { success: false, message: `Could not resolve Contact ID. Operation: ${operation}` };
  try {
    const token = await getZohoToken();
    if (operation === "insert" || operation === "create") {
      let tagsToAdd = ["\u05E0\u05E6\u05D9\u05D2"];
      if (buildingId) { const bInfo = await fetchBuildingInfo(buildingId, token); if (bInfo) tagsToAdd = buildingToTags(bInfo); }
      await axios.post(`${apiDomain}/crm/v7/Contacts/actions/add_tags`, { ids: [contactId], tags: tagsToAdd.map(n => ({ name: n })) }, { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } });
      await updateAssetNasigCheckbox(contactId, buildingId, true, token);
      return { success: true, message: `Added tags: ${tagsToAdd.join(", ")} to Contact ${contactId}` };
    } else if (operation === "delete") {
      const remaining = await fetchContactBuildings(contactId, token);
      const remainingTags = new Set<string>();
      remaining.forEach(b => buildingToTags(b).forEach(t => remainingTags.add(t)));
      const cRes = await axios.get(`${apiDomain}/crm/v7/Contacts/${contactId}?fields=Tag`, { headers: { Authorization: `Zoho-oauthtoken ${token}` } });
      const currentTags: string[] = (cRes.data?.data?.[0]?.Tag || []).map((t: Record<string,string>) => t.name);
      const toRemove = currentTags.filter(t => t.startsWith("\u05E0\u05E6\u05D9\u05D2") && !remainingTags.has(t));
      if (toRemove.length) await axios.post(`${apiDomain}/crm/v7/Contacts/actions/remove_tags`, { ids: [contactId], tags: toRemove.map(n => ({ name: n })) }, { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } });
      await updateAssetNasigCheckbox(contactId, null, false, token);
      for (const rb of remaining) await updateAssetNasigCheckbox(contactId, rb.id, true, token);
      return { success: true, message: `Removed tags: ${toRemove.join(", ")} from Contact ${contactId}` };
    }
    return { success: false, message: `Unknown operation: ${operation}` };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Operation failed:`, msg);
    return { success: false, message: msg };
  }
}

async function runHTTP(): Promise<void> {
  const app = express();
  const server = getServer();
  const sessions = new Map<string, SSEServerTransport>();

  await renewNotification();
  setInterval(() => renewNotification(), RENEWAL_INTERVAL_MS);

  app.get("/health", (_req, res) => res.json({ status: "ok", service: "zoho-crm-mcp-server", version: "1.2.2" }));

  app.get("/sse", async (_req, res) => {
    const transport = new SSEServerTransport("/messages", res);
    sessions.set(transport.sessionId, transport);
    res.on("close", () => sessions.delete(transport.sessionId));
    await server.connect(transport);
  });

  app.post("/messages", express.json(), async (req, res) => {
    const transport = sessions.get(req.query.sessionId as string);
    if (!transport) { res.status(404).json({ error: "Session not found" }); return; }
    await transport.handlePostMessage(req, res);
  });

  app.post("/webhook/zoho-tags", express.json(), async (req, res) => {
    try {
      const body = req.body as Record<string, unknown>;
      const qp = (body["query_params"] ?? body) as Record<string, unknown>;
      const module = String(qp["module"] ?? "");
      if (module !== "LinkingModule2") return res.json({ ok: true, skipped: true });
      const operation = String(qp["operation"] ?? "").toLowerCase();
      const ids = String(qp["ids"] ?? "");
      const result = await handleNasigOperation(operation, { ...body, ids, operation });
      return res.json({ ok: result.success, message: result.message });
    } catch (err) {
      return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, () => console.error(`ZOHO CRM MCP v1.2.2 on :${port} | /sse | /messages | /webhook/zoho-tags`));
}

async function runStdio(): Promise<void> {
  const server = getServer();
  await server.connect(new StdioServerTransport());
}

const mode = process.env.TRANSPORT || "http";
if (mode === "http") runHTTP().catch(err => { console.error("Server error:", err); process.exit(1); });
else runStdio().catch(err => { console.error("Server error:", err); process.exit(1); });
