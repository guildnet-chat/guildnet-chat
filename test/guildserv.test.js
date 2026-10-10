import { test } from "node:test";
import assert from "node:assert/strict";

import { guildServRoute, sendToGuildServ } from "../lib/guildserv.js";

// What's said to GuildServ goes through the console when it says so (its
// config's guildserv.url), as whoever's signed in there: they've shown their
// second step, which plain IRC never asks for, and GuildServ takes changes
// from two-step accounts only that way. Its answers still come over IRC.

test("only what's said to GuildServ goes through the console, and only when it says so", () => {
	let config = { guildserv: { url: "/chat/guildserv" } };
	assert.equal(guildServRoute(config, "GuildServ"), "/chat/guildserv");
	assert.equal(guildServRoute(config, "guildserv"), "/chat/guildserv");
	assert.equal(guildServRoute(config, "#engineering"), null);
	assert.equal(guildServRoute(config, "kai"), null);
	assert.equal(guildServRoute({}, "GuildServ"), null, "a console that doesn't say: over IRC, as before");
	assert.equal(guildServRoute(null, "GuildServ"), null);
});

test("each line is sent as its own command, as the person signed in", async () => {
	let calls = [];
	let fetch = async (url, init) => {
		calls.push({ url, init });
		return { ok: true, status: 204, text: async () => "" };
	};

	await sendToGuildServ("/chat/guildserv", "APPROVE 7\n\nDENY 8 not yet", fetch);

	assert.equal(calls.length, 2);
	assert.equal(calls[0].url, "/chat/guildserv");
	assert.equal(calls[0].init.method, "POST");
	assert.equal(calls[0].init.credentials, "same-origin");
	assert.deepEqual(JSON.parse(calls[0].init.body), { text: "APPROVE 7" });
	assert.deepEqual(JSON.parse(calls[1].init.body), { text: "DENY 8 not yet" });
});

test("a refusal says why", async () => {
	let fetch = async () => ({ ok: false, status: 403, text: async () => "Set up two-step sign-in first, on your account page.\n" });

	await assert.rejects(sendToGuildServ("/chat/guildserv", "FIRE kai", fetch), /Set up two-step sign-in first/);
});
