type WhatsAppNodeData = Record<string, unknown>;

function hasInlineAccessToken(data: WhatsAppNodeData | null | undefined): boolean {
  return typeof data?.accessToken === "string" && data.accessToken.length > 0;
}

/** Keep legacy inline tokens server-side while exposing only their presence. */
export function getClientSafeWhatsAppNodeData(data: WhatsAppNodeData): WhatsAppNodeData {
  const safe = { ...data };
  const hasLegacyAccessToken = hasInlineAccessToken(safe);
  delete safe.accessToken;
  delete safe.hasLegacyAccessToken;
  if (hasLegacyAccessToken) safe.hasLegacyAccessToken = true;
  return safe;
}

/** Ignore browser-supplied secret fields; retain old secrets until explicitly migrated. */
export function prepareWhatsAppNodeDataForSave(
  nextType: string,
  incoming: WhatsAppNodeData,
  previousType?: string,
  previousData?: WhatsAppNodeData | null
): WhatsAppNodeData {
  const next = { ...incoming };
  if (nextType !== "WHATSAPP") return next;

  delete next.accessToken;
  delete next.hasLegacyAccessToken;

  const usesSavedCredential = typeof incoming.credentialId === "string" && incoming.credentialId.length > 0;
  if (usesSavedCredential) return next;

  if (nextType === previousType && hasInlineAccessToken(previousData)) {
    next.accessToken = previousData!.accessToken;
  }
  return next;
}

/** Mask legacy Discord webhooks before workflow node data leaves the server. */
export function getClientSafeDiscordNodeData(data: WhatsAppNodeData): WhatsAppNodeData {
  const safe = { ...data };
  const hasLegacyWebhook = typeof safe.webhookUrl === "string" && safe.webhookUrl.length > 0;
  delete safe.webhookUrl;
  delete safe.hasLegacyWebhook;
  if (hasLegacyWebhook) safe.hasLegacyWebhook = true;
  return safe;
}

/** Inngest step inputs must never serialize the legacy secret. */
export function prepareWhatsAppNodeDataForExecution(data: WhatsAppNodeData): WhatsAppNodeData {
  const safe = { ...data };
  const hasLegacyAccessToken = hasInlineAccessToken(safe);
  delete safe.accessToken;
  delete safe.hasLegacyAccessToken;
  if (hasLegacyAccessToken) safe.hasLegacyAccessToken = true;
  return safe;
}
