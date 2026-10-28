type TRPCUrlEnvironment = {
  isServer: boolean;
  vercelUrl?: string;
  appUrl?: string;
  nodeEnv?: string;
  port?: string;
  nextPhase?: string;
};

const endpoint = "/api/trpc";

function parseOrigin(value: string, defaultProtocol?: "https:"): string | undefined {
  const candidate = defaultProtocol && !/^https?:\/\//i.test(value)
    ? `${defaultProtocol}//${value}`
    : value;

  try {
    const parsed = new URL(candidate);
    if (
      (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.search ||
      parsed.hash
    ) {
      return undefined;
    }

    return parsed.origin;
  } catch {
    return undefined;
  }
}

export function resolveTRPCUrl(environment: TRPCUrlEnvironment): string {
  if (!environment.isServer) return endpoint;

  // VERCEL_URL is supplied by Vercel for this deployment. Do not derive the
  // server-side destination from request Host headers, which are untrusted.
  const deploymentOrigin = environment.vercelUrl
    ? parseOrigin(environment.vercelUrl, "https:")
    : undefined;
  const configuredOrigin = environment.appUrl
    ? parseOrigin(environment.appUrl)
    : undefined;

  if (environment.appUrl && !configuredOrigin && !deploymentOrigin) {
    throw new Error("NEXT_PUBLIC_APP_URL must be a valid HTTP(S) origin for server-side tRPC requests.");
  }

  const origin = deploymentOrigin ?? configuredOrigin;
  if (origin) return new URL(endpoint, origin).toString();

  if (
    environment.nodeEnv !== "production" ||
    environment.nextPhase === "phase-production-build"
  ) {
    const port = environment.port ?? "3000";
    if (!/^\d{1,5}$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error("PORT must be a valid TCP port for local server-side tRPC requests.");
    }
    return `http://localhost:${Number(port)}${endpoint}`;
  }

  throw new Error(
    "Server-side tRPC requests need an absolute server origin. Configure VERCEL_URL or NEXT_PUBLIC_APP_URL."
  );
}
