import { test } from "node:test";
import assert from "node:assert/strict";

import { openOn } from "../lib/landing.js";

// Chat opens on a conversation, not the server's own tab of raw IRC lines:
// the channel last open, else #general, else the first channel joined. It
// only moves someone who landed on the server tab without choosing it.

let channels = ["#announcements", "#engineering", "#general", "#ops"];

test("it opens on the channel that was last open", () => {
	assert.equal(openOn({ onServerTab: true, channels, last: "#ops" }), "#ops");
});

test("the last channel matches whatever its case", () => {
	assert.equal(openOn({ onServerTab: true, channels, last: "#Engineering" }), "#engineering");
	assert.equal(openOn({ onServerTab: true, channels: ["#General"], last: null }), "#General");
});

test("without a last channel still joined, it opens on #general", () => {
	assert.equal(openOn({ onServerTab: true, channels, last: null }), "#general");
	assert.equal(openOn({ onServerTab: true, channels, last: "#left-long-ago" }), "#general");
});

test("without #general, it opens on the first channel joined", () => {
	assert.equal(openOn({ onServerTab: true, channels: ["#ops", "#sales"], last: null }), "#ops");
});

test("with no channel joined, it stays where it is", () => {
	assert.equal(openOn({ onServerTab: true, channels: [], last: "#general" }), null);
});

test("someone who chose the server tab is left on it", () => {
	assert.equal(openOn({ onServerTab: true, chosen: true, channels, last: "#ops" }), null);
});

test("someone already in a conversation is left in it", () => {
	assert.equal(openOn({ onServerTab: false, channels, last: "#ops" }), null);
});
