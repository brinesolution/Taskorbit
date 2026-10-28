"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { useParams } from "next/navigation";
import { memo, useState } from "react";

import { BaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "@/features/exections/hooks/use-node-status";
import { whatsappChannel } from "@/inngest/channels/whatsapp";
import { fetchWhatsAppRealtimeToken } from "./actions";
import { WhatsAppDialog, type WhatsAppFormValues } from "./dailog";

type WhatsAppNodeData = {
  credentialId?: string;
  hasLegacyAccessToken?: boolean;
  accessToken?: string;
  phoneNumberId?: string;
  to?: string;
  message?: string;
  variableName?: string;
};

type WhatsAppNodeType = Node<WhatsAppNodeData>;

export const WhatsAppNode = memo((props: NodeProps<WhatsAppNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const { workflowId } = useParams<{ workflowId: string }>();
  const nodeData = props.data;

  const nodeStatus = useNodeStatus({
    nodeId: props.id,
    channel: whatsappChannel({ nodeId: props.id, workflowId }).name,
    topic: "status",
    refreshToken: () => fetchWhatsAppRealtimeToken(props.id, workflowId),
  });

  const handleSubmit = (values: WhatsAppFormValues) => {
    setNodes((nodes) => nodes.map((node) => {
      if (node.id !== props.id) return node;
      const nextData = { ...node.data } as WhatsAppNodeData;
      // Saving a new owner-scoped credential retires the old inline token.
      delete nextData.accessToken;
      delete nextData.hasLegacyAccessToken;
      return { ...node, data: { ...nextData, ...values } };
    }));
    setDialogOpen(false);
  };

  const description = nodeData?.message
    ? `Send: ${nodeData.message.slice(0, 50)}${nodeData.message.length > 50 ? "..." : ""}`
    : "Not configured";

  return (
    <>
      <WhatsAppDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
        hasLegacyAccessToken={Boolean(nodeData?.hasLegacyAccessToken)}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/whatsapp.svg"
        name="WhatsApp"
        description={description}
        status={nodeStatus}
        onSettings={() => setDialogOpen(true)}
        onDoubleClick={() => setDialogOpen(true)}
      />
    </>
  );
});

WhatsAppNode.displayName = "WhatsAppNode";
