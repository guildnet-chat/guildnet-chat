import { test } from "node:test";
import assert from "node:assert/strict";

import ApprovalButtons from "../components/approval-buttons.js";
import { hear, forget, knowWaiting } from "../lib/approvals.js";

// Approve and Deny on an approval asking you: Approve decides at once; Deny
// asks for a reason first; once decided, anywhere, they give way to what
// was decided. Their words are drawn by the stylesheet, so copying the
// conversation leaves them out.

function buttons(vnode) {
	let out = [];
	(function walk(v) {
		if (Array.isArray(v)) {
			v.forEach(walk);
		} else if (v && typeof v === "object" && v.props) {
			if (v.type === "button") {
				out.push(v);
			}
			walk(v.props.children);
		}
	})(vnode);
	return out;
}

function label(vnode) {
	return vnode.props["data-label"];
}

test("Approve decides at once", () => {
	forget();
	let decided = [];
	let b = new ApprovalButtons({ id: 7, onDecide: (...args) => decided.push(args) });

	let [approve, deny] = buttons(b.render());

	assert.deepEqual([label(approve), label(deny)], ["Approve #7", "Deny #7"], "the number decided is on the button");
	assert.deepEqual([approve.props.children].flat().filter((c) => c), [], "no words inside to copy");
	approve.props.onClick();
	assert.deepEqual(decided, [[7, true, ""]]);
});

test("Deny asks why first, and sends the reason", () => {
	forget();
	let decided = [];
	let b = new ApprovalButtons({ id: 7, onDecide: (...args) => decided.push(args) });
	b.state = { ...b.state, denying: true, reason: "not before the release" };

	let form = b.render();
	form.props.onSubmit({ preventDefault() {} });

	assert.deepEqual(decided, [[7, false, "not before the release"]]);
});

test("an older approval that's no longer waiting has no buttons", () => {
	forget();
	knowWaiting([8], "2026-09-30T20:00:00.000Z");

	let old = new ApprovalButtons({ id: 7, asked: "2026-09-30T19:00:00.000Z", onDecide() {} }).render();
	let waiting = new ApprovalButtons({ id: 8, asked: "2026-09-30T19:00:00.000Z", onDecide() {} }).render();

	assert.equal(buttons(old).length, 0);
	assert.equal(buttons(waiting).length, 2);
});

test("once decided they show what was decided", () => {
	forget();
	let b = new ApprovalButtons({ id: 7, onDecide() {} });
	hear({ command: "PRIVMSG", prefix: { name: "GuildServ" }, params: ["method", "denied #7; gpt-test has been told."], tags: { bot: "" } });

	let out = b.render();

	assert.equal(buttons(out).length, 0);
	assert.equal(out.props["data-label"], "Denied");
});
