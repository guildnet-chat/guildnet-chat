import { html, Component, createRef } from "../lib/index.js";
import { outcomeOf, sendingOf, sent, settled, subscribe } from "../lib/approvals.js";

// Approve and Deny on a message asking you to decide an approval. Deny asks
// for a reason first (the agent is told it). Once decided, here or
// anywhere, they give way to what was decided. Their words are drawn by
// the stylesheet from data-label, so copying messages leaves them out.
export default class ApprovalButtons extends Component {
	state = { denying: false, reason: "" };
	reasonInput = createRef();

	componentDidMount() {
		this.stop = subscribe(() => this.forceUpdate());
	}

	componentDidUpdate(_, prev) {
		if (this.state.denying && !prev.denying && this.reasonInput.current) {
			this.reasonInput.current.focus();
		}
	}

	componentWillUnmount() {
		if (this.stop) {
			this.stop();
		}
	}

	decide(allow) {
		this.props.onDecide(this.props.id, allow, allow ? "" : this.state.reason);
		sent(this.props.id, allow);
		this.setState({ denying: false });
	}

	render() {
		let outcome = outcomeOf(this.props.id);
		if (outcome) {
			return html`<span class="approval-outcome approval-${outcome}" data-label=${outcome[0].toUpperCase() + outcome.slice(1)}></span>`;
		}
		let sending = sendingOf(this.props.id);
		if (sending) {
			return html`<span class="approval-outcome" data-label=${sending === "approving" ? "Approving…" : "Denying…"}></span>`;
		}
		// Asked a while ago and no longer waiting: nothing left to decide.
		if (settled(this.props.id, this.props.asked)) {
			return null;
		}
		if (this.state.denying) {
			let submit = (event) => {
				event.preventDefault();
				this.decide(false);
			};
			return html`
				<form class="approval-deny" onSubmit=${submit}>
					<input
						type="text"
						placeholder="Why not? The agent is told."
						aria-label="Reason for denying"
						maxlength="300"
						value=${this.state.reason}
						onInput=${(e) => this.setState({ reason: e.target.value })}
						ref=${this.reasonInput}
					/>
					<button type="submit" class="approval-button deny" aria-label="Deny" data-label="Deny"></button>
					<button type="button" class="approval-button" aria-label="Cancel" data-label="Cancel" onClick=${() => this.setState({ denying: false })}></button>
				</form>
			`;
		}
		return html`
			<span class="approval-buttons">
				<button type="button" class="approval-button approve" aria-label=${"Approve #" + this.props.id} data-label=${"Approve #" + this.props.id} onClick=${() => this.decide(true)}></button>
				<button type="button" class="approval-button deny" aria-label=${"Deny #" + this.props.id} data-label=${"Deny #" + this.props.id} onClick=${() => this.setState({ denying: true })}></button>
			</span>
		`;
	}
}
