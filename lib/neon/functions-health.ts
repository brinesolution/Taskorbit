type HealthEnvironment = Record<string, string | undefined>;

type FunctionHealthResponse = {
  ok?: unknown;
  service?: unknown;
};

export class NeonFunctionHealthError extends Error {
  constructor() {
    super("Neon Functions health check failed.");
    this.name = "NeonFunctionHealthError";
  }
}

export async function getNeonFunctionHealth(options?: {
  env?: HealthEnvironment;
  fetcher?: typeof fetch;
}): Promise<{ ok: true; service: "neon-functions" }> {
  const env = options?.env ?? process.env;
  const configuredUrl = env.NEON_HELLO_FUNCTION_URL?.trim();
  const healthToken = env.TASKORBIT_FUNCTION_HEALTH_TOKEN;
  if (!configuredUrl || !healthToken?.trim()) {
    throw new NeonFunctionHealthError();
  }

  let functionUrl: URL;
  try {
    functionUrl = new URL(configuredUrl);
  } catch {
    throw new NeonFunctionHealthError();
  }

  if (
    functionUrl.protocol !== "https:" ||
    functionUrl.username ||
    functionUrl.password ||
    functionUrl.hash
  ) {
    throw new NeonFunctionHealthError();
  }

  try {
    const response = await (options?.fetcher ?? fetch)(functionUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${healthToken}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new NeonFunctionHealthError();
    }

    const payload = (await response.json()) as FunctionHealthResponse;
    if (payload.ok !== true || payload.service !== "neon-functions") {
      throw new NeonFunctionHealthError();
    }

    return { ok: true, service: "neon-functions" };
  } catch {
    throw new NeonFunctionHealthError();
  }
}
