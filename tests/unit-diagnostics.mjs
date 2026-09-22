import { it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { appendDiagnostic } from "../src/diagnostics.ts";

it("creates private diagnostic files and appends", () => {
	const root = mkdtempSync(join(tmpdir(), "bridge-log-"));
	try {
		const path = join(root, "logs", "diag.log");
		assert.equal(appendDiagnostic(path, "first\n"), true);
		assert.equal(appendDiagnostic(path, "second\n"), true);
		assert.equal(readFileSync(path, "utf8"), "first\nsecond\n");
		assert.equal(statSync(path).mode & 0o777, 0o600);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

it("does not throw when the diagnostic destination cannot be opened", () => {
	const root = mkdtempSync(join(tmpdir(), "bridge-log-"));
	try {
		const parent = join(root, "not-a-directory");
		writeFileSync(parent, "fixture");
		assert.equal(appendDiagnostic(join(parent, "diag.log"), "detail\n"), false);
		assert.equal(appendDiagnostic(root, "detail\n"), false);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
