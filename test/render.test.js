import { test } from "node:test";
import assert from "node:assert/strict";

import { renderMarkdown } from "../components/markdown.js";

// How a message's markdown is drawn: real elements, links found only in
// ordinary text, and code shown exactly as written.

function tags(vnodes) {
	return vnodes.flat(Infinity).filter((v) => v && typeof v === "object").map((v) => v.type);
}

test("formatting becomes the matching elements", () => {
	let out = renderMarkdown("**a** *b* ~~c~~ `d`", (t) => t);

	assert.deepEqual(tags(out), ["strong", "em", "del", "code"]);
});

test("a code block is preformatted, with its language noted", () => {
	let [pre] = renderMarkdown("```go\nx := 1\n```", (t) => t);

	assert.equal(pre.type, "pre");
	assert.equal(pre.props["data-lang"], "go");
});

test("only ordinary text is searched for links", () => {
	let seen = [];
	renderMarkdown("see https://a.example `https://b.example`\n```\nhttps://c.example\n```", (t) => {
		seen.push(t);
		return t;
	});

	assert.ok(seen.join("").includes("https://a.example"));
	assert.ok(!seen.join("").includes("b.example") && !seen.join("").includes("c.example"), "code isn't linkified");
});
