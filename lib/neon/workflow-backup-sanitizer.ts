/** Removes direct credentials from backup data without changing import/export behavior. */
export function sanitizeWorkflowBackupValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeWorkflowBackupValue);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => {
      const normalized = key.toLowerCase().replaceAll(/[^a-z0-9]/g, "");
      const isSecret =
        normalized.includes("token") ||
        normalized.includes("secret") ||
        normalized.includes("password") ||
        normalized.includes("apikey") ||
        normalized.includes("authorization");

      return isSecret ? [] : [[key, sanitizeWorkflowBackupValue(nested)]];
    })
  );
}
