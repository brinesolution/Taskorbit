import type { NodeExecutor } from "@/features/exections/types";
import { stripeTriggerChannel } from "@/inngest/channels/stripe-trigger";

type StripeTriggerData = Record<string, unknown>;

export const stripeTriggerExecutor: NodeExecutor<
  StripeTriggerData
> = async ({
  nodeId,
  context,
  publish,
}) => {
  await publish(
    stripeTriggerChannel().status({
      nodeId,
      status: "loading",
    })
  );

  await publish(
    stripeTriggerChannel().status({
      nodeId,
      status: "success",
    })
  );

  return context;
};
