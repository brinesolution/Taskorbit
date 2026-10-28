type WorkflowLookup = (query: {
  where: { id: string; userId: string };
  select: { id: true };
}) => Promise<{ id: string } | null>;

type NodeLookup = (query: {
  where: { id: string };
  select: { type: true; workflowId: true };
}) => Promise<{ type: string; workflowId: string } | null>;

/** Verify workflow ownership and reject node IDs already used outside it. */
export async function assertWhatsAppRealtimeNodeAccess(
  nodeId: unknown,
  workflowId: unknown,
  userId: string | null | undefined,
  findWorkflow: WorkflowLookup,
  findNode: NodeLookup
): Promise<void> {
  if (!userId) throw new Error("Not authenticated");
  if (
    typeof workflowId !== "string" || !workflowId.trim() || workflowId.length > 120 ||
    typeof nodeId !== "string" || !nodeId.trim() || nodeId.length > 120
  ) {
    throw new Error("WhatsApp node not found");
  }

  const workflow = await findWorkflow({
    where: { id: workflowId, userId },
    select: { id: true },
  });
  if (!workflow) throw new Error("WhatsApp node not found");

  const node = await findNode({
    where: { id: nodeId },
    select: { type: true, workflowId: true },
  });

  // An unused ID is a newly-created editor node. A used ID must be a WhatsApp
  // node in this exact workflow; this rejects foreign-node collisions.
  if (node && (node.type !== "WHATSAPP" || node.workflowId !== workflowId)) {
    throw new Error("WhatsApp node not found");
  }
}
