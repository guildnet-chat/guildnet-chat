import { html, Component } from "../lib/index.js";
import linkify from "../lib/linkify.js";
import * as irc from "../lib/irc.js";
import { strip as stripANSI } from "../lib/ansi.js";
import { BufferType, ServerStatus, BufferEventsDisplayMode, getMessageURL, isMessageBeforeReceipt, SettingsContext } from "../state.js";
import * as store from "../store.js";
import Membership from "./membership.js";
import BotBadge, { isBotMessage } from "./bot-badge.js";
import ReplyButton from "./reply-button.js";
import ApprovalButtons from "./approval-buttons.js";
import { approvalAsked, approvalPrompt } from "../lib/approvals.js";
import { renderMarkdown } from "./markdown.js";
import { repliesTo, findMessage, snippet } from "../lib/reply.js";

function djb2(s) {
	let hash = 5381;
	for (let i = 0; i < s.length; i++) {
		hash = (hash << 5) + hash + s.charCodeAt(i);
		hash = hash >>> 0; // convert to uint32
	}
	return hash;
}

function Nick(props) {
	function handleClick(event) {
		event.preventDefault();
		props.onClick();
	}

	let title;
	if (props.user && irc.isMeaningfulRealname(props.user.realname, props.nick)) {
		title = stripANSI(props.user.realname);
	}

	let url = irc.formatURL({ host: props.bouncerNetwork?.host, entity: props.nick, enttype: "user" });
	let colorIndex = djb2(props.nick) % 16 + 1;
	return html`
		<a
			href=${url}
			title=${title}
			class="nick nick-${colorIndex}"
			onClick=${handleClick}
		>${props.nick}</a>
	`;
}

function _Timestamp({ date, url, showSeconds }) {
	if (!date) {
		let timestamp = "--:--";
		if (showSeconds) {
			timestamp += ":--";
		}
		return html`<span class="timestamp" aria-hidden="true">${timestamp}</span>`;
	}

	let hh = date.getHours().toString().padStart(2, "0");
	let mm = date.getMinutes().toString().padStart(2, "0");
	let timestamp = `${hh}:${mm}`;
	if (showSeconds) {
		let ss = date.getSeconds().toString().padStart(2, "0");
		timestamp += ":" + ss;
	}
	return html`
		<a
			href=${url}
			class="timestamp"
			title=${date.toLocaleString()}
			onClick=${(event) => event.preventDefault()}
		>
			${timestamp}
		</a>
	`;
}

function Timestamp(props) {
	return html`
		<${SettingsContext.Consumer}>
			${(settings) => html`
				<${_Timestamp} ...${props} showSeconds=${settings.secondsInTimestamps}/>
			`}
		</>
	`;
}

/**
 * Check whether a message can be folded.
 *
 * Unimportant and noisy messages that may clutter the discussion should be
 * folded.
 */
function canFoldMessage(msg) {
	switch (msg.command) {
	case "JOIN":
	case "PART":
	case "QUIT":
	case "NICK":
		return true;
	}
	return false;
}

class LogLine extends Component {
	shouldComponentUpdate(nextProps) {
		return this.props.message !== nextProps.message || this.props.redacted !== nextProps.redacted;
	}

