/**
 * Rate-limit notices must say WHEN the window reopens, not only that it is
 * closing. `resetsAt` is a Unix timestamp on every SDKRateLimitInfo status, so
 * the warning has the same date available as the rejection; rendering only a
 * percentage leaves the reader with the one number they cannot act on.
 */
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { QueryContext } from "../src/query-state.js";

const { __test } = await import("../src/index.js");

const fakeModel = { api: "anthropic-messages", provider: "anthropic", id: "claude-fable-5-1" };

let notices = [];

beforeEach(() => {
	notices = [];
	__test.setPiUI({ notify: (text, level) => notices.push({ text, level }) });
});

/** Drive consumeQuery over a fixed list of SDK messages. */
async function feed(...messages) {
	const queryCtx = new QueryContext();
	queryCtx.resetTurnState(fakeModel);
	async function* sdkQuery() {
		for (const message of messages) yield message;
	}
	await __test.consumeQuery(sdkQuery(), new Map(), fakeModel, () => false, queryCtx);
	return queryCtx;
}

function rateLimit(rate_limit_info) {
	return { type: "rate_limit_event", rate_limit_info };
}

// A fixed instant so the relative distance is deterministic.
const RESET = Math.floor(Date.now() / 1000) + 3 * 86400 + 3600;

describe("rate limit warning notice", () => {
	it("names the percentage, the model and when the window reopens", async () => {
		await feed(rateLimit({
			status: "allowed_warning",
			utilization: 0.52,
			rateLimitType: "seven_day_opus",
			surpassedThreshold: 50,
			resetsAt: RESET,
		}));

		assert.equal(notices.length, 1);
		const { text, level } = notices[0];
		assert.equal(level, "warning");
		assert.match(text, /52% used/);
		assert.match(text, /seven_day_opus/);
		assert.match(text, /on claude-fable-5-1/, "a per-model bucket must not read as the whole account");
		assert.match(text, /resets /, "the warning must say when the window reopens");
		assert.match(text, /in 3d/, "a relative distance, so a weekly window is distinguishable from tonight");
	});

	it("still warns when the reset is missing rather than dropping the notice", async () => {
		await feed(rateLimit({ status: "allowed_warning", utilization: 0.77, surpassedThreshold: 75 }));

		assert.equal(notices.length, 1);
		assert.match(notices[0].text, /77% used/);
		assert.match(notices[0].text, /resets unknown/);
	});

	it("does not re-notify inside the same 5% step", async () => {
		await feed(
			rateLimit({ status: "allowed_warning", utilization: 0.52, surpassedThreshold: 50, resetsAt: RESET }),
			rateLimit({ status: "allowed_warning", utilization: 0.53, surpassedThreshold: 50, resetsAt: RESET }),
		);

		assert.equal(notices.length, 1, "one event per request would otherwise notify every turn");
	});

	it("re-arms after the window resets", async () => {
		await feed(
			rateLimit({ status: "allowed_warning", utilization: 0.82, surpassedThreshold: 80, resetsAt: RESET }),
			rateLimit({ status: "allowed" }),
			rateLimit({ status: "allowed_warning", utilization: 0.52, surpassedThreshold: 50, resetsAt: RESET }),
		);

		assert.equal(notices.length, 2);
		assert.match(notices[1].text, /52% used/);
	});

	it("rejection still reports the reset, the model and the overage reason", async () => {
		await feed(rateLimit({
			status: "rejected",
			rateLimitType: "seven_day_overage_included",
			resetsAt: RESET,
			overageStatus: "rejected",
			overageDisabledReason: "out_of_credits",
		}));

		assert.equal(notices.length, 1);
		const { text } = notices[0];
		assert.match(text, /Claude rate limited on claude-fable-5-1/);
		assert.match(text, /seven_day_overage_included/);
		assert.match(text, /in 3d/);
		assert.match(text, /out_of_credits/);
	});
});
