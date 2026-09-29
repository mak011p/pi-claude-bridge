import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as piAi from "@earendil-works/pi-ai";
import { projectProviderContext } from "../src/provider-context.js";

const user = { role: "user", content: "fixture", timestamp: 1 };
const read = { name: "read", description: "fixture", parameters: { type: "object", properties: {} } };

describe("provider context projection", () => {
	it("keeps legacy contexts and message identities unchanged", () => {
		const context = { systemPrompt: "contract", tools: [read], messages: [user] };
		assert.equal(projectProviderContext(context), context);
		assert.equal(projectProviderContext(context).messages[0], user);
	});

	it("never silently drops a system-message transcript on an older runtime", () => {
		const context = { messages: [{ role: "system", content: "contract", toolsAdded: [read], timestamp: 0 }, user] };
		if (typeof piAi.getCurrentTools !== "function") {
			assert.throws(() => projectProviderContext(context), /system-message helpers are unavailable/);
			return;
		}
		const before = JSON.stringify(context);
		const projected = projectProviderContext(context);
		assert.equal(projected.systemPrompt, "contract");
		assert.deepEqual(projected.tools, [read]);
		assert.deepEqual(projected.messages, [user]);
		assert.equal(projected.messages[0], user);
		assert.equal(JSON.stringify(context), before);
	});

	it("replays prompt and tool deltas without retaining system entries in session cursors",
		{ skip: typeof piAi.normalizeContext !== "function" }, () => {
			const context = piAi.normalizeContext({ messages: [
				{ role: "system", content: "", sections: { rules: "old", retired: "drop" }, toolsAdded: [read], timestamp: 0 },
				{ role: "system", content: "", sections: { rules: "new", retired: null }, toolsRemoved: [{ name: "read" }], timestamp: 1 },
				user,
			] });
			const projected = projectProviderContext(context);
			assert.equal(projected.systemPrompt, "new");
			assert.deepEqual(projected.tools, []);
			assert.deepEqual(projected.messages, [user]);
		});
});
