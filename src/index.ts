import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
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

  // Register all tool groups
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
  app.use(express.json());

  // Health check
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "zoho-crm-mcp-server", version: "1.0.0" });
  });

  // SSE endpoint for backwards compatibility
  app.get("/sse", (_req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const sessionId = crypto.randomUUID();
    const messageEndpoint = `/messages?sessionId=${sessionId}`;

    res.write(`event: endpoint\ndata: ${messageEndpoint}\n\n`);

    const keepAlive = setInterval(() => {
      res.write(":keepalive\n\n");
    }, 15000);

    res.on("close", () => {
      clearInterval(keepAlive);
    });
  });

  // Streamable HTTP transport (modern MCP protocol)
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

  // Legacy SSE message handler
  app.post("/messages", async (req, res) => {
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
  app.listen(port, "0.0.0.0", () => {
    console.error(`Zoho CRM MCP Server running on http://0.0.0.0:${port}`);
    console.error(`  - Health: http://0.0.0.0:${port}/health`);
    console.error(`  - MCP:    http://0.0.0.0:${port}/mcp`);
    console.error(`  - SSE:    http://0.0.0.0:${port}/sse`);
  });
}

async function runStdio(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Zoho CRM MCP Server running on stdio");
}

// Choose transport based on environment
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
