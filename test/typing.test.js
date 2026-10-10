import { test } from "node:test";
import assert from "node:assert/strict";

import { TypingTracker, TypingSender, describeTyping } from "../lib/typing.js";

// Typing indicators (IRCv3 +typing): who's typing where, and when to tell
// others you are.

test("someone typing shows until they stop, send, or go quiet", () => {
	let t = new TypingTracker();
	t.update("#eng", "kai", "active", 0);
	t.update("#eng", "vera", "active", 0);

	assert.deepEqual(t.typing("#ENG", 1000), ["kai", "vera"]);
	t.update("#eng", "vera", "done", 2000);
	assert.deepEqual(t.typing("#eng", 2000), ["kai"]);
	t.sent("#eng", "kai");
	assert.deepEqual(t.typing("#eng", 2000), []);
});

test("typing expires without an update", () => {
	let t = new TypingTracker();
	t.update("#eng", "kai", "active", 0);

	assert.deepEqual(t.typing("#eng", 5999), ["kai"]);
	assert.deepEqual(t.typing("#eng", 6001), []);
});

test("paused counts as not typing", () => {
	let t = new TypingTracker();
	t.update("#eng", "kai", "active", 0);
	t.update("#eng", "kai", "paused", 100);

	assert.deepEqual(t.typing("#eng", 200), []);
});

test("channels are kept apart", () => {
	let t = new TypingTracker();
	t.update("#eng", "kai", "active", 0);

	assert.deepEqual(t.typing("#ops", 0), []);
});

test("while typing, tell others at most every 3 seconds, and say when done", () => {
	let s = new TypingSender();

	assert.equal(s.input("#eng", "h", 0), "active");
	assert.equal(s.input("#eng", "he", 1000), null);
	assert.equal(s.input("#eng", "hel", 3001), "active");
	assert.equal(s.input("#eng", "", 3500), "done");
	assert.equal(s.input("#eng", "", 3600), null, "done is said once");
});

test("sending the message ends typing without another notice", () => {
	let s = new TypingSender();
	s.input("#eng", "hi", 0);
	s.sent("#eng");

	assert.equal(s.input("#eng", "", 10), null);
	assert.equal(s.input("#eng", "n", 20), "active", "a new message starts afresh");
});

test("commands aren't typing", () => {
	let s = new TypingSender();

	assert.equal(s.input("#eng", "/join #ops", 0), null);
});

test("how typing reads", () => {
	assert.equal(describeTyping([]), "");
	assert.equal(describeTyping(["kai"]), "kai is typing…");
	assert.equal(describeTyping(["kai", "vera"]), "kai and vera are typing…");
	assert.equal(describeTyping(["kai", "vera", "pax"]), "kai, vera and pax are typing…");
	assert.equal(describeTyping(["a", "b", "c", "d"]), "Several people are typing…");
});
