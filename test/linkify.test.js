import { test } from "node:test";
import assert from "node:assert/strict";

import linkify, { githubLinks, setRepos } from "../lib/linkify.js";

// Which parts of a message become links.

function links(text, channel, repos = {}) {
	setRepos(repos);
	return linkify(text, undefined, channel).filter((c) => typeof c !== "string").map((a) => a.props.href);
}

function linked(text, channel, repos = {}) {
	setRepos(repos);
	return linkify(text, undefined, channel).filter((c) => typeof c !== "string").map((a) => a.props.children);
}

const acme = { "#engineering": ["acme-inc/web"], "#platform": ["acme-inc/web", "acme-inc/docs"] };

test("a pull request links to the channel's repo", () => {
	assert.deepEqual(links("PR #42 is up", "#engineering", acme), ["https://github.com/acme-inc/web/pull/42"]);
	assert.deepEqual(links("pr #42 is up", "#Engineering", acme), ["https://github.com/acme-inc/web/pull/42"]);
	assert.deepEqual(linked("PR #42 is up", "#engineering", acme), ["PR #42"]);
	assert.deepEqual(links("see issue #7", "#engineering", acme), ["https://github.com/acme-inc/web/issues/7"]);
});

test("a channel with several repos links only when the repo is named", () => {
	assert.deepEqual(links("PR #42 is up", "#platform", acme), []);
	assert.deepEqual(links("merges docs PR #3", "#platform", acme), ["https://github.com/acme-inc/docs/pull/3"]);
	assert.deepEqual(linked("merges docs PR #3", "#platform", acme), ["docs PR #3"]);
	assert.deepEqual(links("see web#5 and acme-inc/docs#6", "#platform", acme), [
		"https://github.com/acme-inc/web/issues/5",
		"https://github.com/acme-inc/docs/issues/6",
	]);
	assert.deepEqual(links("see other#5", "#platform", acme), []);
});

test("elsewhere (a private message), a pull request links when you only have one repo", () => {
	assert.deepEqual(links("kai wants to merge PR #17", "GuildServ", { "#engineering": ["acme-inc/web"] }), ["https://github.com/acme-inc/web/pull/17"]);
	assert.deepEqual(links("kai wants to merge PR #17", "GuildServ", acme), []);
});

test("a bare number, or no repos at all, isn't linked", () => {
	assert.deepEqual(links("fixes #7, we're #1", "#engineering", acme), []);
	assert.deepEqual(links("PR #42 is up", "#engineering", {}), []);
});

test("a repo named at the end of a sentence still counts", () => {
	assert.deepEqual(links("that's in docs. PR #3 fixes it", "#platform", acme), ["https://github.com/acme-inc/docs/pull/3"]);
});

// Looking for pull requests takes time in step with a message's length, not
// its square: four times as long a message takes about four times as long,
// on whatever machine (the best of several tries, so a slow moment doesn't
// count). Timed on its own: linkifyjs's own search isn't ours to time.
test("looking for pull requests keeps a very long message quick to search", () => {
	setRepos(acme);
	let text = (n) => "x".repeat(4 * n) + " " + "a/".repeat(n) + " PR #1";
	let best = (t) => {
		let min = Infinity;
		for (let i = 0; i < 5; i++) {
			let start = performance.now();
			githubLinks(t, "#engineering");
			min = Math.min(min, performance.now() - start);
		}
		return min;
	};
	best(text(1000)); // warmed up
	let short = best(text(5000)), long = best(text(20000));
	assert.ok(long < short * 8 + 5, `a message four times as long took ${long}ms, against ${short}ms`);
});

test("a pull request's own address stays one link", () => {
	assert.deepEqual(links("https://github.com/acme-inc/web/pull/42 is up", "#engineering", acme), ["https://github.com/acme-inc/web/pull/42"]);
});

test("channels are links", () => {
	assert.deepEqual(links("see #engineering and #ops-team"), ["irc:///#engineering", "irc:///#ops-team"]);
});

test("a number after # (a pull request, an issue) isn't a channel", () => {
	assert.deepEqual(links("PR #42 is up, fixes #7"), []);
});

test("web addresses are links", () => {
	assert.deepEqual(links("docs at https://guildnet.chat/privacy"), ["https://guildnet.chat/privacy"]);
});
