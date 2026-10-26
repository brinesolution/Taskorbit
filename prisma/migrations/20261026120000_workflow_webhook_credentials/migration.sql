CREATE TYPE "WebhookProvider" AS ENUM ('STRIPE', 'GOOGLE_FORM');

CREATE TABLE "WorkflowWebhookCredential" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "provider" "WebhookProvider" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowWebhookCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WorkflowWebhookCredential_workflowId_provider_key"
ON "WorkflowWebhookCredential"("workflowId", "provider");
CREATE INDEX "WorkflowWebhookCredential_workflowId_idx"
ON "WorkflowWebhookCredential"("workflowId");

ALTER TABLE "WorkflowWebhookCredential"
ADD CONSTRAINT "WorkflowWebhookCredential_workflowId_fkey"
FOREIGN KEY ("workflowId") REFERENCES "Workflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
