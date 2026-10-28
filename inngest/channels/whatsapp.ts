import { channel, topic } from "@inngest/realtime";

export const WHATSAPP_CHANNEL_NAME = "whatsapp-execution";

/** Each node gets a separate channel so its status is not broadcast globally. */
export const whatsappChannel = channel(
  ({ workflowId, nodeId }: { workflowId: string; nodeId: string }) =>
    `${WHATSAPP_CHANNEL_NAME}:${workflowId}:${nodeId}`
).addTopic(
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>()
);