	render() {
		let msg = this.props.message;
		let buf = this.props.buffer;
		let server = this.props.server;
		let bouncerNetwork = this.props.bouncerNetwork;

		let onNickClick = this.props.onNickClick;
		let onChannelClick = this.props.onChannelClick;
		let onVerifyClick = this.props.onVerifyClick;

		function createNick(nick) {
			return html`
				<${Nick}
					nick=${nick}
					user=${server.users.get(nick)}
					bouncerNetwork=${bouncerNetwork}
					onClick=${() => onNickClick(nick)}
				/>
			`;
		}
		function createChannel(channel) {
			let url = irc.formatURL({ host: bouncerNetwork?.host, entity: channel });
			return html`
				<a href=${url} onClick=${onChannelClick}>
					${channel}
				</a>
			`;
		}

		let lineClass = "";
		let content;
		let invitee, target, account;
		switch (msg.command) {
		case "NOTICE":
		case "PRIVMSG":
			target = msg.params[0];
			let text = msg.params[1];

			let ctcp = irc.parseCTCP(msg);
			if (ctcp) {
				if (ctcp.command === "ACTION") {
					lineClass = "me-tell";
					content = html`* ${createNick(msg.prefix.name)}${isBotMessage(msg) ? html` <${BotBadge} host=${msg.prefix.host}/>` : null} ${renderMarkdown(stripANSI(ctcp.param), (t) => linkify(t, onChannelClick, buf.name))}`;
				} else {
					content = html`
						${createNick(msg.prefix.name)} has sent a CTCP command: ${ctcp.command} ${ctcp.param}
					`;
				}
			} else {
				let prefix = "<", suffix = ">";
				if (msg.command === "NOTICE") {
					lineClass += " notice";
					prefix = suffix = "-";
				}
				if (this.props.redacted) {
					content = html`<i>This message has been deleted.</i>`;
				} else {
					// An approval's words can be someone else's: shown as written.
					content = approvalPrompt(msg)
						? html`${stripANSI(text)}`
						: html`${renderMarkdown(stripANSI(text), (t) => linkify(t, onChannelClick, buf.name))}`;
					lineClass += " talk";
				}
				content = html`
					<span class="nick-caret" aria-hidden="true">${prefix}</span>
					${createNick(msg.prefix.name)}
					<span class="nick-caret" aria-hidden="true">${suffix}</span>
					${isBotMessage(msg) ? html` <${BotBadge} host=${msg.prefix.host}/>` : null}
					${" "}
					${content}
				`;
			}

			// A reply shows what it answers.
			if (repliesTo(msg)) {
				let original = findMessage(buf.messages, repliesTo(msg));
				content = html`
					<span class="reply-to">
						${original ? html`<b>${original.prefix.name}</b> ${snippet(original.params[1])}` : "an earlier message"}
					</span>
					${content}
				`;
			}

			let allowedPrefixes = server.statusMsg;
			if (target !== buf.name && allowedPrefixes) {
				let parts = irc.parseTargetPrefix(target, allowedPrefixes);
				if (parts.name === buf.name) {
					content = [html`(<${Membership} value=${parts.prefix}/>)`, " ", content];
				}
			}

			if (msg.tags["+draft/channel-context"]) {
				content = html`<em>(only visible to you)</em> ${content}`;
			}

			if (msg.isHighlight) {
				lineClass += " highlight";
			}
			break;
		case "JOIN":
			content = html`
				${createNick(msg.prefix.name)} has joined
			`;
			break;
		case "PART":
			content = html`
				${createNick(msg.prefix.name)} has left
			`;
			break;
		case "QUIT":
			content = html`
				${createNick(msg.prefix.name)} has quit
			`;
			break;
		case "NICK":
			let newNick = msg.params[0];
			content = html`
				${createNick(msg.prefix.name)} is now known as ${createNick(newNick)}
			`;
			break;
		case "KICK":
			content = html`
				${createNick(msg.params[1])} was kicked by ${createNick(msg.prefix.name)} (${msg.params.slice(2)})
			`;
			break;
		case "MODE":
			target = msg.params[0];
			let modeStr = msg.params[1];

			let user = html`${createNick(msg.prefix.name)}`;

			// TODO: use irc.forEachChannelModeUpdate()
			if (buf.type === BufferType.CHANNEL && modeStr.length === 2 && server.cm(buf.name) === server.cm(target)) {
				let plusMinus = modeStr[0];
				let mode = modeStr[1];
				let arg = msg.params[2];

				let verb;
				switch (mode) {
				case "b":
					verb = plusMinus === "+" ? "added" : "removed";
					content = html`${user} has ${verb} a ban on ${arg}`;
					break;
				case "e":
					verb = plusMinus === "+" ? "added" : "removed";
					content = html`${user} has ${verb} a ban exemption on ${arg}`;
					break;
				case "l":
					if (plusMinus === "+") {
						content = html`${user} has set the channel user limit to ${arg}`;
					} else {
						content = html`${user} has unset the channel user limit`;
					}
					break;
				case "i":
					verb = plusMinus === "+" ? "marked": "unmarked";
					content = html`${user} has ${verb} as invite-only`;
					break;
				case "m":
					verb = plusMinus === "+" ? "marked": "unmarked";
					content = html`${user} has ${verb} as moderated`;
					break;
				case "s":
					verb = plusMinus === "+" ? "marked": "unmarked";
					content = html`${user} has ${verb} as secret`;
					break;
				case "t":
					verb = plusMinus === "+" ? "locked": "unlocked";
					content = html`${user} has ${verb} the channel topic`;
					break;
				case "n":
					verb = plusMinus === "+" ? "allowed": "denied";
					content = html`${user} has ${verb} external messages to this channel`;
					break;
				}
				if (content) {
					break;
				}

				// Channel membership modes
				let membershipName;
				for (let membership of server.membershipModes) {
					if (membership.mode === mode) {
						membershipName = irc.STD_MEMBERSHIP_NAMES[membership.prefix];
						break;
					}
				}
				if (membershipName && arg) {
					let verb = plusMinus === "+" ? "granted" : "revoked";
					let preposition = plusMinus === "+" ? "to" : "from";
					content = html`
						${user} has ${verb} ${membershipName} privileges ${preposition} ${createNick(arg)}
					`;
					break;
				}
			}

			content = html`
				${user} sets mode ${msg.params.slice(1).join(" ")}
			`;
			if (server.cm(buf.name) !== server.cm(target)) {
				content = html`${content} on ${target}`;
			}
			break;
		case "TOPIC":
			let topic = msg.params[1];
			if (topic) {
				content = html`
					${createNick(msg.prefix.name)} changed the topic to: ${linkify(stripANSI(topic), onChannelClick, buf.name)}
				`;
			} else {
				content = html`
					${createNick(msg.prefix.name)} cleared the topic
				`;
			}
			break;
		case "INVITE":
			invitee = msg.params[0];
			let channel = msg.params[1];
			// TODO: instead of checking buffer type, check if invitee is our nick
			if (buf.type === BufferType.SERVER) {
				lineClass = "talk";
				content = html`
					You have been invited to ${createChannel(channel)} by ${createNick(msg.prefix.name)}
				`;
			} else {
				content = html`
					${createNick(msg.prefix.name)} has invited ${createNick(invitee)} to the channel
				`;
			}
			break;
		case irc.RPL_WELCOME:
			let nick = msg.params[0];
			content = html`Connected to server, your nickname is ${nick}`;
			break;
		case irc.RPL_INVITING:
			invitee = msg.params[1];
			content = html`${createNick(invitee)} has been invited to the channel`;
			break;
		case irc.RPL_MOTD:
			lineClass = "motd";
			content = linkify(stripANSI(msg.params[1]), onChannelClick);
			break;
		case irc.RPL_LOGGEDIN:
			account = msg.params[2];
			content = html`You are now authenticated as ${account}`;
			break;
		case irc.RPL_LOGGEDOUT:
			content = html`You are now unauthenticated`;
			break;
		case "REGISTER":
			account = msg.params[1];
			let reason = msg.params[2];

			function handleVerifyClick(event) {
				event.preventDefault();
				onVerifyClick(account, reason);
			}

			switch (msg.params[0]) {
			case "SUCCESS":
				content = html`A new account has been created, you are now authenticated as ${account}`;
				break;
			case "VERIFICATION_REQUIRED":
				content = html`A new account has been created, but you need to <a href="#" onClick=${handleVerifyClick}>verify it</a>: ${linkify(reason, onChannelClick)}`;
				break;
			}
			break;
		case "VERIFY":
			account = msg.params[1];
			content = html`The new account has been verified, you are now authenticated as ${account}`;
			break;
		case irc.RPL_UMODEIS:
			let mode = msg.params[1];
			if (mode) {
				content = html`Your user mode is ${mode}`;
			} else {
				content = html`You have no user mode`;
			}
			break;
		case irc.RPL_CHANNELMODEIS:
			content = html`Channel mode is ${msg.params.slice(2).join(" ")}`;
			break;
		case irc.RPL_CREATIONTIME:
			let date = new Date(parseInt(msg.params[2], 10) * 1000);
			content = html`Channel was created on ${date.toLocaleString()}`;
			break;
		// MONITOR messages are only displayed in user buffers
		case irc.RPL_MONONLINE:
			content = html`${createNick(buf.name)} is online`;
			break;
		case irc.RPL_MONOFFLINE:
			content = html`${createNick(buf.name)} is offline`;
			break;
		default:
			if (irc.isError(msg.command) && msg.command !== irc.ERR_NOMOTD) {
				lineClass = "error";
			}
			content = html`${msg.command} ${linkify(msg.params.join(" "), onChannelClick)}`;
		}

		if (!content) {
			return null;
		}

		let canReply = this.props.onReplyClick && msg.tags.msgid && !this.props.redacted
			&& (msg.command === "PRIVMSG" || msg.command === "NOTICE");
		// An approval asking you to decide: Approve and Deny, right here.
		let approval = this.props.onApprovalDecide && !this.props.redacted ? approvalAsked(msg, server.account) : null;
		if (approval !== null) {
			content = html`${content} <${ApprovalButtons} id=${approval} asked=${msg.tags.time} onDecide=${this.props.onApprovalDecide}/>`;
		}
		return html`
			<div class="logline ${lineClass}" data-key=${msg.key} role="listitem">
				<${Timestamp} date=${new Date(msg.tags.time)} url=${getMessageURL(buf, msg, bouncerNetwork)}/>
				${" "}
				${content}
				${canReply ? html`
					<${ReplyButton} onClick=${() => this.props.onReplyClick(msg)}/>
				` : null}
			</div>
		`;
	}
}

