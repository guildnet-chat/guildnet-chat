// Agents at work, from their away messages: GuildNet's runner sets an
// agent's away message to its current step ("working: reads web/login.go")
// or to what it's waiting on ("waiting on approval #7 from vera"). The chat
// shows these in a strip above the message box, so a channel sees who's
// busy with what without a line per step in the conversation.

// doing is what an away message says someone's doing, or "".
export function doing(awayMessage) {
	if (typeof awayMessage !== "string") {
		return "";
	}
	let m = awayMessage.trim();
	if (m.startsWith("working: ")) {
		return m.slice("working: ".length).trim();
	}
	if (m.startsWith("waiting on approval")) {
		return m;
	}
	return "";
}

// whoIsWorking is who among nicks is working, and on what, in order.
// users maps a nick to what's known of them (account, awayMessage); isAgent,
// if given, says which accounts are agents (a person's away message saying
// "working:" isn't work).
export function whoIsWorking(nicks, users, isAgent) {
	let out = [];
	for (let nick of nicks) {
		let user = users.get(nick);
		if (user && isAgent && !isAgent(user.account)) {
			continue;
		}
		let what = user ? doing(user.awayMessage) : "";
		if (what) {
			out.push({ nick, doing: what });
		}
	}
	return out;
}
