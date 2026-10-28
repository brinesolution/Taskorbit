import assert from "node:assert/strict";
import { test } from "node:test";

import { stripeTriggerExecutor } from "../features/trigger/components/stripe-trigger/executor";

test("Stripe trigger preserves context without creating a nested Inngest step", async () => {
  const context = { event: { id: "evt_test", amount: 42 } };
  const statuses: string[] = [];

  const result = await stripeTriggerExecutor({
    data: {},
    nodeId: "stripe-node",
    workflowOwnerId: "owner",
    context,
    step: {
      run: () => {
        throw new Error("Nested step.run is unsupported");
      },
    },
    publish: async (event: Promise<{ data: { status: string } }>) => {
      statuses.push((await event).data.status);
    },
  } as never);

  assert.deepEqual(result, context);
  assert.deepEqual(statuses, ["loading", "success"]);
});