function createNickList(nicks, createNick) {
	if (nicks.length === 0) {
		return null;
	} else if (nicks.length === 1) {
		return createNick(nicks[0]);
	}

	let l = nicks.slice(0, nicks.length - 1).map((nick, i) => {
		if (i === 0) {
			return createNick(nick);
		} else {
			return [", ", createNick(nick)];
		}
	});

	l.push(" and ");
	l.push(createNick(nicks[nicks.length - 1]));

	return l;
}

class FoldGroup extends Component {
	shouldComponentUpdate(nextProps) {
		return this.props.messages[0] !== nextProps.messages[0] ||
			this.props.messages[this.props.messages.length - 1] !== nextProps.messages[nextProps.messages.length - 1];
	}

	render() {
		let msgs = this.props.messages;
		let buf = this.props.buffer;
		let server = this.props.server;
		let bouncerNetwork = this.props.bouncerNetwork;

		let onNickClick = this.props.onNickClick;
		function createNick(nick) {
			return html`
				<${Nick}
					nick=${nick}
					user=${server.users.get(nick)}
					bouncerNetwork=${bouncerNetwork}
					onClick=${() => onNickClick(nick)}
				/>
			`;
		}

		let byCommand = {
			"JOIN": [],
			"PART": [],
			"QUIT": [],
			"NICK": [],
		};
		msgs.forEach((msg) => {
			byCommand[msg.command].push(msg);
		});

		let first = true;
		let content = [];
		["JOIN", "PART", "QUIT"].forEach((cmd) => {
			if (byCommand[cmd].length === 0) {
				return;
			}

			let nicks = new Set(byCommand[cmd].map((msg) => msg.prefix.name));

			let plural = nicks.size > 1;
			let action;
			switch (cmd) {
			case "JOIN":
				action = plural ? "have joined" : "has joined";
				break;
			case "PART":
				action = plural ? "have left" : "has left";
				break;
			case "QUIT":
				action = plural ? "have quit" : "has quit";
				break;
			}

			if (first) {
				first = false;
			} else {
				content.push(", ");
			}

			content.push(createNickList([...nicks], createNick));
			content.push(" " + action);
		});

		byCommand["NICK"].forEach((msg) => {
			if (first) {
				first = false;
			} else {
				content.push(", ");
			}

			let newNick = msg.params[0];
			content.push(html`
				${createNick(msg.prefix.name)} is now known as ${createNick(newNick)}
			`);
		});

		let lastMsg = msgs[msgs.length - 1];
		let firstDate = new Date(msgs[0].tags.time);
		let lastDate = new Date(lastMsg.tags.time);
		let timestamp = html`
			<${Timestamp} date=${firstDate} url=${getMessageURL(buf, msgs[0], bouncerNetwork)}/>
		`;
		if (lastDate - firstDate > 60 * 100) {
			timestamp = [
				timestamp,
				" to ",
				html`
					<${Timestamp} date=${lastDate} url=${getMessageURL(buf, lastMsg, bouncerNetwork)}/>
				`,
			];
		}

		return html`
			<div class="logline" data-key=${msgs[0].key} role="listitem">
				${timestamp}
				${" "}
				${content}
			</div>
		`;
	}
}

