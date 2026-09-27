import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const serverPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "server.js");

function spawnServer() {
  return spawn(process.execPath, [serverPath], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, GROK_BUILD_JOBS_ROOT: "/tmp/grok-build-worker-test-jobs" },
  });
}

function sendLine(child, msg) {
  child.stdin.write(JSON.stringify(msg) + "\n");
}

function sendContentLength(child, msg) {
  const body = Buffer.from(JSON.stringify(msg), "utf8");
  child.stdin.write(`Content-Length: ${body.length}\r\n\r\n`);
  child.stdin.write(body);
}

function readLine(child, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    let buf = "";
    const t = setTimeout(() => reject(new Error("timeout")), timeoutMs);
    const onData = (chunk) => {
      buf += chunk.toString("utf8");
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      clearTimeout(t);
      child.stdout.off("data", onData);
      resolve(JSON.parse(buf.slice(0, nl)));
    };
    child.stdout.on("data", onData);
  });
}

test("NDJSON initialize + tools/list", async () => {
  const child = spawnServer();
  try {
    sendLine(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    const init = await readLine(child);
    assert.equal(init.id, 1);
    assert.equal(init.result.serverInfo.name, "Grok build worker");
    assert.equal(init.result.capabilities.tools.listChanged, false);
    sendLine(child, { jsonrpc: "2.0", method: "notifications/initialized" });
    sendLine(child, { jsonrpc: "2.0", id: 2, method: "tools/list" });
    const listed = await readLine(child);
    const names = listed.result.tools.map((t) => t.name).sort();
    assert.deepEqual(names, ["cancel_job", "fetch_artifacts", "status", "submit_job"]);
  } finally {
    child.kill("SIGKILL");
  }
});

test("legacy Content-Length initialize still works", async () => {
  const child = spawnServer();
  try {
    sendContentLength(child, {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });
    const init = await readLine(child);
    assert.equal(init.id, 1);
    assert.equal(init.result.serverInfo.name, "Grok build worker");
  } finally {
    child.kill("SIGKILL");
  }
});
