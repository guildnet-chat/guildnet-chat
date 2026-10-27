import { test } from "node:test";
import assert from "node:assert/strict";

import BotBadge, { setBotLabels, botLabelFor, isBotMessage, isBotAccount } from "../components/bot-badge.js";

// Bots (IRCv3 bot mode) are badged; config.json can badge some by their
// hostname, like GuildNet's agents (AI) apart from its services (BOT).

test("bots are badged Bot unless told otherwise", () => {
	setBotLabels({});

	assert.equal(botLabelFor("anything.example"), "Bot");
});

test("a hostname pattern picks the label; other bots get the default", () => {
	setBotLabels({ label: "BOT", labels: { "ai.*": "AI", "ai-lead.*": "AI" } });

	assert.equal(botLabelFor("ai.engineering.guildnet"), "AI");
	assert.equal(botLabelFor("ai-lead.engineering.guildnet"), "AI");
	assert.equal(botLabelFor("bot.guildnet"), "BOT");
	assert.equal(botLabelFor("mail.ai.example"), "BOT", "patterns match the whole hostname");
	assert.equal(botLabelFor(undefined), "BOT");
});

// Copied out of the chat, a badge reads "[AI]"; on screen the brackets are
// kept out of sight (copy-only), and the badge is just the word.
test("a badge copies as its label in square brackets", () => {
	setBotLabels({ label: "BOT", labels: { "ai.*": "AI" } });

	let badge = BotBadge({ host: "ai.engineering.guildnet" });
	let parts = [badge.props.children].flat(Infinity);
	let text = (v) => typeof v === "string" ? v : [v.props.children].flat(Infinity).map(text).join("");

	assert.equal(parts.map(text).join(""), "[AI]");
	let brackets = parts.filter((p) => typeof p === "object");
	assert.deepEqual(brackets.map((b) => [b.props.class, text(b)]), [["copy-only", "["], ["copy-only", "]"]]);
});

test("patterns are hostnames with *, nothing more", () => {
	setBotLabels({ label: "BOT", labels: { "a.b": "X" } });

	assert.equal(botLabelFor("aXb"), "BOT", "a dot is a dot");
	assert.equal(botLabelFor("a.b"), "X");
});

// Only the network's own agents and bots are badged, as config.json names
// their accounts: anyone can set bot mode (+B) on themselves, and a person
// named like the ledger mustn't pass for it.
test("a message is a bot's only from an account config.json names", () => {
	setBotLabels({ label: "BOT", accounts: ["kai", "Ledger"] });

	assert.equal(isBotMessage({ tags: { bot: "", account: "kai" } }), true);
	assert.equal(isBotMessage({ tags: { bot: "", account: "ledger" } }), true, "accounts match whatever their case");
	assert.equal(isBotMessage({ tags: { bot: "", account: "iedger" } }), false, "+B on a person's own account");
	assert.equal(isBotMessage({ tags: { bot: "" } }), false, "no account at all");
	assert.equal(isBotMessage({ tags: { account: "kai" } }), false, "not in bot mode");
	assert.equal(isBotAccount("KAI"), true);
	assert.equal(isBotAccount("cy"), false);
});

test("without a list of accounts, bot mode is enough, as before", () => {
	setBotLabels({ label: "BOT" });

	assert.equal(isBotMessage({ tags: { bot: "", account: "anyone" } }), true);
	assert.equal(isBotAccount("anyone"), true);
});
