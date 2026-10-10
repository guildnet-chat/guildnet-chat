// A small markdown reader for chat messages, in the spirit of Discord and
// Slack: bold, italics, strikethrough, inline code, code blocks and quotes.
// It returns a tree of plain objects, never HTML, so rendering it can't
// inject anything. Text that only looks like markdown (snake_case, 2 * 3)
// is left exactly as typed.
//
// Nodes: {type: "text", text}, {type: "code", text},
// {type: "codeblock", lang, text}, and {type: "bold"|"italic"|"strike"|
// "quote", children}.

const FENCE = /(^|\n)```([^\n`]*)\n([\s\S]*?)\n```(?=\n|$)/;

export function parseMarkdown(src) {
	let out = [];
	let rest = src;
	for (;;) {
		let m = FENCE.exec(rest);
		if (!m) {
			break;
		}
		let start = m.index + m[1].length;
		let before = rest.slice(0, start);
		if (before) {
			out.push(...parseLines(before));
		}
		out.push({ type: "codeblock", lang: m[2].trim(), text: m[3] });
		rest = rest.slice(m.index + m[0].length);
		if (rest.startsWith("\n")) {
			rest = rest.slice(1);
		}
	}
	if (rest) {
		out.push(...parseLines(rest));
	}
	return merge(out);
}

// parseLines reads quotes (lines starting "> "), and inline markdown in
// everything.
function parseLines(src) {
	let lines = src.split("\n");
	let runs = [];
	for (let l of lines) {
		let quoted = l.startsWith("> ") || l === ">";
		let last = runs[runs.length - 1];
		if (last && last.quoted === quoted) {
			last.lines.push(quoted ? l.slice(2) : l);
		} else {
			runs.push({ quoted, lines: [quoted ? l.slice(2) : l] });
		}
	}
	if (!runs.some((r) => r.quoted)) {
		return parseInline(src);
	}
	let out = [];
	runs.forEach((r, i) => {
		let text = r.lines.join("\n");
		if (r.quoted) {
			out.push({ type: "quote", children: merge(parseInline(text)) });
			return;
		}
		// The line break between a quote and the text beside it stays with
		// the text.
		if (i > 0) {
			text = "\n" + text;
		}
		if (i < runs.length - 1) {
			text += "\n";
		}
		if (text) {
			out.push(...parseInline(text));
		}
	});
	return out;
}

const PAIRS = [
	{ delim: "**", type: "bold" },
	{ delim: "~~", type: "strike" },
	{ delim: "*", type: "italic" },
	{ delim: "_", type: "italic", wordBoundary: true },
];

function isWordChar(c) {
	return c !== undefined && /[\p{L}\p{N}]/u.test(c);
}

function parseInline(s) {
	let out = [];
	let buf = "";
	let flush = () => {
		if (buf) {
			out.push({ type: "text", text: buf });
			buf = "";
		}
	};
	let i = 0;
	outer:
	while (i < s.length) {
		if (s[i] === "`") {
			let j = s.indexOf("`", i + 1);
			if (j > i + 1 && !s.slice(i + 1, j).includes("\n")) {
				flush();
				out.push({ type: "code", text: s.slice(i + 1, j) });
				i = j + 1;
				continue;
			}
		}
		for (let p of PAIRS) {
			let span = matchPair(s, i, p);
			if (span) {
				flush();
				out.push({ type: p.type, children: merge(parseInline(span.inner)) });
				i = span.end;
				continue outer;
			}
		}
		buf += s[i];
		i++;
	}
	flush();
	return out;
}

// matchPair finds text wrapped in p.delim starting at i: the inner text
// can't start or end with a space, and _ only counts at word boundaries.
function matchPair(s, i, p) {
	let d = p.delim;
	if (!s.startsWith(d, i)) {
		return null;
	}
	if (d.length === 1 && s[i + 1] === d) {
		return null; // "**" is bold, not two italics
	}
	if (p.wordBoundary && isWordChar(s[i - 1])) {
		return null;
	}
	let from = i + d.length;
	let j = s.indexOf(d, from);
	while (j >= 0) {
		// In a run like "***", the closing delimiter is the last of it.
		while (s.startsWith(d, j + 1) && s[j + d.length] === d[0]) {
			j++;
		}
		let inner = s.slice(from, j);
		let ok = inner.length > 0 && !/^\s/.test(inner) && !/\s$/.test(inner) && !inner.includes("\n\n");
		if (ok && p.wordBoundary && isWordChar(s[j + d.length])) {
			ok = false;
		}
		if (ok) {
			return { inner, end: j + d.length };
		}
		j = s.indexOf(d, j + d.length);
	}
	return null;
}

// merge joins neighbouring text nodes.
function merge(nodes) {
	let out = [];
	for (let n of nodes) {
		let last = out[out.length - 1];
		if (n.type === "text" && last && last.type === "text") {
			last.text += n.text;
		} else {
			out.push(n);
		}
	}
	return out;
}
