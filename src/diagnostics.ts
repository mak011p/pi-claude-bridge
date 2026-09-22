import { appendFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function appendDiagnostic(path: string, line: string): boolean {
	try {
		mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
		appendFileSync(path, line, { mode: 0o600 });
		return true;
	} catch {
		// Diagnostics must never replace the error they were meant to explain.
		return false;
	}
}
