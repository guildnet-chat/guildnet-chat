import { test } from "node:test";
import assert from "node:assert/strict";

import { repliesTo, replyTags, snippet, findMessage } from "../lib/reply.js";

// Replies (IRCv3 +draft/reply): a message can answer an earlier one, named
// by its msgid.

test("a reply names the message it answers", () => {
	assert.equal(repliesTo({ tags: { "+draft/reply": "m1" } }), "m1");
	assert.equal(repliesTo({ tags: {} }), null);
	assert.equal(repliesTo({}), null);
});

test("replying tags the new message with the original's id", () => {
	assert.deepEqual(replyTags({ tags: { msgid: "m1" } }), { "+draft/reply": "m1" });
	assert.deepEqual(replyTags(null), {});
	assert.deepEqual(replyTags({ tags: {} }), {}, "a message without an id can't be replied to");
});

test("the original is found among the conversation's messages", () => {
	let msgs = [{ tags: { msgid: "a" } }, { tags: { msgid: "b" } }, { tags: {} }];

	assert.equal(findMessage(msgs, "b"), msgs[1]);
	assert.equal(findMessage(msgs, "zzz"), null);
});

test("a snippet is the start of the first line", () => {
	assert.equal(snippet("short"), "short");
	assert.equal(snippet("first line\nsecond"), "first line…");
	assert.equal(snippet("x".repeat(100)), "x".repeat(80) + "…");
	assert.equal(snippet("```go\ncode\n```"), "code…", "a code fence isn't worth showing");
	assert.equal(snippet("\x01ACTION waves\x01"), "waves");
	assert.equal(snippet("the **retry timer** races with `Stop()`, ~~not~~ _really_"), "the retry timer races with Stop(), not really", "markdown is shown as plain words");
	assert.equal(snippet("snake_case_name stays"), "snake_case_name stays");
});
