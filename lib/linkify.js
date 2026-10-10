import { linkifyjs, html } from "./index.js";

linkifyjs.options.defaults.defaultProtocol = "https";

linkifyjs.registerCustomProtocol("irc");
linkifyjs.registerCustomProtocol("ircs");
linkifyjs.registerCustomProtocol("geo", true);

const IRCChannelToken = linkifyjs.createTokenClass("ircChannel", {
	isLink: true,
	toHref() {
		return "irc:///" + this.v;
	},
});

linkifyjs.registerPlugin("ircChannel", ({ scanner, parser }) => {
	const { POUND, UNDERSCORE, DOT, HYPHEN } = scanner.tokens;
	const { alphanumeric } = scanner.tokens.groups;

	const Prefix = parser.start.tt(POUND);
	const Channel = new linkifyjs.State(IRCChannelToken);
	const Divider = Channel.tt(DOT);

	Prefix.ta(alphanumeric, Channel);
	Prefix.tt(POUND, Channel);
	Prefix.tt(UNDERSCORE, Channel);
	Prefix.tt(DOT, Divider);
	Prefix.tt(HYPHEN, Channel);
	Channel.ta(alphanumeric, Channel);
	Channel.tt(POUND, Channel);
	Channel.tt(UNDERSCORE, Channel);
	Channel.tt(HYPHEN, Channel);
	Divider.ta(alphanumeric, Channel);
});

// Pull requests and issues link to GitHub: config.json's repos are each
// channel's repos ("owner/repo"), so "PR #42" in a channel with one repo
// links there, and "docs PR #3", "docs#3" or "acme/docs#3" link to a repo
// named anywhere. Elsewhere (a private message), "PR #42" links when there's
// only one repo in all.
let reposByChannel = new Map(); // lowercased channel -> ["owner/repo"]
let allRepos = [];

export function setRepos(repos) {
	reposByChannel = new Map();
	let all = new Set();
	if (repos && typeof repos === "object") {
		for (let [channel, list] of Object.entries(repos)) {
			if (!Array.isArray(list)) {
				continue;
			}
			list = list.filter((r) => typeof r === "string" && /^[\w.-]+\/[\w.-]+$/.test(r));
			reposByChannel.set(channel.toLowerCase(), list);
			list.forEach((r) => all.add(r));
		}
	}
	allRepos = [...all];
}

// repoNamed finds a repo by its full name or, if only one has it, its name
// (a sentence's full stop after it aside).
function repoNamed(name) {
	name = name.toLowerCase().replace(/\.+$/, "");
	let found = allRepos.filter((r) => r.toLowerCase() === name || r.toLowerCase().split("/")[1] === name);
	return found.length === 1 ? found[0] : null;
}

function channelsRepo(channel) {
	let list = (channel && reposByChannel.get(channel.toLowerCase())) || allRepos;
	return list.length === 1 ? list[0] : null;
}

// A repo's name, maybe with its account: "docs" or "acme/docs". Each match
// starts only at the start of a word, and nothing in it can match two ways,
// so searching a long message stays quick.
const repoName = String.raw`[\w.-]+(?:\/[\w.-]+)?`;
const wordStart = String.raw`(?<![\w/.#-])`;
const refRe = new RegExp(
	String.raw`${wordStart}(?:(?<named>${repoName}) )?(?<kind>\bPR|\bpull request|\bissue) #(?<n>\d+)\b` +
	String.raw`|${wordStart}(?<repo>${repoName})#(?<num>\d+)\b`,
	"gid",
);

function githubLinks(text, channel) {
	let out = [];
	if (allRepos.length === 0) {
		return out;
	}
	for (let m of text.matchAll(refRe)) {
		let { named, kind, n, repo, num } = m.groups;
		let [start, end] = m.indices[0];
		let href;
		if (kind) {
			let found = named && repoNamed(named);
			if (!found) {
				// The word before wasn't a repo: link just "PR #42".
				start = m.indices.groups.kind[0];
				found = channelsRepo(channel);
			}
			href = found && `https://github.com/${found}/${kind.toLowerCase() === "issue" ? "issues" : "pull"}/${n}`;
		} else {
			// GitHub sends /issues/N on to the pull request if that's what it is.
			let found = repoNamed(repo);
			href = found && `https://github.com/${found}/issues/${num}`;
		}
		if (href) {
			out.push({ start, end, value: text.substring(start, end), href });
		}
	}
	return out;
}

export default function linkify(text, onClick, channel) {
	let links = linkifyjs.find(text).filter((match) => {
		// "#42" is a pull request or an issue, not a channel.
		return match.isLink && !(match.type === "ircChannel" && /^#+\d+$/.test(match.value));
	});
	for (let ref of githubLinks(text, channel)) {
		if (!links.some((l) => l.start < ref.end && ref.start < l.end)) {
			links.push(ref);
		}
	}
	links.sort((a, b) => a.start - b.start);

	let children = [];
	let last = 0;
	links.forEach((match) => {
		const prefix = text.substring(last, match.start);
		children.push(prefix);

		children.push(html`
			<a
				href=${match.href}
				target="_blank"
				rel="noreferrer noopener"
				onClick=${onClick}
			>${match.value}</a>
		`);

		last = match.end;
	});

	const suffix = text.substring(last);
	children.push(suffix);

	return children;
}
