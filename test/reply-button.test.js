import { test } from "node:test";
import assert from "node:assert/strict";

import ReplyButton from "../components/reply-button.js";

// The Reply button sits on every message, so its word must not come along
// when someone copies the conversation: it's drawn by the stylesheet (from
// data-label), which a copy leaves out, and named for screen readers.

test("the Reply button has no text of its own to copy", () => {
	let clicked = 0;
	let button = ReplyButton({ onClick: () => clicked++ });

	assert.equal(button.type, "button");
	assert.deepEqual([button.props.children].flat().filter((c) => c !== undefined && c !== null && c !== ""), [], "no text inside the button");
	assert.equal(button.props["data-label"], "Reply", "the stylesheet draws the word");
	assert.equal(button.props["aria-label"], "Reply");

	button.props.onClick();
	assert.equal(clicked, 1);
});
