// GuildNet's chat, left open since before a deploy, is an older version.
// The page it was loaded from says which (<meta name="guildnet-version">);
// now and then, and whenever the tab is looked at again, it asks GuildNet
// which is current (./version), and says so, once, when they differ, so
// the person can reload. Served elsewhere, with no version, it never asks.

// loadedVersion is the version this page was loaded as, if GuildNet said.
export function loadedVersion(doc = globalThis.document) {
	let meta = doc && doc.querySelector("meta[name=\"guildnet-version\"]");
	return (meta && meta.getAttribute("content")) || null;
}

// currentVersion asks GuildNet which version is current.
export async function currentVersion() {
	let resp = await fetch("version", { cache: "no-store", credentials: "same-origin" });
	if (!resp.ok) {
		return null;
	}
	let data = await resp.json();
	return data && typeof data.version === "string" ? data.version : null;
}

function whenVisible(fn) {
	let handler = () => {
		if (document.visibilityState === "visible") {
			fn();
		}
	};
	document.addEventListener("visibilitychange", handler);
	return () => document.removeEventListener("visibilitychange", handler);
}

// watchForUpdate calls onNewer once when GuildNet's current version isn't
// loaded. It returns the way to stop.
export function watchForUpdate({
	loaded = loadedVersion(),
	fetchVersion = currentVersion,
	onNewer,
	every = 10 * 60 * 1000,
	setInterval = globalThis.setInterval,
	clearInterval = globalThis.clearInterval,
	onVisible = whenVisible,
} = {}) {
	if (!loaded) {
		return () => {};
	}
	let said = false;
	let check = async () => {
		if (said) {
			return;
		}
		let current;
		try {
			current = await fetchVersion();
		} catch {
			return; // not reachable now: asked again later
		}
		if (current && current !== loaded && !said) {
			said = true;
			onNewer();
		}
	};
	let timer = setInterval(check, every);
	let stopVisible = onVisible(check);
	return () => {
		clearInterval(timer);
		stopVisible();
	};
}
