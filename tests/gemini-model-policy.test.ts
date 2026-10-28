import assert from "node:assert/strict";
import test from "node:test";

import {
  createGoogleGeminiModel,
  DEFAULT_GOOGLE_GEMINI_MODEL,
  isPotentiallyUnavailableLegacyGeminiModel,
} from "../features/exections/components/gemini/model-policy";
import { workflowTemplates } from "../features/workflows/demo-templates";

test("Google model factory uses the new default only when no model was configured", () => {
  const selectedModels: string[] = [];
  const createModel = (modelId: string) => {
    selectedModels.push(modelId);
    return { modelId };
  };

  assert.deepEqual(createGoogleGeminiModel(undefined, createModel), {
    modelId: DEFAULT_GOOGLE_GEMINI_MODEL,
  });
  assert.deepEqual(createGoogleGeminiModel("custom-model", createModel), {
    modelId: "custom-model",
  });
  assert.deepEqual(createGoogleGeminiModel("gemini-2.5-flash", createModel), {
    modelId: "gemini-2.5-flash",
  });
  assert.deepEqual(selectedModels, [
    "gemini-3.8-flash",
    "custom-model",
    "gemini-2.5-flash",
  ]);
});

test("legacy Gemini model warning covers retired and restricted model families", () => {
  assert.equal(isPotentiallyUnavailableLegacyGeminiModel("gemini-2.0-flash"), true);
  assert.equal(isPotentiallyUnavailableLegacyGeminiModel("gemini-2.5-flash"), true);
  assert.equal(isPotentiallyUnavailableLegacyGeminiModel("gemini-3.8-flash"), false);
  assert.equal(isPotentiallyUnavailableLegacyGeminiModel("custom-model"), false);
});

test("every template Gemini node starts with the current Google default", () => {
  const geminiNodes = workflowTemplates.flatMap((template) =>
    template.graph.nodes.filter((node) => node.type === "GEMINI")
  );

  assert.ok(geminiNodes.length > 0);
  for (const node of geminiNodes) {
    assert.equal(node.data.provider, "google");
    assert.equal(node.data.model, "gemini-3.8-flash");
  }
});
