// This chat is AGPL-3.0: whoever serves it offers its source to the people
// using it. config.json says where ("source": a web address, ideally the
// exact commit being served), and the settings link to it.

let source = null;

// setSource takes config.json's "source"; anything but an http(s) address
// means there's none.
export function setSource(url) {
	source = null;
	if (typeof url !== "string") {
		return;
	}
	try {
		let u = new URL(url);
		if (u.protocol === "https:" || u.protocol === "http:") {
			source = u.href;
		}
	} catch {
		// Not an address.
	}
}

// sourceURL is where this chat's source is, or null.
export function sourceURL() {
	return source;
}
