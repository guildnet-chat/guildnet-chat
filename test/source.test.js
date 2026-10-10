import { test } from "node:test";
import assert from "node:assert/strict";

import SettingsForm from "../components/settings-form.js";
import { setSource } from "../lib/source.js";

// This chat is AGPL: whoever serves it offers its source to the people using
// it. config.json says where ("source"); the settings link to it. Without
// one there's no link.

function links(vnode) {
	let found = [];
	let walk = (v) => {
		if (!v || typeof v !== "object") {
			return;
		}
		if (Array.isArray(v)) {
			v.forEach(walk);
			return;
		}
		if (v.type === "a") {
			found.push(v);
		}
		walk(v.props && v.props.children);
	};
	walk(vnode);
	return found;
}

function text(v) {
	if (v === null || v === undefined || typeof v === "boolean") {
		return "";
	}
	if (typeof v !== "object") {
		return String(v);
	}
	if (Array.isArray(v)) {
		return v.map(text).join("");
	}
	return text(v.props && v.props.children);
}

function settings() {
	return new SettingsForm({ settings: { secondsInTimestamps: true, bufferEvents: "fold" } }).render();
}

test("the settings link to the source the server names", () => {
	setSource("https://github.com/example/chat/tree/0123456789abcdef");

	let a = links(settings()).find((l) => l.props.href === "https://github.com/example/chat/tree/0123456789abcdef");

	assert.ok(a, "a link to the source");
	assert.match(text(a), /Source/);
	assert.match(text(settings()), /AGPL-3\.0/);
});

test("no source named, no link", () => {
	setSource(undefined);

	assert.deepEqual(links(settings()), []);
	assert.doesNotMatch(text(settings()), /AGPL/);
});

test("only web addresses count as a source", () => {
	for (let bad of ["javascript:alert(1)", "/relative", "ftp://example.com/x", 42, { url: "https://x" }]) {
		setSource(bad);
		assert.deepEqual(links(settings()), [], String(bad));
	}

	setSource("http://example.com/src");
	assert.equal(links(settings()).length, 1);
});