// Workaround for https://bugs.chromium.org/p/chromium/issues/detail?id=481856
let notificationsSupported = false;
if (window.Notification) {
	notificationsSupported = true;
	if (Notification.permission === "default") {
		try {
			new Notification("");
		} catch (err) {
			if (err.name === "TypeError") {
				notificationsSupported = false;
			}
		}
	}
}

class NotificationNagger extends Component {
	state = { nag: false };

	constructor(props) {
		super(props);

		this.handleClick = this.handleClick.bind(this);

		this.state.nag = this.shouldNag();
	}

	shouldNag() {
		return notificationsSupported && Notification.permission === "default";
	}

	handleClick(event) {
		event.preventDefault();

		Notification.requestPermission((permission) => {
			this.setState({ nag: this.shouldNag() });
		});
	}

	render() {
		if (!this.state.nag) {
			return null;
		}

		return html`
			<div class="logline nag" role="listitem">
				<${Timestamp}/>
				${" "}
				<a href="#" onClick=${this.handleClick}>Turn on desktop notifications</a> to get notified about new messages
			</div>
		`;
	}
}

class ProtocolHandlerNagger extends Component {
	state = { nag: true };

	constructor(props) {
		super(props);

		this.handleClick = this.handleClick.bind(this);

		this.state.nag = !store.naggedProtocolHandler.load();
	}

