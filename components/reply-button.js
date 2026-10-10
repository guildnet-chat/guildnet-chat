import { html } from "../lib/index.js";

// The Reply button on a message. Its word is drawn by the stylesheet from
// data-label, not written inside it, so copying messages leaves it out.
export default function ReplyButton({ onClick }) {
	return html`<button type="button" class="reply-button" title="Reply" aria-label="Reply" data-label="Reply" onClick=${onClick}></button>`;
}
