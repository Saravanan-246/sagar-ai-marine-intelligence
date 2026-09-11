/**
 * Sagar AI — LLM Reasoning Provider Interface
 * Problem Statement: SIH 26176
 *
 * ARCHITECTURAL RULE:
 * The LLM is an EXPLANATION and SUMMARIZATION layer.
 * It does NOT calculate geometry, segment impact, or mutate application state.
 * API keys MUST NOT be hardcoded in frontend components.
 */

import { GeminiProvider } from "./geminiProvider";
import { OpenAIProvider } from "./openaiProvider";
import { AnthropicProvider } from "./anthropicProvider";

const PROVIDERS = {
  gemini: new GeminiProvider({
    model: "Gemini 3.8 Flash Medium",
    role: "Operational Decision-Support Reasoner",
  }),
  openai: new OpenAIProvider({
    model: "gpt-4o-mini",
  }),
  anthropic: new AnthropicProvider({
    model: "claude-3-5-sonnet",
  }),
};

let activeProvider = PROVIDERS.gemini;

export function getActiveReasoningProvider() {
  return activeProvider;
}

export function setActiveReasoningProvider(providerKey) {
  if (PROVIDERS[providerKey]) {
    activeProvider = PROVIDERS[providerKey];
  }
}

/**
 * High-level reasoning helper: Explains a deterministic impact result
 */
export async function explainImpactAnalysis({ impactResult, decision, changeEvent }) {
  return activeProvider.explainImpact({ impactResult, decision, changeEvent });
}

/**
 * High-level reasoning helper: Summarizes trade-offs between repair candidates
 */
export async function explainRepairCandidates({ candidates, selectedCandidate }) {
  return activeProvider.explainRepairs({ candidates, selectedCandidate });
}
