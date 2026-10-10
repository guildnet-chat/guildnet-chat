import { test } from "node:test";
import assert from "node:assert/strict";

import { combineMultiline } from "../lib/multiline.js";

// A multiline message (IRCv3 draft/multiline) arrives as a batch of lines;
// people should see it as one message.

function batch(tags = {}) {
	return { name: "b1", type: "draft/multiline", params: ["#engineering"], tags, parent: null };
}

function line(text, tags = {}) {
	return { command: "PRIVMSG", prefix: { name: "kai" }, params: ["#engineering", text], tags: { batch: "b1", ...tags } };
}

test("lines become one message, one line each", () => {
	let msg = combineMultiline(batch(), [line("Here's the fix:"), line("```go"), line("x := 1"), line("```")]);

	assert.equal(msg.command, "PRIVMSG");
	assert.equal(msg.prefix.name, "kai");
	assert.deepEqual(msg.params, ["#engineering", "Here's the fix:\n```go\nx := 1\n```"]);
});

test("a line marked concat continues the one before it", () => {
	let msg = combineMultiline(batch(), [line("a very long "), line("sentence", { "draft/multiline-concat": null }), line("next")]);

	assert.equal(msg.params[1], "a very long sentence\nnext");
});

test("the message keeps the batch's id, time and sender details", () => {
	let msg = combineMultiline(batch({ msgid: "m1", time: "2026-09-26T17:00:00Z", account: "kai" }),
		[line("one", { bot: null }), line("two")]);

	assert.equal(msg.tags.msgid, "m1");
	assert.equal(msg.tags.time, "2026-09-26T17:00:00Z");
	assert.equal(msg.tags.account, "kai");
	assert.ok("bot" in msg.tags, "a bot's message stays marked as a bot's");
	assert.ok(!("batch" in msg.tags), "it's no longer part of the multiline batch");
});

test("a multiline message inside history stays in the history batch", () => {
	let history = { name: "h1", type: "chathistory" };
	let b = batch();
	b.parent = history;

	let msg = combineMultiline(b, [line("one")]);

	assert.equal(msg.batch, history);
	assert.equal(msg.tags.batch, "h1");
});

test("NOTICEs combine too", () => {
	let n = line("a");
	n.command = "NOTICE";

	assert.equal(combineMultiline(batch(), [n, { ...n, params: ["#engineering", "b"] }]).command, "NOTICE");
});
