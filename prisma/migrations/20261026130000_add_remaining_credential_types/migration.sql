-- Add the credential types present in the Prisma schema but missing from the
-- original CredentialType enum migration. IF NOT EXISTS handles databases
-- where any of these values were added manually.
ALTER TYPE "CredentialType" ADD VALUE IF NOT EXISTS 'DISCORD';
ALTER TYPE "CredentialType" ADD VALUE IF NOT EXISTS 'WHATSAPP';
ALTER TYPE "CredentialType" ADD VALUE IF NOT EXISTS 'STRIPE';
