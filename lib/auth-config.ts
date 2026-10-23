export const requiredAuthEnvironment = [
  "DATABASE_URL",
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
] as const;

export type AuthEnvironment = Record<string, string | undefined>;

export type AuthSetupStatus = {
  ready: boolean;
  missing: string[];
  providers: {
    github: boolean;
    google: boolean;
  };
};

export function getAuthSetupStatus(
  environment: AuthEnvironment,
): AuthSetupStatus {
  const hasValue = (key: string) => Boolean(environment[key]?.trim());
  const missing = requiredAuthEnvironment.filter((key) => !hasValue(key));

  return {
    ready: missing.length === 0,
    missing,
    providers: {
      github:
        hasValue("GITHUB_CLIENT_ID") && hasValue("GITHUB_CLIENT_SECRET"),
      google:
        hasValue("GOOGLE_CLIENT_ID") && hasValue("GOOGLE_CLIENT_SECRET"),
    },
  };
}
