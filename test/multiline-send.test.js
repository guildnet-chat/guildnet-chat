import { test } from "node:test";
import assert from "node:assert/strict";

import { multilineMessages, parseMultilineCap } from "../lib/multiline.js";

// Sending a message with line breaks: one IRCv3 multiline message where the
// server supports it, within its limits.

const limits = { maxBytes: 4096, maxLines: 100 };

function texts(msgs) {
	return msgs.filter((m) => m.command === "PRIVMSG").map((m) => m.params[1]);
}

test("a message with line breaks goes as one batch", () => {
	let msgs = multilineMessages("#eng", "one\ntwo", limits, {}, () => "b1");

	assert.deepEqual(msgs, [
		{ command: "BATCH", params: ["+b1", "draft/multiline", "#eng"] },
		{ tags: { batch: "b1" }, command: "PRIVMSG", params: ["#eng", "one"] },
		{ tags: { batch: "b1" }, command: "PRIVMSG", params: ["#eng", "two"] },
		{ command: "BATCH", params: ["-b1"] },
	]);
});

test("tags for the whole message, like a reply, go on the batch line", () => {
	let [open] = multilineMessages("#eng", "one\ntwo", limits, { "+draft/reply": "m1" }, () => "b1");

	assert.deepEqual(open.tags, { "+draft/reply": "m1" });
});

test("blank lines between lines are kept", () => {
	assert.deepEqual(texts(multilineMessages("#eng", "one\n\ntwo", limits, {}, () => "b")), ["one", "", "two"]);
});

test("a long line is split between words, marked as carrying on", () => {
	let long = "word ".repeat(120).trim(); // ~600 bytes
	let msgs = multilineMessages("#eng", long, limits, {}, () => "b");
	let lines = msgs.filter((m) => m.command === "PRIVMSG");

	assert.ok(lines.length >= 2);
	assert.equal(lines.map((l) => l.params[1]).join(""), long, "the pieces add back up exactly");
	assert.ok(!("draft/multiline-concat" in lines[0].tags));
	assert.ok(lines.slice(1).every((l) => "draft/multiline-concat" in l.tags));
	assert.ok(lines.every((l) => new TextEncoder().encode(l.params[1]).length <= 400));
	assert.ok(lines.slice(0, -1).every((l) => l.params[1].endsWith(" ")), "split after a space");
});

test("over the server's limits, it goes as several batches", () => {
	let text = Array.from({ length: 5 }, (_, i) => "line " + i).join("\n");
	let n = 0;
	let msgs = multilineMessages("#eng", text, { maxBytes: 4096, maxLines: 2 }, { "+draft/reply": "m1" }, () => "b" + n++);
	let opens = msgs.filter((m) => m.command === "BATCH" && m.params[0].startsWith("+"));

	assert.equal(opens.length, 3);
	assert.deepEqual(texts(msgs), ["line 0", "line 1", "line 2", "line 3", "line 4"]);
	assert.deepEqual(opens[0].tags, { "+draft/reply": "m1" }, "the first batch is the reply");
	assert.ok(!opens[1].tags, "the rest aren't");
});

test("the server's limits are read from its capability", () => {
	assert.deepEqual(parseMultilineCap("max-bytes=4096,max-lines=100"), { maxBytes: 4096, maxLines: 100 });
	assert.deepEqual(parseMultilineCap("max-bytes=512"), { maxBytes: 512, maxLines: 0 });
});