	handleClick(event) {
		event.preventDefault();

		let url = window.location.origin + window.location.pathname + "?open=%s";
		try {
			navigator.registerProtocolHandler("irc", url);
			navigator.registerProtocolHandler("ircs", url);
		} catch (err) {
			console.error("Failed to register protocol handler: ", err);
		}

		store.naggedProtocolHandler.put(true);
		this.setState({ nag: false });
	}

	render() {
		if (!navigator.registerProtocolHandler || !this.state.nag) {
			return null;
		}
		let name = this.props.bouncerName || "this bouncer";
		return html`
			<div class="logline nag" role="listitem">
				<${Timestamp}/>
				${" "}
				<a href="#" onClick=${this.handleClick}>Register our protocol handler</a> to open IRC links with ${name}
			</div>
		`;
	}
}

function AccountNagger({ server, onAuthClick, onRegisterClick }) {
	let accDesc = "an account on this server";
	if (server.name) {
		accDesc = "a " + server.name + " account";
	}

	function handleAuthClick(event) {
		event.preventDefault();
		onAuthClick();
	}
	function handleRegisterClick(event) {
		event.preventDefault();
		onRegisterClick();
	}

	let msg = [html`
		You are unauthenticated on this server,
		${" "}
		<a href="#" onClick=${handleAuthClick}>login</a>
		${" "}
	`];

	if (server.supportsAccountRegistration) {
		msg.push(html`or <a href="#" onClick=${handleRegisterClick}>register</a> ${accDesc}`);
	} else {
		msg.push(html`if you have ${accDesc}`);
	}

	return html`
		<div class="logline nag" role="listitem">
			<${Timestamp}/> ${msg}
		</div>
	`;
}

class DateSeparator extends Component {
	constructor(props) {
		super(props);
	}

	shouldComponentUpdate(nextProps) {
		return this.props.date.getTime() !== nextProps.date.getTime();
	}

	render() {
		let date = this.props.date;
		let text = date.toLocaleDateString([], { year: "numeric", month: "2-digit", day: "2-digit" });
		return html`
			<div class="separator date-separator" role="separator">
				${text}
			</div>
		`;
	}
}

function UnreadSeparator(props) {
	return html`<div class="separator unread-separator" role="separator">New messages</div>`;
}

