export const DEFAULT_GOOGLE_GEMINI_MODEL = "gemini-3.8-flash";

export const GOOGLE_GEMINI_MODEL_OPTIONS = [
  { id: DEFAULT_GOOGLE_GEMINI_MODEL, name: "Gemini 3.8 Flash (recommended)" },
  { id: "gemini-3.5-flash-lite", name: "Gemini 3.5 Flash-Lite" },
] as const;

export const GOOGLE_GEMINI_PRICING_URL =
  "https://ai.google.dev/gemini-api/docs/pricing";

export const isPotentiallyUnavailableLegacyGeminiModel = (
  modelId: string | undefined,
): boolean => /^gemini-2\.(?:0|5)(?:-|$)/i.test(modelId?.trim() ?? "");

export const createGoogleGeminiModel = <TModel>(
  modelId: string | undefined,
  createModel: (id: string) => TModel,
): TModel => createModel(modelId?.trim() || DEFAULT_GOOGLE_GEMINI_MODEL);
