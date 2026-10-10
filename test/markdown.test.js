import { test } from "node:test";
import assert from "node:assert/strict";

import { parseMarkdown } from "../lib/markdown.js";

// Messages are shown with the markdown people (and agents) write in chat:
// bold, italics, strikethrough, code, code blocks and quotes. Anything that
// isn't clearly markdown is left exactly as it was typed.

const text = (t) => ({ type: "text", text: t });

test("plain text is left alone", () => {
	assert.deepEqual(parseMarkdown("hello there"), [text("hello there")]);
});

test("bold, italic and strikethrough", () => {
	assert.deepEqual(parseMarkdown("a **big** deal"), [text("a "), { type: "bold", children: [text("big")] }, text(" deal")]);
	assert.deepEqual(parseMarkdown("*really*"), [{ type: "italic", children: [text("really")] }]);
	assert.deepEqual(parseMarkdown("_really_"), [{ type: "italic", children: [text("really")] }]);
	assert.deepEqual(parseMarkdown("~~old~~ new"), [{ type: "strike", children: [text("old")] }, text(" new")]);
});

test("formatting nests", () => {
	assert.deepEqual(parseMarkdown("**bold and *italic***"), [
		{ type: "bold", children: [text("bold and "), { type: "italic", children: [text("italic")] }] },
	]);
});

test("things that only look like markdown stay as typed", () => {
	for (let s of ["snake_case_name and other_one", "some_thing_ else", "2 * 3 * 4", "a ** b", "*nope", "file_name.go", "~~", "**"]) {
		assert.deepEqual(parseMarkdown(s), [text(s)], s);
	}
});

test("inline code is literal", () => {
	assert.deepEqual(parseMarkdown("run `go test **all**` now"), [
		text("run "), { type: "code", text: "go test **all**" }, text(" now"),
	]);
});

test("code blocks keep their language and text exactly", () => {
	assert.deepEqual(parseMarkdown("Here:\n```go\nfunc main() {\n\t_ = **x**\n}\n```\nDone."), [
		text("Here:\n"),
		{ type: "codeblock", lang: "go", text: "func main() {\n\t_ = **x**\n}" },
		text("Done."),
	]);
	assert.deepEqual(parseMarkdown("```\nplain\n```"), [{ type: "codeblock", lang: "", text: "plain" }]);
});

test("an unfinished code block is left as typed", () => {
	assert.deepEqual(parseMarkdown("```go\nx := 1"), [text("```go\nx := 1")]);
});

test("quotes", () => {
	assert.deepEqual(parseMarkdown("> first\n> **second**\nreply"), [
		{ type: "quote", children: [text("first\n"), { type: "bold", children: [text("second")] }] },
		text("\nreply"),
	]);
});

test("HTML is just text", () => {
	assert.deepEqual(parseMarkdown("<b>hi</b> <script>x</script>"), [text("<b>hi</b> <script>x</script>")]);
});
