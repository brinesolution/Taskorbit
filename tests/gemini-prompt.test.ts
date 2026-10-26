import assert from "node:assert/strict";
import test from "node:test";

import { resolveGeminiPrompt } from "../features/exections/components/gemini/prompt";

test("canonical Gemini prompt takes precedence over a legacy prompt", () => {
  assert.equal(
    resolveGeminiPrompt({ prompt: "edited canonical", userPrompt: "old legacy" }),
    "edited canonical"
  );
});

test("legacy Gemini prompt initializes nodes that do not have a canonical prompt", () => {
  assert.equal(resolveGeminiPrompt({ userPrompt: "legacy prompt" }), "legacy prompt");
});

test("missing Gemini prompt defaults to an empty string", () => {
  assert.equal(resolveGeminiPrompt({}), "");
});
