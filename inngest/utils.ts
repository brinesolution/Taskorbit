import { inngest } from "./client";

type Node = {
  id: string;
  type: string;
  data: unknown;
  position?: unknown;
};

type Connection = {
  id?: string;
  fromNodeId?: string;
  toNodeId?: string;
  source?: string;
  target?: string;
  fromOutput?: string | null;
  toInput?: string | null;
};

const triggerTypes = new Set([
  "MANUAL_TRIGGER",
  "GOOGLE_FORM_TRIGGER",
  "STRIPE_TRIGGER",
]);

type ExecutionSource = {
  triggerNodeId?: unknown;
  initialData?: unknown;
  input?: unknown;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const requireUniqueTrigger = <T extends { id: string }>(
  triggers: T[],
  label: string,
): T => {
  if (triggers.length === 0) {
    throw new Error(`Workflow has no ${label} trigger node.`);
  }
  if (triggers.length > 1) {
    throw new Error(`Workflow has multiple ${label} trigger nodes. Keep only one before running this workflow.`);
  }
  return triggers[0];
};

const hasGoogleFormData = (source: ExecutionSource) => {
  if (isRecord(source.initialData) && "googleForm" in source.initialData) return true;
  return Object.prototype.hasOwnProperty.call(source, "input");
};

const hasStripeData = (source: ExecutionSource) =>
  isRecord(source.initialData) && "stripe" in source.initialData;

const getInitialData = (source: ExecutionSource): Record<string, unknown> => {
  const initialData = isRecord(source.initialData) ? source.initialData : {};
  if ("googleForm" in initialData || !hasGoogleFormData(source)) {
    return initialData;
  }
  const legacyInput = source.input;
  const googleForm = isRecord(legacyInput)
    ? { ...legacyInput, raw: legacyInput }
    : { raw: legacyInput };
  return {
    ...initialData,
    googleForm,
  };
};

const resolveTrigger = (nodes: Node[], source: ExecutionSource) => {
  const form = hasGoogleFormData(source);
  const stripe = hasStripeData(source);
  if (form && stripe) {
    throw new Error("Execution event has both Google Forms and Stripe data; its trigger source is ambiguous.");
  }

  const inferredType = form
    ? "GOOGLE_FORM_TRIGGER"
    : stripe
      ? "STRIPE_TRIGGER"
      : "MANUAL_TRIGGER";
  const triggerId = typeof source.triggerNodeId === "string" ? source.triggerNodeId : undefined;

  if (source.triggerNodeId !== undefined && !triggerId) {
    throw new Error("Execution triggerNodeId must be a valid trigger node ID.");
  }

  if (triggerId) {
    const trigger = nodes.find((node) => node.id === triggerId);
    if (!trigger) {
      throw new Error(`Execution trigger node ${triggerId} was not found in this workflow.`);
    }
    if (!triggerTypes.has(trigger.type)) {
      throw new Error(`Execution source node ${triggerId} must identify a trigger node.`);
    }
    if ((form || stripe) && trigger.type !== inferredType) {
      throw new Error(`Execution trigger ${triggerId} does not match the ${form ? "Google Forms" : "Stripe"} event payload.`);
    }
    if (trigger.type === "GOOGLE_FORM_TRIGGER" && !form) {
      throw new Error(`Google Forms trigger ${triggerId} requires Google Forms event data.`);
    }
    if (trigger.type === "STRIPE_TRIGGER" && !stripe) {
      throw new Error(`Stripe trigger ${triggerId} requires Stripe event data.`);
    }
    return trigger;
  }

  const candidates = nodes.filter((node) => node.type === inferredType);
  if (candidates.length === 0) {
    throw new Error(`Workflow has no ${inferredType} trigger for this event.`);
  }
  if (candidates.length > 1) {
    throw new Error(`Legacy event is ambiguous: workflow has multiple ${inferredType} triggers. Queue a new event with triggerNodeId.`);
  }
  return candidates[0];
};

export const planWorkflowExecution = (
  nodes: Node[],
  connections: Connection[],
  source: ExecutionSource,
): { triggerNode: Node; nodes: Node[]; initialData: Record<string, unknown> } => {
  const nodeById = new Map<string, Node>();
  for (const node of nodes) {
    if (!node.id || nodeById.has(node.id)) {
      throw new Error(`Workflow contains a missing or duplicate node ID: ${node.id || "(empty)"}.`);
    }
    nodeById.set(node.id, node);
  }

  const triggerNode = resolveTrigger(nodes, source);
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  const incoming = new Map(nodes.map((node) => [node.id, new Set<string>()]));

  for (const connection of connections) {
    const sourceId = connection.fromNodeId ?? connection.source;
    const targetId = connection.toNodeId ?? connection.target;

    if (!sourceId || !targetId) {
      throw new Error("Workflow contains a connection with a missing source or target node ID.");
    }
    if (!nodeById.has(sourceId) || !nodeById.has(targetId)) {
      throw new Error(`Connection ${sourceId} → ${targetId} references a missing node. Reconnect or remove this edge.`);
    }
    if (
      triggerTypes.has(nodeById.get(targetId)!.type) &&
      nodeById.get(sourceId)!.type !== "INITIAL"
    ) {
      throw new Error(`Trigger node ${targetId} has an incoming connection. Trigger nodes must start their own branch.`);
    }

    adjacency.get(sourceId)!.add(targetId);
    incoming.get(targetId)!.add(sourceId);
  }

  // Validate the whole stored graph, including inactive branches, so malformed
  // or cyclic edges cannot be silently hidden by trigger-specific filtering.
  const indegree = new Map(nodes.map((node) => [node.id, incoming.get(node.id)!.size]));
  const ready = nodes.filter((node) => indegree.get(node.id) === 0).map((node) => node.id);
  const orderedIds: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    orderedIds.push(id);
    for (const target of adjacency.get(id)!) {
      const nextDegree = indegree.get(target)! - 1;
      indegree.set(target, nextDegree);
      if (nextDegree === 0) ready.push(target);
    }
  }
  if (orderedIds.length !== nodes.length) {
    const cyclicIds = nodes.filter((node) => indegree.get(node.id)! > 0).map((node) => node.id);
    throw new Error(`Workflow contains a cycle involving nodes ${cyclicIds.join(", ")}. Remove a connection to continue.`);
  }

  const reachableFrom = (startId: string) => {
    const reached = new Set<string>();
    const pending = [startId];
    while (pending.length) {
      const id = pending.pop()!;
      if (reached.has(id)) continue;
      reached.add(id);
      for (const target of adjacency.get(id)!) pending.push(target);
    }
    return reached;
  };

  const allTriggerReachable = new Set<string>();
  for (const trigger of nodes.filter((node) => triggerTypes.has(node.type))) {
    for (const id of reachableFrom(trigger.id)) allTriggerReachable.add(id);
  }
  const orphanActions = nodes.filter((node) =>
    node.type !== "INITIAL" && !triggerTypes.has(node.type) && !allTriggerReachable.has(node.id),
  );
  if (orphanActions.length) {
    throw new Error(`Action node${orphanActions.length > 1 ? "s are" : " is"} not reachable from any trigger: ${orphanActions.map((node) => node.id).join(", ")}. Connect ${orphanActions.length > 1 ? "them" : "it"} to a trigger.`);
  }

  const selectedIds = reachableFrom(triggerNode.id);
  const selectedActions = nodes.filter((node) =>
    selectedIds.has(node.id) && node.type !== "INITIAL" && !triggerTypes.has(node.type),
  );
  if (!selectedActions.length) {
    throw new Error(`No action nodes are connected to the ${triggerNode.type} trigger ${triggerNode.id}. Connect this trigger to an action.`);
  }

  return {
    triggerNode,
    nodes: orderedIds
      .filter((id) => selectedIds.has(id))
      .map((id) => nodeById.get(id)!)
      .filter((node) => node.type !== "INITIAL"),
    initialData: getInitialData(source),
  };
};

export const sendWorkflowExecution = async (data: {
  workflowId: string;
  [key: string]: unknown;
}) => {
  return inngest.send({
    name: "workflows/execute.workflow",
    data,
  });
};
