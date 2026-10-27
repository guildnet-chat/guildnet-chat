import { html } from "../lib/index.js";

// A badge for bots (IRCv3 bot mode): next to their name in messages and in
// the member list. config.json's bots.label is the badge; bots.labels picks
// another by hostname pattern (e.g. {"ai.*": "AI"}), so different kinds of
// bot can be told apart. bots.accounts, when given, are the only accounts
// that are bots (the network's agents and services): anyone can put
// themselves in bot mode.

let defaultLabel = "Bot";
let byHost = []; // [{re, label}]
let accounts = null; // lowercased; null: bot mode is enough

function globToRegExp(glob) {
	let escaped = glob.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
	return new RegExp("^" + escaped + "$", "i");
}

export function setBotLabels(config) {
	defaultLabel = (config && typeof config.label === "string" && config.label) || "Bot";
	byHost = [];
	accounts = null;
	if (config && Array.isArray(config.accounts)) {
		accounts = new Set(config.accounts.filter((a) => typeof a === "string").map((a) => a.toLowerCase()));
	}
	let labels = config && config.labels;
	if (labels && typeof labels === "object") {
		for (let [glob, label] of Object.entries(labels)) {
			if (typeof label === "string" && label) {
				byHost.push({ re: globToRegExp(glob), label });
			}
		}
	}
}

// botLabelFor is the badge for a bot with this hostname.
export function botLabelFor(host) {
	for (let { re, label } of byHost) {
		if (host && re.test(host)) {
			return label;
		}
	}
	return defaultLabel;
}

// isBotAccount says whether account is one of the network's bots, as
// config.json says (any, without a list).
export function isBotAccount(account) {
	if (accounts === null) {
		return true;
	}
	return typeof account === "string" && accounts.has(account.toLowerCase());
}

// isBotMessage says whether the server marked a message's sender as a bot,
// and it's one of the network's.
export function isBotMessage(msg) {
	return Boolean(msg.tags) && Object.prototype.hasOwnProperty.call(msg.tags, "bot") && isBotAccount(msg.tags.account);
}

// The badge shows its label; copied, it reads "[AI]", the brackets being
// there for a copy but kept out of sight (the stylesheet's .copy-only).
export default function BotBadge(props) {
	let label = botLabelFor(props.host);
	let kind = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	return html`<span class="bot-badge bot-badge-${kind}" title="Bot"><span class="copy-only">[</span>${label}<span class="copy-only">]</span></span>`;
}
