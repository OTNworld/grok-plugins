import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assertJobId, isUnderRoot, resolveWorkCwd } from "./guard.mjs";

test("assertJobId accepts UUID v4", () => {
  const id = "550e8400-e29b-41d4-a716-446655440000";
  assert.equal(assertJobId(id), id);
});

test("assertJobId rejects traversal", () => {
  assert.throws(() => assertJobId("../etc/passwd"), /invalid job_id/);
  assert.throws(() => assertJobId("/workspace/jobs/x"), /invalid job_id/);
  assert.throws(() => assertJobId(""), /invalid job_id/);
});

test("isUnderRoot blocks sibling escape", () => {
  assert.equal(isUnderRoot("/workspace/jobs", "/workspace"), true);
  assert.equal(isUnderRoot("/workspace", "/workspace"), true);
  assert.equal(isUnderRoot("/etc", "/workspace"), false);
  assert.equal(isUnderRoot("/workspace-evil", "/workspace"), false);
});

test("resolveWorkCwd allows extra root and rejects others", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gbw-"));
  try {
    const allowed = resolveWorkCwd(tmp, { GROK_BUILD_CWD_ROOT: tmp });
    assert.equal(allowed, path.resolve(tmp));
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), "gbw-out-"));
    try {
      assert.throws(
        () => resolveWorkCwd(outside, { GROK_BUILD_CWD_ROOT: tmp }),
        /cwd not allowed/
      );
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
