import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.js");

function send(child, msg) {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

function readOne(child, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      const idx = buf.indexOf("\r\n\r\n");
      if (idx === -1) return;
      const m = buf.slice(0, idx).toString("utf8").match(/Content-Length:\s*(\d+)/i);
      if (!m) return;
      const len = Number(m[1]);
      const start = idx + 4;
      if (buf.length < start + len) return;
      clearTimeout(t);
      child.stdout.off("data", onData);
      resolve(JSON.parse(buf.slice(start, start + len).toString("utf8")));
    };
    child.stdout.on("data", onData);
  });
}

test("stdio initialize + tools/list names the four tools", async () => {
  const child = spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GROK_BUILD_JOBS_ROOT: "/tmp/grok-build-worker-test-jobs" },
  });
  try {
    send(child, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18" } });
    const init = await readOne(child);
    assert.equal(init.id, 1);
    assert.equal(init.result.serverInfo.name, "Grok build worker");
    send(child, { jsonrpc: "2.0", method: "notifications/initialized" });
    send(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const listed = await readOne(child);
    const names = listed.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["cancel_job", "fetch_artifacts", "status", "submit_job"]);
  } finally {
    child.kill("SIGKILL");
  }
});
