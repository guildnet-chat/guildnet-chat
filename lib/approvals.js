// Approvals in chat. GuildServ asks the approver in a private message
// ("#7: gpt-test wants to … Reply APPROVE 7, or DENY 7 <reason>. …") and
// the ledger bot says so where the agent was working ("approval #7:
// gpt-test wants to …; waiting on method."). The person asked gets Approve
// and Deny on both, which send GuildServ the command; GuildServ's answer
// ("approved #7; …") and the ledger's record in #ops ("method approved #7
// (…)") turn them into the outcome.
//
// Only GuildServ and the ledger bot are believed, and only as bots:
// anyone could type the same words to put buttons on someone's screen.

const services = new Set(["guildserv", "ledger"]);

function fromService(msg, name) {
	if (msg.command !== "PRIVMSG" && msg.command !== "NOTICE") {
		return false;
	}
	let from = (msg.prefix && msg.prefix.name || "").toLowerCase();
	let bot = Boolean(msg.tags) && Object.prototype.hasOwnProperty.call(msg.tags, "bot");
	// The account the server says sent it, when it says: the services'
	// accounts are theirs alone.
	let account = msg.tags && typeof msg.tags.account === "string" ? msg.tags.account.toLowerCase() : from;
	return bot && services.has(from) && account === from && (!name || from === name);
}

// GuildServ's question: the number it starts with, then what the agent
// wants (words that may be someone else's, like a pull request's title),
// then its own closing for that same number.
const asks = /^#(\d+)(?:, moved to you)?: [\s\S]* Reply APPROVE \1, or DENY \1 <reason>\. Expires [^.]*\.$/;

// approvalAsked is the number of the approval msg asks myNick to decide,
// or null.
export function approvalAsked(msg, myNick) {
	let text = msg.params && msg.params[1] || "";
	let m;
	if (fromService(msg, "guildserv") && (m = asks.exec(text))) {
		return Number(m[1]);
	}
	if (fromService(msg, "ledger") && (m = /^approval #(\d+): .*; waiting on (\S+)\.$/.exec(text))) {
		return myNick && m[2].toLowerCase() === myNick.toLowerCase() ? Number(m[1]) : null;
	}
	return null;
}

// approvalPrompt says msg is GuildServ asking about an approval, or the
// ledger saying one's waiting, for whoever's asked. Their words can be
// someone else's (a pull request's title, an outside agent's description),
// so they're shown as written: no links, no formatting.
export function approvalPrompt(msg) {
	let text = msg.params && msg.params[1] || "";
	return (fromService(msg, "guildserv") && asks.test(text)) ||
		(fromService(msg, "ledger") && /^approval #\d+: .*; waiting on \S+\.$/.test(text));
}

// approvalOutcome is what msg says became of an approval, or null.
export function approvalOutcome(msg) {
	let text = msg.params && msg.params[1] || "";
	let m;
	if (fromService(msg, "guildserv")) {
		if ((m = /^(approved|denied) #(\d+);/.exec(text))) {
			return { id: Number(m[2]), outcome: m[1] };
		}
		if ((m = /^#(\d+) was already (approved|denied|expired)\b/.exec(text))) {
			return { id: Number(m[1]), outcome: m[2] };
		}
		if ((m = /^#(\d+) expired without a decision/.exec(text))) {
			return { id: Number(m[1]), outcome: "expired" };
		}
	}
	if (fromService(msg, "ledger") && (m = /^\S+ (approved|denied) #(\d+) \(/.exec(text))) {
		return { id: Number(m[2]), outcome: m[1] };
	}
	return null;
}

// What's become of approvals, as heard, and who's listening.
let outcomes = new Map();
let listeners = new Set();

// hear notes what a message says became of an approval, if anything.
export function hear(msg) {
	let o = approvalOutcome(msg);
	if (o && outcomes.get(o.id) !== o.outcome) {
		outcomes.set(o.id, o.outcome);
		listeners.forEach((fn) => fn());
		return;
	}
	// Anything else GuildServ says about one being decided here is a refusal
	// ("only vera ... can decide #7"): the buttons come back.
	let m = !o && fromService(msg, "guildserv") && /#(\d+)\b/.exec(msg.params && msg.params[1] || "");
	if (m && sending.delete(Number(m[1]))) {
		listeners.forEach((fn) => fn());
	}
}

export function outcomeOf(id) {
	return outcomes.get(id) || null;
}

// What's been sent and not yet answered, by approval: "approving" or
// "denying", so every message about it shows the same.
let sending = new Map();

export function sent(id, allow) {
	sending.set(id, allow ? "approving" : "denying");
	listeners.forEach((fn) => fn());
}

export function sendingOf(id) {
	return sending.get(id) || null;
}

// subscribe calls fn whenever an outcome is heard; it returns the way to
// stop.
export function subscribe(fn) {
	listeners.add(fn);
	return () => listeners.delete(fn);
}

// What became of an older approval may not be in the history loaded, so
// GuildNet is asked which approvals are still waiting on you (./approvals:
// their numbers, and when that was so). One asked before then that isn't
// among them has been settled, one way or another.
let waiting = null; // { ids: Set, at: Date }

// knowWaiting notes the approvals waiting on you as of at.
export function knowWaiting(ids, at) {
	let when = new Date(at);
	if (!Array.isArray(ids) || isNaN(when)) {
		return;
	}
	waiting = { ids: new Set(ids.map(Number)), at: when };
	listeners.forEach((fn) => fn());
}

// settled says whether approval id, asked at asked (a message's time), is
// known to be no longer waiting.
export function settled(id, asked) {
	let when = new Date(asked);
	return Boolean(waiting) && Boolean(asked) && !isNaN(when) && when <= waiting.at && !waiting.ids.has(id);
}

// waitingNow asks GuildNet which approvals are waiting on you.
export async function waitingNow() {
	let resp = await fetch("approvals", { cache: "no-store", credentials: "same-origin" });
	if (!resp.ok) {
		throw new Error("GuildNet didn't say which approvals are waiting: " + resp.status);
	}
	return resp.json();
}

function whenVisible(fn) {
	let handler = () => {
		if (document.visibilityState === "visible") {
			fn();
		}
	};
	document.addEventListener("visibilitychange", handler);
	return () => document.removeEventListener("visibilitychange", handler);
}

// watchWaiting asks GuildNet which approvals are waiting now, then every
// few minutes and whenever the tab is looked at again. It returns the way
// to stop.
export function watchWaiting({
	fetchWaiting = waitingNow,
	every = 5 * 60 * 1000,
	setInterval = globalThis.setInterval,
	clearInterval = globalThis.clearInterval,
	onVisible = whenVisible,
} = {}) {
	let check = async () => {
		try {
			let data = await fetchWaiting();
			if (data) {
				knowWaiting(data.waiting, data.at);
			}
		} catch {
			// Not reachable now: the buttons stay, and it's asked again later.
		}
	};
	check();
	let timer = setInterval(check, every);
	let stopVisible = onVisible(check);
	return () => {
		clearInterval(timer);
		stopVisible();
	};
}

// command is what GuildServ is sent to decide an approval.
export function command(id, allow, reason) {
	reason = (reason || "").replace(/\s+/g, " ").trim();
	return (allow ? "APPROVE " : "DENY ") + id + (reason ? " " + reason : "");
}

// forget clears what's been heard (tests).
export function forget() {
	outcomes = new Map();
	sending = new Map();
	waiting = null;
}
