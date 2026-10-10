// What the chat is built from may be used in it: what ships in the chat
// (its dependencies) only under permissive licences, and nothing at all
// under the GPL family, the SSPL or the like, or with no licence said.
// Build tools may be under weak copyleft (lightningcss is MPL-2.0): none of
// their code goes in the chat. Reads package-lock.json, so it needs no
// installing.
import { readFileSync } from "node:fs";

const shipped = new Set(["MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC", "0BSD"]);
const never = /\b(A?GPL|LGPL|SSPL|BUSL|Commons-Clause|UNLICENSED)\b/i;

const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url)));
const problems = [];
for (const [where, pkg] of Object.entries(lock.packages)) {
	if (!where) {
		continue; // the chat itself
	}
	const name = where.replace(/^.*node_modules\//, "");
	const licence = pkg.license;
	if (!licence) {
		problems.push(`${name}: says no licence`);
	} else if (never.test(licence)) {
		problems.push(`${name}: ${licence}`);
	} else if (!pkg.dev && !licence.replace(/[()]/g, "").split(" OR ").some((l) => shipped.has(l.trim()))) {
		problems.push(`${name} ships in the chat, under ${licence}`);
	}
}
if (problems.length) {
	console.error(problems.join("\n"));
	process.exit(1);
}
console.log(`${Object.keys(lock.packages).length - 1} packages, licences fine`);
