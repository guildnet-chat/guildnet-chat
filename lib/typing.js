// Typing indicators (IRCv3 +typing on TAGMSG): active while someone types,
// sent at most every 3 seconds; paused or done when they stop. Anyone not
// heard from for 6 seconds is taken to have stopped.

const EXPIRE_MSEC = 6000;
const RESEND_MSEC = 3000;

function key(s) {
	return s.toLowerCase();
}

// TypingTracker keeps who is typing in each conversation.
export class TypingTracker {
	byTarget = new Map(); // target -> Map(nick -> {nick, until})

	update(target, nick, value, now) {
		let people = this.byTarget.get(key(target));
		if (value === "active") {
			if (!people) {
				people = new Map();
				this.byTarget.set(key(target), people);
			}
			people.set(key(nick), { nick, until: now + EXPIRE_MSEC });
		} else if (people) {
			people.delete(key(nick));
		}
	}

	// sent notes that nick sent a message there, which ends their typing.
	sent(target, nick) {
		let people = this.byTarget.get(key(target));
		if (people) {
			people.delete(key(nick));
		}
	}

	typing(target, now) {
		let people = this.byTarget.get(key(target));
		if (!people) {
			return [];
		}
		let out = [];
		for (let [k, p] of people) {
			if (p.until < now) {
				people.delete(k);
			} else {
				out.push(p.nick);
			}
		}
		return out.sort((a, b) => a.localeCompare(b));
	}
}

// TypingSender decides when to tell others you're typing.
export class TypingSender {
	byTarget = new Map(); // target -> time "active" was last sent

	/**
	 * input is called whenever the composer's text changes. It returns the
	 * +typing value to send ("active" or "done"), or null for nothing.
	 */
	input(target, text, now) {
		let last = this.byTarget.get(key(target));
		if (!text || text.startsWith("/")) {
			if (last !== undefined) {
				this.byTarget.delete(key(target));
				return "done";
			}
			return null;
		}
		if (last === undefined || now - last > RESEND_MSEC) {
			this.byTarget.set(key(target), now);
			return "active";
		}
		return null;
	}

	// sent notes the message went: that ends typing, no notice needed.
	sent(target) {
		this.byTarget.delete(key(target));
	}
}

export function describeTyping(nicks) {
	switch (nicks.length) {
	case 0:
		return "";
	case 1:
		return `${nicks[0]} is typing…`;
	case 2:
		return `${nicks[0]} and ${nicks[1]} are typing…`;
	case 3:
		return `${nicks[0]}, ${nicks[1]} and ${nicks[2]} are typing…`;
	default:
		return "Several people are typing…";
	}
}
