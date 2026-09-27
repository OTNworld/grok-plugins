#!/usr/bin/env node
// First start: npm ci from the shipped lockfile, then exec the stdio server.
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(fileURLToPath(import.meta.url));
const sdk = join(root, "node_modules", "@modelcontextprotocol", "sdk");
if (!existsSync(sdk)) {
  if (!existsSync(join(root, "package-lock.json"))) {
    console.error("grok-build-worker: missing package-lock.json");
    process.exit(1);
  }
  const r = spawnSync("npm", ["ci", "--omit=dev"], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
const child = spawnSync(process.execPath, [join(root, "server.js")], {
  cwd: root,
  stdio: "inherit",
});
process.exit(child.status ?? 1);
