// Replies (IRCv3 +draft/reply): a message answering an earlier one carries
// the earlier one's msgid.

import { parseMarkdown } from "./markdown.js";

const REPLY_TAG = "+draft/reply";
const SNIPPET_LEN = 80;

// repliesTo is the msgid a message answers, or null.
export function repliesTo(msg) {
	return (msg && msg.tags && msg.tags[REPLY_TAG]) || null;
}

// replyTags are the tags for a message answering original.
export function replyTags(original) {
	let id = original && original.tags && original.tags.msgid;
	return id ? { [REPLY_TAG]: id } : {};
}

export function findMessage(messages, msgid) {
	if (!messages || !msgid) {
		return null;
	}
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i].tags && messages[i].tags.msgid === msgid) {
			return messages[i];
		}
	}
	return null;
}

// snippet is how an original is shown above a reply: its first worthwhile
// line, cut short.
export function snippet(text) {
	let s = text || "";
	const CTCP = "\u0001";
	if (s.startsWith(CTCP + "ACTION ")) {
		s = s.slice(CTCP.length + "ACTION ".length);
		if (s.endsWith(CTCP)) {
			s = s.slice(0, -CTCP.length);
		}
	}
	let lines = s.split("\n").filter((l) => l.trim() && !l.trim().startsWith("```"));
	let first = plainText(parseMarkdown(lines[0] || ""));
	let more = lines.length > 1 || s.split("\n").length > 1 && first !== s;
	if (first.length > SNIPPET_LEN) {
		return first.slice(0, SNIPPET_LEN) + "…";
	}
	return more ? first + "…" : first;
}

// plainText is markdown's words without its markers.
function plainText(nodes) {
	return nodes.map((n) => n.children ? plainText(n.children) : n.text).join("");
}