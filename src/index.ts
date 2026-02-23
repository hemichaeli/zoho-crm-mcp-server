import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import express from "express";

import { registerRecordTools } from "./tools/records.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerRelatedTools } from "./tools/related.js";
import { registerUserTools } from "./tools/users.js";
import { registerOperationTools } from "./tools/operations.js";

function createServer(): McpServer {
  const server = new McpServer({
    name: "zoho-crm-mcp-server",
    version: "1.0.0",
  });

  registerRecordTools(server);
  registerMetadataTools(server);
  registerRelatedTools(server);
  registerUserTools(server);
  registerOperationTools(server);

  console.error("Registered all Zoho CRM MCP tools");
  return server;
}

async function runHTTP(): Promise<void> {
  const app = express();

  // Store active SSE transports by session ID
  const sessions = new Map<string, SSEServerTransport>();

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "zoho-crm-mcp-server", version: "1.0.0" });
  });

  // SSE endpoint
  app.get("/sse", async (req, res) => {
    console.error("New SSE connection from " + req.ip);
    const transport = new SSEServerTransport("/messages", res);
    const sessionId = transport.sessionId;
    sessions.set(sessionId, transport);
    console.error("SSE session created: " + sessionId);

    res.on("close", () => {
      console.error("SSE session closed: " + sessionId);
      sessions.delete(sessionId);
    });

    const server = createServer();
    await server.connect(transport);
    console.error("SSE session connected: " + sessionId);
  });

  // Messages endpoint - DO NOT use express.json() here
  // SSEServerTransport.handlePostMessage needs the raw request stream
  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ error: "Missing sessionId query parameter" });
      return;
    }

    const transport = sessions.get(sessionId);
    if (!transport) {
      res.status(404).json({ error: "Session not found. It may have expired." });
      return;
    }

    try {
      await transport.handlePostMessage(req, res);
    } catch (error) {
      console.error("Error handling message for session " + sessionId + ":", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  const port = parseInt(process.env.PORT || "3000");
  app.listen(port, "0.0.0.0", () => {
    console.error("Zoho CRM MCP Server running on http://0.0.0.0:" + port);
    console.error("  - Health: http://0.0.0.0:" + port + "/health");
    console.error("  - SSE:    http://0.0.0.0:" + port + "/sse");
  });
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zoho CRM MCP Server running on stdio");
}

const transport = process.env.TRANSPORT || "http";
if (transport === "http") {
  runHTTP().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
} else {
  runStdio().catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
  });
}
