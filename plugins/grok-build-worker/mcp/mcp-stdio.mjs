/**
 * Minimal MCP stdio: JSON-RPC 2.0.
 * Write: one JSON object per line (MCP 2025-06-18 stdio).
 * Read: NDJSON or legacy Content-Length frames.
 */
import { Buffer } from "node:buffer";

export function jsonResult(obj, isError = false) {
  return {
    content: [{ type: "text", text: JSON.stringify(obj, null, 2) }],
    isError: Boolean(isError),
  };
}

function writeMessage(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

export function serveMcp({ name, version, tools }) {
  const byName = new Map(tools.map((t) => [t.name, t]));
  let initialized = false;

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
      initialized = true;
      respond(id, {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: false },
          resources: { listChanged: false },
        },
        serverInfo: { name, version },
      });
      return;
    }
    if (method === "notifications/initialized" || method === "initialized") {
      initialized = true;
      return;
    }
    if (method === "notifications/cancelled") return;
    if (method === "ping") {
      if (id !== undefined) respond(id, {});
      return;
    }
    if (method === "logging/setLevel") {
      if (id !== undefined) respond(id, {});
      return;
    }
    if (method === "prompts/list") {
      respond(id, { prompts: [] });
      return;
    }
    if (method === "resources/list") {
      respond(id, { resources: [] });
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

  function takeNdjson(buf) {
    const nl = buf.indexOf("\n");
    if (nl === -1) return { buf, msg: null };
    const line = buf.slice(0, nl).toString("utf8").replace(/\r$/, "").trim();
    buf = buf.slice(nl + 1);
    if (!line || line[0] !== "{") return { buf, msg: null };
    return { buf, msg: JSON.parse(line) };
  }

  function takeContentLength(buf) {
    const headerEnd = buf.indexOf("\r\n\r\n");
    if (headerEnd === -1) return { buf, msg: undefined };
    const header = buf.slice(0, headerEnd).toString("utf8");
    const m = header.match(/Content-Length:\s*(\d+)/i);
    if (!m) return { buf: buf.slice(headerEnd + 4), msg: null };
    const len = Number(m[1]);
    const start = headerEnd + 4;
    if (buf.length < start + len) return { buf, msg: undefined };
    const body = buf.slice(start, start + len).toString("utf8");
    return { buf: buf.slice(start + len), msg: JSON.parse(body) };
  }

  let buf = Buffer.alloc(0);
  process.stdin.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (buf.length) {
      const looksHeader = buf.slice(0, Math.min(buf.length, 16)).toString("utf8").toLowerCase().startsWith("content-length");
      let next;
      try {
        next = looksHeader ? takeContentLength(buf) : takeNdjson(buf);
      } catch (e) {
        writeMessage({
          jsonrpc: "2.0",
          id: null,
          error: { code: -32700, message: e.message || "parse error" },
        });
        buf = Buffer.alloc(0);
        break;
      }
      if (next.msg === undefined) break; // need more bytes
      buf = next.buf;
      if (next.msg) handle(next.msg);
      if (!looksHeader && next.msg === null && buf.indexOf("\n") === -1) break;
      if (!looksHeader && next.msg === null) continue;
    }
  });
  process.stdin.on("end", () => process.exit(0));
  process.stdin.resume();
}
