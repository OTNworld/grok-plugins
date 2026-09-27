/**
 * Minimal MCP stdio: JSON-RPC 2.0 + Content-Length framing.
 * No SDK. Tools are { name, description, inputSchema, handler }.
 */
import { Buffer } from "node:buffer";

export function jsonResult(obj, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
    ...(isError ? { isError: true } : {}),
  };
}

function writeMessage(msg) {
  const json = JSON.stringify(msg);
  const body = Buffer.from(json, "utf8");
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`);
  process.stdout.write(body);
}

export function serveMcp({ name, version, tools }) {
  const byName = new Map(tools.map((t) => [t.name, t]));

  function respond(id, result) {
    writeMessage({ jsonrpc: "2.0", id, result });
  }
  function fail(id, code, message) {
    writeMessage({ jsonrpc: "2.0", id, error: { code, message } });
  }

  async function handle(msg) {
    if (!msg || typeof msg !== "object") return;
    const { id, method, params } = msg;
    if (!method) return;

    if (method === "initialize") {
      respond(id, {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name, version },
      });
      return;
    }
    if (method === "notifications/initialized" || method === "initialized") return;
    if (method === "ping") {
      if (id !== undefined) respond(id, {});
      return;
    }
    if (method === "tools/list") {
      respond(id, {
        tools: tools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema,
        })),
      });
      return;
    }
    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};
      const tool = byName.get(toolName);
      if (!tool) {
        fail(id, -32601, `unknown tool: ${toolName}`);
        return;
      }
      try {
        const result = await tool.handler(args);
        respond(id, result);
      } catch (e) {
        respond(id, jsonResult({ error: e.message || String(e) }, true));
      }
      return;
    }
    if (id !== undefined) fail(id, -32601, `unknown method: ${method}`);
  }

  let buf = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;
      const header = buf.slice(0, headerEnd).toString("utf8");
      const m = header.match(/Content-Length:\s*(\d+)/i);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) break;
      const body = buf.slice(start, start + len).toString("utf8");
      buf = buf.slice(start + len);
      try {
        handle(JSON.parse(body));
      } catch (e) {
        writeMessage({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: e.message || "parse error" },
        });
      }
    }
  });
  process.stdin.on("end", () => process.exit(0));
  process.stdin.resume();
}
