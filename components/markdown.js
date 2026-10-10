import { html } from "../lib/index.js";
import { parseMarkdown } from "../lib/markdown.js";

/**
 * Draw a message's markdown as elements. renderText draws ordinary text
 * (linkify, in practice); code is shown exactly as written.
 */
export function renderMarkdown(text, renderText) {
	return render(parseMarkdown(text), renderText);
}

function render(nodes, renderText) {
	return nodes.map((n) => {
		switch (n.type) {
		case "bold":
			return html`<strong>${render(n.children, renderText)}</strong>`;
		case "italic":
			return html`<em>${render(n.children, renderText)}</em>`;
		case "strike":
			return html`<del>${render(n.children, renderText)}</del>`;
		case "quote":
			return html`<blockquote>${render(n.children, renderText)}</blockquote>`;
		case "code":
			return html`<code>${n.text}</code>`;
		case "codeblock":
			return html`<pre class="codeblock" data-lang=${n.lang || undefined}><code>${n.text}</code></pre>`;
		default:
			return renderText(n.text);
		}
	});
}