function sameDate(d1, d2) {
	return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default class Buffer extends Component {
	shouldComponentUpdate(nextProps) {
		return this.props.buffer !== nextProps.buffer ||
			this.props.settings !== nextProps.settings;
	}

	render() {
		let buf = this.props.buffer;
		if (!buf) {
			return null;
		}

		let server = this.props.server;
		let bouncerNetwork = this.props.bouncerNetwork;
		let settings = this.props.settings;
		let serverName = server.name;

		let children = [];
		if (buf.type === BufferType.SERVER) {
			children.push(html`<${NotificationNagger}/>`);
		}
		if (buf.type === BufferType.SERVER && server.isBouncer && !server.bouncerNetID) {
			children.push(html`<${ProtocolHandlerNagger} bouncerName=${serverName}/>`);
		}
		if (buf.type === BufferType.SERVER && server.status === ServerStatus.REGISTERED && server.supportsSASLPlain && !server.account) {
			children.push(html`
				<${AccountNagger}
					server=${server}
					onAuthClick=${this.props.onAuthClick}
					onRegisterClick=${this.props.onRegisterClick}
				/>
			`);
		}

		let onChannelClick = this.props.onChannelClick;
		let onNickClick = this.props.onNickClick;
		let onVerifyClick = this.props.onVerifyClick;
		let onReplyClick = this.props.onReplyClick;
		let onApprovalDecide = this.props.onApprovalDecide;

		function createLogLine(msg) {
			return html`
				<${LogLine}
					key=${"msg-" + msg.key}
					message=${msg}
					buffer=${buf}
					server=${server}
					bouncerNetwork=${bouncerNetwork}
					redacted=${buf.redacted.has(msg.tags.msgid)}
					onChannelClick=${onChannelClick}
					onNickClick=${onNickClick}
					onVerifyClick=${onVerifyClick}
					onReplyClick=${onReplyClick}
					onApprovalDecide=${onApprovalDecide}
				/>
			`;
		}
		function createFoldGroup(msgs) {
			// Merge NICK change chains
			let nickChanges = new Map();
			let mergedMsgs = [];
			for (let msg of msgs) {
				let keep = true;
				switch (msg.command) {
				case "PART":
				case "QUIT":
					nickChanges.delete(msg.prefix.name);
					break;
				case "NICK":
					let prev = nickChanges.get(msg.prefix.name);
					if (!prev) {
						// Future NICK messages may mutate this one
						msg = { ...msg };
						nickChanges.set(msg.params[0], msg);
						break;
					}

					prev.params = msg.params;
					nickChanges.delete(msg.prefix.name);
					nickChanges.set(msg.params[0], prev);
					keep = false;
					break;
				}
				if (keep) {
					mergedMsgs.push(msg);
				}
			}
			msgs = mergedMsgs;

			// Filter out PART → JOIN pairs, as well as no-op NICKs from previous step
			let partIndexes = new Map();
			let keep = [];
			msgs.forEach((msg, i) => {
				if (msg.command === "PART" || msg.command === "QUIT") {
					partIndexes.set(msg.prefix.name, i);
				}
				if (msg.command === "JOIN" && partIndexes.has(msg.prefix.name)) {
					keep[partIndexes.get(msg.prefix.name)] = false;
					partIndexes.delete(msg.prefix.name);
					keep.push(false);
				} else if (msg.command === "NICK" && msg.prefix.name === msg.params[0]) {
					keep.push(false);
				} else {
					keep.push(true);
				}
			});
			msgs = msgs.filter((msg, i) => keep[i]);

			if (msgs.length === 0) {
				return null;
			} else if (msgs.length === 1) {
				return createLogLine(msgs[0]);
			}
			return html`
				<${FoldGroup}
					key=${"fold-" + msgs[0].key + "-" + msgs[msgs.length - 1].key}
					messages=${msgs}
					buffer=${buf}
					server=${server}
					bouncerNetwork=${bouncerNetwork}
					onNickClick=${onNickClick}
				/>
			`;
		}

		let hasUnreadSeparator = false;
		let prevDate = new Date();
		let foldMessages = [];
		let lastMonitor = null;
		buf.messages.forEach((msg) => {
			let sep = [];

			if (settings.bufferEvents === BufferEventsDisplayMode.HIDE && canFoldMessage(msg)) {
				return;
			}

			if (msg.command === irc.RPL_MONONLINE || msg.command === irc.RPL_MONOFFLINE) {
				let skip = !lastMonitor || msg.command === lastMonitor;
				lastMonitor = msg.command;
				if (skip) {
					return;
				}
			}

			if (!hasUnreadSeparator && buf.type !== BufferType.SERVER && !isMessageBeforeReceipt(msg, buf.prevReadReceipt)) {
				sep.push(html`<${UnreadSeparator} key="unread"/>`);
				hasUnreadSeparator = true;
			}

			let date = new Date(msg.tags.time);
			if (!sameDate(prevDate, date)) {
				sep.push(html`<${DateSeparator} key=${"date-" + date} date=${date}/>`);
			}
			prevDate = date;

			if (sep.length > 0) {
				children.push(createFoldGroup(foldMessages));
				children.push(...sep);
				foldMessages = [];
			}

			// TODO: consider checking the time difference too
			if (settings.bufferEvents === BufferEventsDisplayMode.FOLD && canFoldMessage(msg)) {
				foldMessages.push(msg);
				return;
			}

			if (foldMessages.length > 0) {
				children.push(createFoldGroup(foldMessages));
				foldMessages = [];
			}

			children.push(createLogLine(msg));
		});
		children.push(createFoldGroup(foldMessages));

		return html`
			<div class="logline-list" role="list">
				${children}
			</div>
		`;
	}
}
