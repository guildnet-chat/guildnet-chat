import { html } from "../lib/index.js";

// A badge for bots (IRCv3 bot mode): next to their name in messages and in
// the member list. config.json's bots.label is the badge; bots.labels picks
// another by hostname pattern (e.g. {"ai.*": "AI"}), so different kinds of
// bot can be told apart.

let defaultLabel = "Bot";
let byHost = []; // [{re, label}]

function globToRegExp(glob) {
	let escaped = glob.split("*").map((s) => s.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join(".*");
	return new RegExp("^" + escaped + "$", "i");
}

export function setBotLabels(config) {
	defaultLabel = (config && typeof config.label === "string" && config.label) || "Bot";
	byHost = [];
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

// isBotMessage says whether the server marked a message's sender as a bot.
export function isBotMessage(msg) {
	return Boolean(msg.tags) && Object.prototype.hasOwnProperty.call(msg.tags, "bot");
}

// The badge shows its label; copied, it reads "[AI]", the brackets being
// there for a copy but kept out of sight (the stylesheet's .copy-only).
export default function BotBadge(props) {
	let label = botLabelFor(props.host);
	let kind = label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
	return html`<span class="bot-badge bot-badge-${kind}" title="Bot"><span class="copy-only">[</span>${label}<span class="copy-only">]</span></span>`;
}
