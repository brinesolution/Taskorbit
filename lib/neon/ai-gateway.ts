import { neon } from "@neon/ai-sdk-provider";

export const DEFAULT_NEON_GEMINI_MODEL = "gemini-3-flash";

export type NeonGatewayModelInfo = {
  id: string;
  name: string;
};

type GatewayEnvironment = Record<string, string | undefined>;

type GatewayModelResponse = {
  data?: Array<{
    id?: unknown;
    name?: unknown;
    enabled?: unknown;
  }>;
};

function getGatewayConfig(env: GatewayEnvironment) {
  const token = env.NEON_AI_GATEWAY_TOKEN?.trim();
  const baseUrl = env.NEON_AI_GATEWAY_BASE_URL?.trim().replace(/\/+$/, "");

  if (!token || !baseUrl) {
    throw new Error(
      "Neon AI Gateway is not configured. Run `neon deploy` and make sure NEON_AI_GATEWAY_TOKEN and NEON_AI_GATEWAY_BASE_URL are available to the server."
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(baseUrl);
  } catch {
    throw new Error("Neon AI Gateway base URL is invalid.");
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.pathname !== "/") {
    throw new Error("Neon AI Gateway base URL must be an HTTPS host without a path.");
  }

  return { token, baseUrl };
}

export function getNeonGeminiModel(
  modelId: string = DEFAULT_NEON_GEMINI_MODEL,
  env: GatewayEnvironment = process.env
) {
  if (!modelId.trim()) {
    throw new Error("Choose a Gemini model from the Neon AI Gateway catalog.");
  }

  // Validate the injected server credentials before the provider is created.
  getGatewayConfig(env);
  return neon(modelId.trim());
}

export async function listNeonGeminiModels(options?: {
  env?: GatewayEnvironment;
  fetcher?: typeof fetch;
}): Promise<NeonGatewayModelInfo[]> {
  const { token, baseUrl } = getGatewayConfig(options?.env ?? process.env);
  const fetcher = options?.fetcher ?? fetch;
  const response = await fetcher(`${baseUrl}/v1/models`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Neon AI Gateway model catalog request failed (HTTP ${response.status}).`);
  }

  const payload = (await response.json()) as GatewayModelResponse;
  return (payload.data ?? [])
    .filter(
      (model): model is { id: string; name?: string; enabled: true } =>
        typeof model.id === "string" &&
        model.id.toLowerCase().startsWith("gemini-") &&
        model.enabled === true
    )
    .map((model) => ({
      id: model.id,
      name: typeof model.name === "string" ? model.name : model.id,
    }));
}
