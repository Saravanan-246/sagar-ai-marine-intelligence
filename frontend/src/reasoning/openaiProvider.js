/**
 * OpenAI Provider Adapter (Stubbed Pluggable Provider)
 */

export class OpenAIProvider {
  constructor({ model = "gpt-4o-mini" } = {}) {
    this.name = "OpenAI";
    this.model = model;
  }

  async explainImpact({ impactResult, decision, changeEvent }) {
    return {
      provider: this.name,
      model: this.model,
      summary: `Impact identified on Segment ${impactResult.affectedSegmentIds.join(", ")}. Invariant preservation ratio: ${impactResult.preservationRatio}.`,
    };
  }

  async explainRepairs({ candidates, selectedCandidate }) {
    return {
      provider: this.name,
      model: this.model,
      comparison: "Minimal repair candidates evaluated against schedule and safety constraints.",
    };
  }
}
