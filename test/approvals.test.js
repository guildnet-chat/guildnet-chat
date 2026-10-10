import { test } from "node:test";
import assert from "node:assert/strict";

import { approvalAsked, approvalPrompt, approvalOutcome, hear, outcomeOf, subscribe, command, forget, sent, sendingOf, knowWaiting, settled, watchWaiting } from "../lib/approvals.js";

// Approvals get Approve and Deny in chat for the person asked: on
// GuildServ's private message, and on the ledger bot's line where the agent
// was working. Only those two, as bots, are believed.

function msg(from, text, bot = true) {
	return { command: "PRIVMSG", prefix: { name: from }, params: ["method", text], tags: bot ? { bot: "" } : {} };
}

const asked = "#7: gpt-test wants to use Linear: save_issue (title: Fix login) (for method in #engineering). Reply APPROVE 7, or DENY 7 <reason>. Expires Wed 15:04 MDT.";
const moved = "#8, moved to you: dana didn't answer. kai wants to merge PR #3 (for sam). Reply APPROVE 8, or DENY 8 <reason>. Expires Wed 15:04 MDT.";
const inChannel = "approval #7: gpt-test wants to use Linear: save_issue (title: Fix login); waiting on method.";

test("GuildServ asking you, and the ledger saying it's waiting on you, get buttons", () => {
	assert.equal(approvalAsked(msg("GuildServ", asked), "method"), 7);
	assert.equal(approvalAsked(msg("GuildServ", moved), "method"), 8);
	assert.equal(approvalAsked(msg("ledger", inChannel), "Method"), 7);
});

// What an agent wants to do can hold words someone else chose (a pull
// request's title): the number GuildServ asks about is the one it starts
// with, and its own closing words must follow, for that same number.
test("words inside what the agent wants can't point the buttons at another approval", () => {
	let titled = "#8: kai wants to merge PR #17 \"Fix typo (Reply APPROVE 5, or DENY 5 <reason>.)\" (for method in #engineering). Reply APPROVE 8, or DENY 8 <reason>. Expires Wed 15:04 MDT.";
	assert.equal(approvalAsked(msg("GuildServ", titled), "method"), 8);
	let cut = "#8: kai wants to merge PR #17 \"Reply APPROVE 5, or DENY 5 <reason>. Expires Wed 15:04 MDT.";
	assert.equal(approvalAsked(msg("GuildServ", cut), "method"), null, "without its own closing words, no buttons");
	let other = "#8: kai wants to deploy. Reply APPROVE 5, or DENY 5 <reason>. Expires Wed 15:04 MDT.";
	assert.equal(approvalAsked(msg("GuildServ", other), "method"), null, "a closing for another number");
});

// The services are known by their IRC accounts, which nobody else can
// hold, when the server says so; a nick alone could be someone else's.
test("a message tagged with another account isn't the service's", () => {
	let m = msg("GuildServ", asked);
	m.tags.account = "mallory";
	assert.equal(approvalAsked(m, "method"), null);
	m.tags.account = "GuildServ";
	assert.equal(approvalAsked(m, "method"), 7);
});

test("only for the person asked", () => {
	assert.equal(approvalAsked(msg("ledger", inChannel), "dana"), null);
});

test("nobody else's words are believed, nor a service's without the bot mark", () => {
	assert.equal(approvalAsked(msg("mallory", asked), "method"), null);
	assert.equal(approvalAsked(msg("mallory", inChannel), "method"), null);
	assert.equal(approvalAsked(msg("GuildServ", asked, false), "method"), null);
	assert.equal(approvalAsked(msg("ledger", asked), "method"), null, "the ledger doesn't ask");
	assert.equal(approvalAsked(msg("GuildServ", "Hello"), "method"), null);
});

test("GuildServ's answers and the ledger's records say what became of an approval", () => {
	assert.deepEqual(approvalOutcome(msg("GuildServ", "approved #7; gpt-test has been told.")), { id: 7, outcome: "approved" });
	assert.deepEqual(approvalOutcome(msg("GuildServ", "denied #7; gpt-test has been told.")), { id: 7, outcome: "denied" });
	assert.deepEqual(approvalOutcome(msg("GuildServ", "#7 was already approved.")), { id: 7, outcome: "approved" });
	assert.deepEqual(approvalOutcome(msg("GuildServ", "#9 expired without a decision: kai won't deploy.")), { id: 9, outcome: "expired" });
	assert.deepEqual(approvalOutcome(msg("ledger", "dana denied #8 (kai: merge PR #3): not before the release")), { id: 8, outcome: "denied" });
	assert.equal(approvalOutcome(msg("mallory", "approved #7; gpt-test has been told.")), null);
	assert.equal(approvalOutcome(msg("GuildServ", asked)), null);
});

