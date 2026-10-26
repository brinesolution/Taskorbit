"use client";

import {
  useReactFlow,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { memo, useState } from "react";

import { BaseExecutionNode } from "../base-execution-node";
import { useNodeStatus } from "../../hooks/use-node-status";

import {
  GeminiDialog,
  type GeminiFormValues,
} from "./dailog";

import { fetchGeminiRealtimeToken } from "./actions";
import { GEMINI_CHANNEL_NAME } from "@/inngest/channels/gemini";
import { resolveGeminiPrompt } from "./prompt";

type GeminiNodeData = {
  provider?: "google" | "neon";
  credentialId?: string;
  variableName?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  prompt?: string;
};

type GeminiNodeType = Node<GeminiNodeData>;

export const GeminiNode = memo(
  (props: NodeProps<GeminiNodeType>) => {
    const [dialogOpen, setDialogOpen] =
      useState(false);

    const { setNodes } = useReactFlow();

    const nodeStatus = useNodeStatus({
      nodeId: props.id,
      channel: GEMINI_CHANNEL_NAME,
      topic: "status",
      refreshToken: fetchGeminiRealtimeToken,
    });

    const handleSubmit = (
      values: GeminiFormValues
    ) => {
      setNodes((nodes) =>
        nodes.map((node) => {
          if (node.id !== props.id) {
            return node;
          }

          return {
            ...node,
            data: {
              ...node.data,
              ...values,
            },
          };
        })
      );
    };

    const nodeData = props.data;
    const provider = nodeData.provider ?? "google";
    const prompt = resolveGeminiPrompt(nodeData);
    const model =
      nodeData.model ??
      (provider === "neon" ? "Neon Gemini model" : "gemini-2.5-flash");

    const description = prompt
      ? `${model}${provider === "neon" ? " via Neon" : ""}: ${prompt.slice(
          0,
          50
        )}${prompt.length > 50 ? "..." : ""}`
      : "Not configured";

    return (
      <>
        <GeminiDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSubmit={handleSubmit}
          defaultValues={
            nodeData as Partial<GeminiFormValues>
          }
        />

        <BaseExecutionNode
          {...props}
          id={props.id}
          icon="/logos/gemini.svg"
          name={provider === "neon" ? "Gemini via Neon" : "Gemini"}
          description={description}
          status={nodeStatus}
          onSettings={() =>
            setDialogOpen(true)
          }
          onDoubleClick={() =>
            setDialogOpen(true)
          }
        />
      </>
    );
  }
);

GeminiNode.displayName = "GeminiNode";
