import { test } from "node:test";
import assert from "node:assert/strict";

import { watchForUpdate } from "../lib/update.js";

// Chat left open since before a deploy is an older GuildNet. It knows the
// version it was loaded as (its page says), asks now and then which is
// current, and says so, once, when they differ.

function rig({ loaded = "aaaa", current = "aaaa", fail = false } = {}) {
	let r = { asked: 0, newer: 0, current, fail, ticks: [], visible: [] };
	r.stop = watchForUpdate({
		loaded,
		fetchVersion: async () => {
			r.asked++;
			if (r.fail) {
				throw new Error("offline");
			}
			return r.current;
		},
		onNewer: () => {
			r.newer++; 
		},
		every: 1000,
		setInterval: (fn) => {
			r.ticks.push(fn); return r.ticks.length; 
		},
		clearInterval: () => {
			r.ticks = []; 
		},
		onVisible: (fn) => {
			r.visible.push(fn); return () => {
				r.visible = []; 
			}; 
		},
	});
	r.tick = async () => {
		for (let fn of r.ticks) {
			await fn();
		} 
	};
	r.show = async () => {
		for (let fn of r.visible) {
			await fn();
		} 
	};
	return r;
}

test("nothing is said while it's current", async () => {
	let r = rig();
	await r.tick();
	await r.show();
	assert.equal(r.asked, 2);
	assert.equal(r.newer, 0);
});

test("a newer version is said, once", async () => {
	let r = rig();
	r.current = "bbbb";
	await r.tick();
	await r.tick();
	await r.show();
	assert.equal(r.newer, 1);
});

test("coming back to the tab asks straight away", async () => {
	let r = rig();
	r.current = "bbbb";
	await r.show();
	assert.equal(r.newer, 1);
});

test("not reaching GuildNet, or a strange answer, isn't an update", async () => {
	let r = rig({ fail: true });
	await r.tick();
	r.fail = false;
	r.current = null;
	await r.tick();
	r.current = "";
	await r.tick();
	assert.equal(r.newer, 0);
});

test("without its own version (not served by GuildNet), it never asks", async () => {
	let r = rig({ loaded: null });
	await r.tick();
	await r.show();
	assert.equal(r.asked, 0);
	assert.equal(r.ticks.length, 0);
});

test("stopping stops the asking", async () => {
	let r = rig();
	r.stop();
	assert.equal(r.ticks.length, 0);
	assert.equal(r.visible.length, 0);
});