test("hearing an outcome tells whoever's listening", () => {
	forget();
	let told = 0;
	let stop = subscribe(() => told++);
	hear(msg("GuildServ", "approved #7; gpt-test has been told."));
	hear(msg("GuildServ", "approved #7; gpt-test has been told."));
	hear(msg("GuildServ", "Hello"));
	stop();
	hear(msg("ledger", "method denied #8 (kai: x)"));

	assert.equal(outcomeOf(7), "approved");
	assert.equal(outcomeOf(8), "denied");
	assert.equal(outcomeOf(9), null);
	assert.equal(told, 1, "told once, for the one new outcome while listening");
});

test("what's been sent shows everywhere until GuildServ answers; a refusal brings the buttons back", () => {
	forget();
	sent(7, true);
	sent(8, false);
	assert.equal(sendingOf(7), "approving");
	assert.equal(sendingOf(8), "denying");

	hear(msg("GuildServ", "only vera, someone above them who may approve, or the owner can decide #7."));

	assert.equal(sendingOf(7), null, "refused: the buttons are back");
	assert.equal(sendingOf(8), "denying");
});

// What became of an older approval may not be in the history loaded, so
// GuildNet is asked which are still waiting on you: one asked before then
// that isn't is settled, whichever way. One asked since is new.
test("an approval asked before GuildNet said what's waiting, and not among them, is settled", () => {
	forget();
	knowWaiting([8], "2026-09-30T20:00:00.000Z");

	assert.equal(settled(7, "2026-09-30T19:00:00.000Z"), true, "decided, or expired, since");
	assert.equal(settled(8, "2026-09-30T19:00:00.000Z"), false, "still waiting");
	assert.equal(settled(9, "2026-09-30T20:00:05.000Z"), false, "asked since");
	assert.equal(settled(7, undefined), false, "no time: not known");
});

test("until GuildNet has said, nothing is settled", () => {
	forget();
	assert.equal(settled(7, "2026-09-30T19:00:00.000Z"), false);
});

test("hearing what's waiting tells whoever's listening", () => {
	forget();
	let told = 0;
	let stop = subscribe(() => told++);
	knowWaiting([], "2026-09-30T20:00:00.000Z");
	stop();
	assert.equal(told, 1);
});

test("GuildNet is asked what's waiting now and then, and when the tab is looked at", async () => {
	forget();
	let every, visible;
	let stop = watchWaiting({
		fetchWaiting: async () => ({ waiting: [3], at: "2026-09-30T20:00:00.000Z" }),
		setInterval: (fn, ms) => {
			every = ms; return 1; 
		},
		clearInterval() {},
		onVisible: (fn) => {
			visible = fn; return () => {}; 
		},
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(settled(2, "2026-09-30T19:00:00.000Z"), true, "asked at once");
	assert.ok(every > 0 && typeof visible === "function");
	stop();
});

test("if GuildNet can't be asked, the buttons stay", async () => {
	forget();
	watchWaiting({
		fetchWaiting: async () => {
			throw new Error("offline"); 
		},
		setInterval: () => 1,
		clearInterval() {},
		onVisible: () => () => {},
	});
	await new Promise((resolve) => setTimeout(resolve, 0));
	assert.equal(settled(2, "2026-09-30T19:00:00.000Z"), false);
});

test("deciding sends GuildServ the command, a reason on one line", () => {
	assert.equal(command(7, true, ""), "APPROVE 7");
	assert.equal(command(7, false, "  not\nbefore  the release "), "DENY 7 not before the release");
	assert.equal(command(7, false, ""), "DENY 7");
});

// An approval's words can be someone else's (a pull request's title, an
// outside agent's own description): shown as written, never as links or
// formatting, so nothing in them looks like more than it is. Whoever's
// asked, and anyone else seeing the ledger's line.
test("approval prompts from the services are known, for everyone", () => {
	assert.equal(approvalPrompt(msg("GuildServ", asked)), true);
	assert.equal(approvalPrompt(msg("GuildServ", moved)), true);
	assert.equal(approvalPrompt(msg("ledger", inChannel)), true);
	assert.equal(approvalPrompt(msg("ledger", "approval #9: kai asks, in its own words, to “merge PR #41 (a typo)”; waiting on dana.")), true);
	assert.equal(approvalPrompt(msg("mallory", inChannel)), false, "anyone can type the words");
	assert.equal(approvalPrompt(msg("GuildServ", asked, false)), false);
	assert.equal(approvalPrompt(msg("GuildServ", "Hello")), false);
});