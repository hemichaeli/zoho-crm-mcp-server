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

// Enterprise name → short tag slug
const ENTERPRISE_TAG_MAP: Record<string, string> = {
  "מתחם עיבוי וחיזוק בן גוריון - הכשרת הישוב": "בן-גוריון",
  "ראשון לציון - ז'בוטינסקי": "ז'בוטינסקי",
  "אור יהודה - החצב / יקותיאל אדם": "אור-יהודה",
  "רמת גן - תפארת ישראל": "רמת-גן",
};

interface BuildingInfo {
  id: string;
  enterpriseSlug: string;   // e.g. "בן-גוריון"
  subZone: string;          // e.g. "B"
  street: string;           // e.g. "דוד-רזיאל"
  streetNum: string;        // e.g. "16"
}

function createServer(): McpServer {
  const server = new McpServer({ name: "zoho-crm-mcp-server", version: "1.0.0" });
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

function zohoExpiryDate(offsetMs: number): string {
  const d = new Date(Date.now() + offsetMs);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}T` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}+00:00`;
}

async function renewNotification(): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  const expiry = zohoExpiryDate(24 * 60 * 60 * 1000);
  try {
    const token = await getZohoToken();
    const result = await axios.post(
      `${apiDomain}/crm/v2/actions/watch`,
      { watch: [{ channel_id: WEBHOOK_CHANNEL_ID, events: WEBHOOK_EVENTS, channel_expiry: expiry, token: WEBHOOK_TOKEN, notify_url: WEBHOOK_URL }] },
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const code = result.data?.watch?.[0]?.code;
    console.error(code === "SUCCESS" ? `[cron] Notification renewed until ${expiry}` : `[cron] Renewal unexpected: ${JSON.stringify(result.data)}`);
  } catch (err) {
    console.error(`[cron] Renewal failed:`, err instanceof Error ? err.message : String(err));
  }
}

// Fetch building details needed to compute tags
async function fetchBuildingInfo(buildingId: string, token: string): Promise<BuildingInfo | null> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    const res = await axios.get(
      `${apiDomain}/crm/v7/Buildings/${buildingId}?fields=id,Street,field4,field,enterptise`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const b = res.data?.data?.[0];
    if (!b) return null;
    const entName = b.enterptise?.name || "";
    const entSlug = ENTERPRISE_TAG_MAP[entName] || entName.replace(/\s+/g, "-").substring(0, 20);
    const subZone = b.field?.name || "";
    const street = (b.Street || "").replace(/\s+/g, "-");
    const streetNum = String(b.field4 || "");
    return { id: buildingId, enterpriseSlug: entSlug, subZone, street, streetNum };
  } catch {
    return null;
  }
}

// Compute the 4 tags for a building
function buildingToTags(b: BuildingInfo): string[] {
  const tags: string[] = ["נציג"];
  if (b.enterpriseSlug) tags.push(`נציג-${b.enterpriseSlug}`);
  if (b.enterpriseSlug && b.subZone) tags.push(`נציג-${b.enterpriseSlug}-${b.subZone}`);
  if (b.street && b.streetNum) tags.push(`נציג-${b.street}-${b.streetNum}`);
  return tags;
}

