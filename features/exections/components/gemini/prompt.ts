type GeminiPromptData = {
  prompt?: string;
  userPrompt?: string;
};

/** Prefer the editable canonical field while retaining support for legacy nodes. */
export const resolveGeminiPrompt = (data: GeminiPromptData): string =>
  data.prompt ?? data.userPrompt ?? "";
