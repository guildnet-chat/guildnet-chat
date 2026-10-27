import { html, Component } from "../lib/index.js";
import { strip as stripANSI } from "../lib/ansi.js";
import Membership from "./membership.js";
import BotBadge, { isBotAccount } from "./bot-badge.js";
import * as irc from "../lib/irc.js";

class MemberItem extends Component {
	constructor(props) {
		super(props);

		this.handleClick = this.handleClick.bind(this);
	}

	shouldComponentUpdate(nextProps) {
		return this.props.nick !== nextProps.nick
			|| this.props.membership !== nextProps.membership
			|| this.props.user !== nextProps.user;
	}

	handleClick(event) {
		event.preventDefault();
		this.props.onClick();
	}

	render() {
		let title;
		let user = this.props.user;
		let classes = ["nick"];
		if (user) {
			let mask = "";
			if (user.username && user.hostname) {
				mask = `${user.username}@${user.hostname}`;
			}

			if (irc.isMeaningfulRealname(user.realname, this.props.nick)) {
				title = stripANSI(user.realname);
				if (mask) {
					title = `${title} (${mask})`;
				}
			} else {
				title = mask;
			}

			if (user.account) {
				title += `\nAuthenticated as ${user.account}`;
			}

			if (user.away) {
				classes.push("away");
				title += "\nAway";
			}
		}

		let url = irc.formatURL({
			host: this.props.bouncerNetwork?.host,
			entity: this.props.nick,
			enttype: "user",
		});

		return html`
			<li>
				<a
					href=${url}
					class=${classes.join(" ")}
					title=${title}
					onClick=${this.handleClick}
				>
					<${Membership} value=${this.props.membership}/>
					${this.props.nick}
					${user && user.bot && isBotAccount(user.account) ? html` <${BotBadge} host=${user.hostname}/>` : null}
				</a>
			</li>
		`;
	}
}

const prefixPrivs = ["~", "&", "@", "%", "+"]; // TODO: grab it from ISUPPORT PREFIX

// Headings for the member list, by channel rank. config.json can rename
// them (members.groups), keyed by prefix, with "" for no rank.
const defaultGroupNames = {
	"~": "Owners",
	"&": "Admins",
	"@": "Operators",
	"%": "Half-operators",
	"+": "Voiced",
	"": "Members",
};

function groupOf(membership) {
	let p = membership ? membership[0] : "";
	return prefixPrivs.includes(p) ? p : "";
}

function sortMembers(a, b) {
	let [nickA, membA] = a, [nickB, membB] = b;

	let i = prefixPrivs.indexOf(membA[0]), j = prefixPrivs.indexOf(membB[0]);
	if (i < 0) {
		i = prefixPrivs.length;
	}
	if (j < 0) {
		j = prefixPrivs.length;
	}
	if (i !== j) {
		return i - j;
	}

	return nickA.localeCompare(nickB);
}

export default class MemberList extends Component {
	shouldComponentUpdate(nextProps) {
		return this.props.members !== nextProps.members
			|| this.props.users !== nextProps.users
			|| this.props.groups !== nextProps.groups;
	}

	render() {
		let names = { ...defaultGroupNames, ...(this.props.groups || {}) };
		let sorted = Array.from(this.props.members).sort(sortMembers);
		let counts = new Map();
		for (let [, membership] of sorted) {
			let g = groupOf(membership);
			counts.set(g, (counts.get(g) || 0) + 1);
		}
		let items = [];
		let current = null;
		for (let [nick, membership] of sorted) {
			let g = groupOf(membership);
			if (g !== current) {
				current = g;
				items.push(html`
					<li class="member-group" role="presentation" key=${"group:" + g}>
						${names[g]} <span class="member-group-count">${counts.get(g)}</span>
					</li>
				`);
			}
			items.push(html`
				<${MemberItem}
					key=${nick}
					nick=${nick}
					membership=${membership}
					user=${this.props.users.get(nick)}
					bouncerNetwork=${this.props.bouncerNetwork}
					onClick=${() => this.props.onNickClick(nick)}
				/>
			`);
		}
		return html`<ul>${items}</ul>`;
	}
}
