// The chat docked beside GuildNet's console, which frames it from the same
// site, has a Hide button in its own header. The console says whether
// there's anything to hide ({type: "guildnet-dock", hideable}: not on its
// full-page Chat page), and is asked to hide it ({type:
// "guildnet-chat-hide"}). Only the window framing this page, on this
// page's own origin, is listened to or told.

function embedded(win) {
	return win.parent && win.parent !== win;
}

// watchDock calls onChange with whether the chat can be hidden, each time
// the console says. Until it does, it can't. Returns a stop function.
export function watchDock({ win = window, onChange }) {
	if (!embedded(win)) {
		return () => {};
	}
	let handle = (event) => {
		if (event.source !== win.parent || event.origin !== win.location.origin) {
			return;
		}
		let data = event.data;
		if (!data || typeof data !== "object" || data.type !== "guildnet-dock") {
			return;
		}
		onChange(data.hideable === true);
	};
	win.addEventListener("message", handle);
	return () => win.removeEventListener("message", handle);
}

// hideDock asks the console to hide the chat.
export function hideDock(win = window) {
	if (!embedded(win)) {
		return;
	}
	win.parent.postMessage({ type: "guildnet-chat-hide" }, win.location.origin);
}
