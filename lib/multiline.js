// IRCv3 draft/multiline: a message sent as a batch of lines. combineMultiline
// turns a finished batch back into one message, as if it had been sent in
// one piece, so the rest of gamja needs no changes.

export const MULTILINE_BATCH = "draft/multiline";

/**
 * Combine the lines of a draft/multiline batch into one message. Each line
 * starts a new line of text, unless it's tagged draft/multiline-concat, which
 * continues the line before. The batch's tags (msgid, time, account) are the
 * message's; if the batch was inside another (history), the message stays
 * in that one.
 */
export function combineMultiline(batch, lines) {
	let first = lines[0];
	let text = "";
	lines.forEach((l, i) => {
		let concat = l.tags && Object.prototype.hasOwnProperty.call(l.tags, "draft/multiline-concat");
		if (i > 0 && !concat) {
			text += "\n";
		}
		text += l.params[1] || "";
	});

	let tags = { ...(first.tags || {}), ...(batch.tags || {}) };
	delete tags["batch"];
	delete tags["draft/multiline-concat"];
	if (batch.parent) {
		tags["batch"] = batch.parent.name;
	}

	let msg = {
		tags,
		prefix: first.prefix,
		command: first.command,
		params: [batch.params[0] || first.params[0], text],
	};
	if (batch.parent) {
		msg.batch = batch.parent;
	}
	return msg;
}

// Sending: a message with line breaks goes as one multiline batch, within
// the server's limits (several batches if it's over them). Long lines are
// split between words, the space kept at the end of the piece, and the rest
// marked as carrying on. Tags for the whole message (a reply, say) go on the
// first batch's opening line.

const LINE_BYTES = 400; // room for the tags, prefix and target in a 512-byte IRC line
const encoder = new TextEncoder();

function byteLength(s) {
	return encoder.encode(s).length;
}

// parseMultilineCap reads the server's limits from its draft/multiline
// capability value; 0 means no limit given.
export function parseMultilineCap(value) {
	let limits = { maxBytes: 0, maxLines: 0 };
	for (let kv of (value || "").split(",")) {
		let [k, v] = kv.split("=");
		let n = parseInt(v, 10);
		if (!(n > 0)) {
			continue;
		}
		if (k === "max-bytes") {
			limits.maxBytes = n;
		} else if (k === "max-lines") {
			limits.maxLines = n;
		}
	}
	return limits;
}

// splitLine cuts a line into pieces of at most max bytes, after a space where
// possible, that add back up to the line exactly.
function splitLine(line, max) {
	let pieces = [];
	while (byteLength(line) > max) {
		let chars = Array.from(line);
		let cut = 0, bytes = 0, lastSpace = -1;
		for (let i = 0; i < chars.length; i++) {
			let b = byteLength(chars[i]);
			if (bytes + b > max) {
				break;
			}
			bytes += b;
			cut = i + 1;
			if (chars[i] === " ") {
				lastSpace = i + 1;
			}
		}
		if (lastSpace > 0) {
			cut = lastSpace;
		}
		pieces.push(chars.slice(0, cut).join(""));
		line = chars.slice(cut).join("");
	}
	pieces.push(line);
	return pieces;
}

/**
 * multilineMessages is what to send for text to target: BATCH lines and
 * PRIVMSGs. newRef makes each batch's reference.
 */
export function multilineMessages(target, text, limits, tags, newRef) {
	let pieces = [];
	for (let line of text.split("\n")) {
		splitLine(line, LINE_BYTES).forEach((p, i) => pieces.push({ text: p, concat: i > 0 }));
	}

	let batches = [];
	let cur = [], bytes = 0;
	for (let p of pieces) {
		let add = byteLength(p.text) + (cur.length > 0 && !p.concat ? 1 : 0);
		let full = (limits.maxLines > 0 && cur.length + 1 > limits.maxLines) ||
			(limits.maxBytes > 0 && bytes + add > limits.maxBytes);
		if (cur.length > 0 && full) {
			batches.push(cur);
			cur = [];
			bytes = 0;
			add = byteLength(p.text);
		}
		// A batch can't start by carrying on from another.
		cur.push(cur.length === 0 ? { ...p, concat: false } : p);
		bytes += add;
	}
	if (cur.length > 0) {
		batches.push(cur);
	}

	let msgs = [];
	batches.forEach((batch, i) => {
		let ref = newRef();
		let open = { command: "BATCH", params: ["+" + ref, "draft/multiline", target] };
		if (i === 0 && tags && Object.keys(tags).length > 0) {
			open.tags = tags;
		}
		msgs.push(open);
		for (let p of batch) {
			let lineTags = { batch: ref };
			if (p.concat) {
				lineTags["draft/multiline-concat"] = undefined;
			}
			msgs.push({ tags: lineTags, command: "PRIVMSG", params: [target, p.text] });
		}
		msgs.push({ command: "BATCH", params: ["-" + ref] });
	});
	return msgs;
}
