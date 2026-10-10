import { test } from "node:test";
import assert from "node:assert/strict";

import { watchDock, hideDock } from "../lib/dock.js";

// Docked beside GuildNet's console, the chat can be hidden from its own
// header. The console framing it says whether it can be, and is asked to
// hide it; nobody else is listened to or told.

const origin = "https://acme.guildnet.chat";

function frame({ embedded = true } = {}) {
	let win = { location: { origin }, listeners: [], posted: [] };
	win.parent = embedded ? { postMessage: (data, to) => win.posted.push({ data, to }) } : win;
	win.addEventListener = (type, fn) => {
		if (type === "message") {
			win.listeners.push(fn);
		}
	};
	win.removeEventListener = (type, fn) => {
		win.listeners = win.listeners.filter((l) => l !== fn);
	};
	win.receive = (data, from = {}) => {
		let event = { data, origin: from.origin || origin, source: "source" in from ? from.source : win.parent };
		for (let fn of win.listeners) {
			fn(event);
		}
	};
	return win;
}

function watch(win) {
	let said = [];
	let stop = watchDock({ win, onChange: (hideable) => said.push(hideable) });
	return { said, stop };
}

test("the console says whether the chat can be hidden", () => {
	let win = frame();
	let { said } = watch(win);
	win.receive({ type: "guildnet-dock", hideable: true });
	win.receive({ type: "guildnet-dock", hideable: false });
	assert.deepEqual(said, [true, false]);
});

test("only a plain yes makes it hideable", () => {
	let win = frame();
	let { said } = watch(win);
	win.receive({ type: "guildnet-dock", hideable: "yes" });
	win.receive({ type: "guildnet-dock" });
	assert.deepEqual(said, [false, false]);
});

test("other sites, other windows and other messages aren't listened to", () => {
	let win = frame();
	let { said } = watch(win);
	win.receive({ type: "guildnet-dock", hideable: true }, { origin: "https://evil.example" });
	win.receive({ type: "guildnet-dock", hideable: true }, { source: {} });
	win.receive({ type: "something-else", hideable: true });
	win.receive("guildnet-dock");
	win.receive(null);
	assert.deepEqual(said, []);
});

test("not framed by the console, it never listens", () => {
	let win = frame({ embedded: false });
	let { said } = watch(win);
	assert.equal(win.listeners.length, 0);
	win.receive({ type: "guildnet-dock", hideable: true }, { source: win });
	assert.deepEqual(said, []);
});

test("stopping stops the listening", () => {
	let win = frame();
	let { said, stop } = watch(win);
	stop();
	win.receive({ type: "guildnet-dock", hideable: true });
	assert.deepEqual(said, []);
});

test("Hide asks the console, on this site only, to hide the chat", () => {
	let win = frame();
	hideDock(win);
	assert.deepEqual(win.posted, [{ data: { type: "guildnet-chat-hide" }, to: origin }]);
});

test("not framed, Hide tells nobody", () => {
	let win = frame({ embedded: false });
	hideDock(win);
	assert.deepEqual(win.posted, []);
});
