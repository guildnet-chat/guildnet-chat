// Bearer-token sign-in: the page's own site hands out short-lived tokens
// that the IRC server accepts in place of a password (SASL IRCV3BEARER).
// A token is fetched each time the client connects, so none is ever stored.

export class BearerTokenError extends Error {
	constructor(message, status) {
		super(message);
		this.name = "BearerTokenError";
		this.status = status;
	}
}

/**
 * Ask the site for a token. Resolves to { account, token }.
 */
export async function fetchBearerToken(url) {
	let resp;
	try {
		resp = await fetch(url, {
			method: "POST",
			credentials: "same-origin",
			cache: "no-store",
		});
	} catch (err) {
		throw new BearerTokenError("Couldn't reach the server to sign in: " + err.message, 0);
	}
	if (!resp.ok) {
		let text = (await resp.text()).trim();
		throw new BearerTokenError(text || `Signing in failed (HTTP ${resp.status})`, resp.status);
	}
	let data = await resp.json();
	if (typeof data.token !== "string" || typeof data.account !== "string") {
		throw new BearerTokenError("The server's sign-in response was missing a token", resp.status);
	}
	return data;
}
