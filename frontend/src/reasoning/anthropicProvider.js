/**
 * Anthropic Provider Adapter (Stubbed Pluggable Provider)
 */

export class AnthropicProvider {
  constructor({ model = "claude-3-5-sonnet" } = {}) {
    this.name = "Anthropic";
    this.model = model;
  }

  async explainImpact({ impactResult, decision, changeEvent }) {
    return {
      provider: this.name,
      model: this.model,
      summary: `Impact localized to Segment ${impactResult.affectedSegmentIds.join(", ")}.`,
    };
  }

  async explainRepairs({ candidates, selectedCandidate }) {
    return {
      provider: this.name,
      model: this.model,
      comparison: "Trade-off analysis across plan churn and objective retention.",
    };
  }
}
