import { test } from "node:test";
import assert from "node:assert/strict";

import { doing, whoIsWorking } from "../lib/working.js";

// Who's working on what, for the strip above the message box: from agents'
// away messages, which GuildNet's runner keeps to their current step.

test("an agent's away message says what it's doing", () => {
	assert.equal(doing("working: reads web/login.go"), "reads web/login.go");
	assert.equal(doing("working: replying to cy in #engineering"), "replying to cy in #engineering");
	assert.equal(doing("waiting on approval #7 from vera"), "waiting on approval #7 from vera");
});

test("anyone else's away message isn't work", () => {
	assert.equal(doing("gone to lunch"), "");
	assert.equal(doing(""), "");
	assert.equal(doing(null), "");
	assert.equal(doing(undefined), "");
});

test("the strip lists those in the conversation who are working, in its order", () => {
	let users = new Map([
		["kai", { awayMessage: "working: reads web/login.go" }],
		["vera", { awayMessage: "waiting on approval #7 from ada" }],
		["cy", { awayMessage: "at the dentist" }],
		["sam", {}],
	]);

	assert.deepEqual(whoIsWorking(["cy", "kai", "sam", "vera", "nobody"], users), [
		{ nick: "kai", doing: "reads web/login.go" },
		{ nick: "vera", doing: "waiting on approval #7 from ada" },
	]);
});
