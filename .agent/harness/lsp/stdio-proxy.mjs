import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { TOOLS } from "./tools-schema.mjs";
import { DEFAULT_PORT, ensureDaemon } from "./ensure-daemon.mjs";

const server = new Server(
  { name: "cogain-warm-lsp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const name = request.params.name;
  const args = request.params.arguments || {};
  try {
    const up = await ensureDaemon(DEFAULT_PORT, 5000);
    if (!up) {
      return {
        content: [{ type: "text", text: "Error: Warm LSP daemon failed to start on 127.0.0.1." }],
      };
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35000);
    try {
      const res = await fetch(`http://127.0.0.1:${DEFAULT_PORT}/tool`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: args }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        return {
          content: [{ type: "text", text: `Error: ${json?.error || `HTTP ${res.status}`}` }],
        };
      }
      return json.result;
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    return {
      content: [{ type: "text", text: `Error: ${err instanceof Error ? err.message : String(err)}` }],
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
ensureDaemon(DEFAULT_PORT, 5000).catch(() => {});
