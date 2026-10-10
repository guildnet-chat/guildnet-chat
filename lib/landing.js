// Where chat opens: on a conversation, not the server's own tab of raw IRC
// lines ("265 ada 1 1 Current local users"). The server tab stays in the
// channel list for anyone who wants it.

const GENERAL = "#general";

function fold(name) {
	return name.toLowerCase();
}

// openOn is the channel to move to, or null to stay: someone who landed on
// the server tab without choosing it goes to the channel last open, else
// #general, else the first channel joined (channels, in list order).
export function openOn({ onServerTab, chosen = false, channels, last }) {
	if (!onServerTab || chosen || channels.length === 0) {
		return null;
	}
	let find = (name) => channels.find((ch) => fold(ch) === fold(name));
	return (last && find(last)) || find(GENERAL) || channels[0];
}