// Fetch all current LinkingModule2 records for a contact (remaining assignments)
async function fetchContactBuildings(contactId: string, token: string): Promise<BuildingInfo[]> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    // Search LinkingModule2 where field1 = contactId
    const res = await axios.get(
      `${apiDomain}/crm/v7/LinkingModule2?fields=id,field0,field1&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const records = res.data?.data || [];
    const buildingIds: string[] = records
      .filter((r: Record<string, unknown>) => {
        const f1 = r.field1 as Record<string, string> | undefined;
        return f1?.id === contactId;
      })
      .map((r: Record<string, unknown>) => {
        const f0 = r.field0 as Record<string, string> | undefined;
        return f0?.id || "";
      })
      .filter(Boolean);

    const buildings: BuildingInfo[] = [];
    for (const bid of buildingIds) {
      const info = await fetchBuildingInfo(bid, token);
      if (info) buildings.push(info);
    }
    return buildings;
  } catch {
    return [];
  }
}

// Set or clear field68 (נציג/ה checkbox) on Assets where field19 = contactId
async function updateAssetNasigCheckbox(contactId: string, buildingId: string | null, value: boolean, token: string): Promise<void> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";
  try {
    // Fetch Assets where field19 = contactId (and optionally field16 = buildingId)
    const res = await axios.get(
      `${apiDomain}/crm/v7/Assets?fields=id,field19,field16,field68&per_page=200`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    );
    const assets = res.data?.data || [];

    const toUpdate = assets.filter((a: Record<string, unknown>) => {
      const f19 = a.field19 as Record<string, string> | undefined;
      if (f19?.id !== contactId) return false;
      // If setting true and we have a buildingId, only update assets in that building
      if (value && buildingId) {
        const f16 = a.field16 as Record<string, string> | undefined;
        return f16?.id === buildingId;
      }
      return true;
    });

    if (toUpdate.length === 0) return;

    const updates = toUpdate.map((a: Record<string, unknown>) => ({ id: a.id, field68: value }));

    // Update in batches of 100
    for (let i = 0; i < updates.length; i += 100) {
      const batch = updates.slice(i, i + 100);
      await axios.put(
        `${apiDomain}/crm/v7/Assets`,
        { data: batch },
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } }
      );
    }
    console.error(`[webhook] Updated field68=${value} on ${toUpdate.length} assets for contact ${contactId}`);
  } catch (err) {
    console.error(`[webhook] updateAssetNasigCheckbox failed:`, err instanceof Error ? err.message : String(err));
  }
}

async function handleNasigOperation(
  operation: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  const apiDomain = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

  // Resolve contactId and buildingId from payload
  let contactId: string | null = null;
  let buildingId: string | null = null;

  const field1 = payload["field1"] as Record<string, unknown> | string | undefined;
  const field0 = payload["field0"] as Record<string, unknown> | string | undefined;

  if (field1 && typeof field1 === "object" && (field1 as Record<string,string>)["id"]) {
    contactId = String((field1 as Record<string,string>)["id"]);
  } else if (field1 && typeof field1 === "string") {
    contactId = field1;
  }

  if (field0 && typeof field0 === "object" && (field0 as Record<string,string>)["id"]) {
    buildingId = String((field0 as Record<string,string>)["id"]);
  } else if (field0 && typeof field0 === "string") {
    buildingId = field0;
  }

  // If missing, fetch the LinkingModule2 record
  if ((!contactId || !buildingId) && (operation === "insert" || operation === "create")) {
    const ids = payload["ids"] as string | undefined;
    const recordId = ids ? ids.split(",")[0].trim() : null;
    if (recordId) {
      try {
        const token = await getZohoToken();
        const res = await axios.get(
          `${apiDomain}/crm/v7/LinkingModule2/${recordId}`,
          { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
        );
        const rec = res.data?.data?.[0];
        if (!contactId) contactId = rec?.field1?.id ? String(rec.field1.id) : null;
        if (!buildingId) buildingId = rec?.field0?.id ? String(rec.field0.id) : null;
      } catch { /* ignore */ }
    }
  }

  if (!contactId) {
    return { success: false, message: `Could not resolve Contact ID. Operation: ${operation}` };
  }

  try {
    const token = await getZohoToken();

    if (operation === "insert" || operation === "create") {
      // --- ADD: compute tags for the new building and add them ---
      let tagsToAdd = ["נציג"];
      if (buildingId) {
        const bInfo = await fetchBuildingInfo(buildingId, token);
        if (bInfo) tagsToAdd = buildingToTags(bInfo);
      }

      await axios.post(
        `${apiDomain}/crm/v7/Contacts/actions/add_tags`,
        { ids: [contactId], tags: tagsToAdd.map(n => ({ name: n })) },
        { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } }
      );

      // Set field68 = true on Asset(s) of this contact in this building
      await updateAssetNasigCheckbox(contactId, buildingId, true, token);

      console.error(`[webhook] ADD: contact ${contactId} tags: ${tagsToAdd.join(", ")}`);
      return { success: true, message: `Added tags: ${tagsToAdd.join(", ")} to Contact ${contactId}` };

    } else if (operation === "delete") {
      // --- REMOVE: recalculate all remaining tags, remove orphaned ones ---
      const remainingBuildings = await fetchContactBuildings(contactId, token);
      const remainingTags = new Set<string>();
      remainingBuildings.forEach(b => buildingToTags(b).forEach(t => remainingTags.add(t)));

      // All possible tags
      const allPossibleTags = ["נציג",
        ...Object.values(ENTERPRISE_TAG_MAP).map(s => `נציג-${s}`),
        // We don't know all sub/building tags, so fetch current tags from contact
      ];

      // Fetch current contact tags
      const cRes = await axios.get(
        `${apiDomain}/crm/v7/Contacts/${contactId}?fields=Tag`,
        { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
      );
      const currentTags: string[] = (cRes.data?.data?.[0]?.Tag || []).map((t: Record<string,string>) => t.name);
      const nasigTags = currentTags.filter(t => t.startsWith("נציג"));
      const tagsToRemove = nasigTags.filter(t => !remainingTags.has(t));

      if (tagsToRemove.length > 0) {
        await axios.post(
          `${apiDomain}/crm/v7/Contacts/actions/remove_tags`,
          { ids: [contactId], tags: tagsToRemove.map(n => ({ name: n })) },
          { headers: { Authorization: `Zoho-oauthtoken ${token}`, "Content-Type": "application/json" } }
        );
      }

      // Update field68 checkbox on assets
      const isStillNasig = remainingBuildings.length > 0;
      await updateAssetNasigCheckbox(contactId, null, false, token);
      // Re-set true for buildings still assigned
      for (const rb of remainingBuildings) {
        await updateAssetNasigCheckbox(contactId, rb.id, true, token);
      }

      console.error(`[webhook] DELETE: contact ${contactId} removed tags: ${tagsToRemove.join(", ")} | still נציג: ${isStillNasig}`);
      return { success: true, message: `Removed tags: ${tagsToRemove.join(", ")} from Contact ${contactId}` };
    } else {
      return { success: false, message: `Unknown operation: ${operation}` };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Operation failed:`, msg);
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
      const result = await handleNasigOperation(operation, enrichedPayload);
      return res.json({ ok: result.success, message: result.message });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[webhook] Error:", msg);
      return res.status(500).json({ ok: false, error: msg });
    }
  });

  app.post("/mcp", async (req, res) => {
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
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
  runHTTP().catch((err) => { console.error("Server error:", err); process.exit(1); });
} else {
  runStdio().catch((err) => { console.error("Server error:", err); process.exit(1); });
}
