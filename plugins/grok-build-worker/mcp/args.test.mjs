import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveJobOptions, buildGrokArgs } from "./args.mjs";

test("default mode is review_readonly", () => {
  const r = resolveJobOptions({ goal: "look at README", cwd: "/tmp" });
  assert.equal(r.mode, "review_readonly");
});

test("default argv has no bypassPermissions", () => {
  const opts = resolveJobOptions({ goal: "look at README", cwd: "/tmp" });
  const argv = buildGrokArgs({ ...opts, cwd: "/tmp" });
  assert.equal(argv.includes("bypassPermissions"), false);
  assert.equal(argv.includes("--always-approve"), false);
});

test("explicit build has no implicit bypass", () => {
  const opts = resolveJobOptions({ goal: "implement x", cwd: "/tmp", mode: "build" });
  const argv = buildGrokArgs({ ...opts, cwd: "/tmp" });
  assert.equal(opts.mode, "build");
  assert.equal(argv.includes("bypassPermissions"), false);
  assert.equal(argv.includes("--always-approve"), false);
});

test("permission_mode opt-in still passed", () => {
  const opts = resolveJobOptions({
    goal: "implement x",
    cwd: "/tmp",
    mode: "build",
    permission_mode: "bypassPermissions",
  });
  const argv = buildGrokArgs({ ...opts, cwd: "/tmp" });
  assert.ok(argv.includes("bypassPermissions"));
  assert.equal(argv.includes("--always-approve"), false);
});
