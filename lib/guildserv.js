// GuildServ through the console. Plain IRC signs in with the password
// alone; the console asked for a second step too. So, where the console says
// so (its config's guildserv.url), what's said to GuildServ, typed or from an
// approval's buttons, goes to the console as whoever's signed in there, and
// GuildServ takes changes from two-step accounts only that way. GuildServ
// still answers over IRC.

/**
 * Where what's said to target goes instead of IRC: the console's route if
 * target is GuildServ and the console has one, or null.
 */
export function guildServRoute(config, target) {
	let url = config && config.guildserv && config.guildserv.url;
	if (!url || typeof target !== "string" || target.toLowerCase() !== "guildserv") {
		return null;
	}
	return url;
}

/**
 * Send text to GuildServ through the console at url, a command a line.
 * Rejects with what the console said if it didn't take one.
 */
export async function sendToGuildServ(url, text, fetchFn = globalThis.fetch) {
	for (let line of text.split("\n")) {
		line = line.trim();
		if (!line) {
			continue;
		}
		let resp = await fetchFn(url, {
			method: "POST",
			credentials: "same-origin",
			cache: "no-store",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ text: line }),
		});
		if (!resp.ok) {
			let why = (await resp.text()).trim();
			throw new Error(why || `GuildServ didn't get that (HTTP ${resp.status})`);
		}
	}
}
