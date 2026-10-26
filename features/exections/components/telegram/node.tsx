"use client";

import { useReactFlow, type Node, type NodeProps } from "@xyflow/react";
import { memo, useState } from "react";

import { BaseExecutionNode } from "../base-execution-node";
import { TelegramDialog, type TelegramFormValues } from "./dailog";

type TelegramNodeData = {
  credentialId?: string;
  chatId?: string;
  text?: string;
  variableName?: string;
};

type TelegramNodeType = Node<TelegramNodeData>;

export const TelegramNode = memo((props: NodeProps<TelegramNodeType>) => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { setNodes } = useReactFlow();
  const nodeData = props.data;

  const handleSubmit = (values: TelegramFormValues) => {
    const { variableName, ...valuesWithoutVariableName } = values;
    const data = variableName.trim()
      ? values
      : valuesWithoutVariableName;

    setNodes((nodes) => nodes.map((node) => node.id === props.id
      ? { ...node, data: { ...node.data, ...data } }
      : node));
    setDialogOpen(false);
  };

  const description = nodeData?.text
    ? `Send: ${nodeData.text.slice(0, 50)}${nodeData.text.length > 50 ? "..." : ""}`
    : "Not configured";

  return (
    <>
      <TelegramDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={handleSubmit}
        defaultValues={nodeData}
      />
      <BaseExecutionNode
        {...props}
        id={props.id}
        icon="/logos/telegram.svg"
        name="Telegram"
        description={description}
        status="initial"
        onSettings={() => setDialogOpen(true)}
        onDoubleClick={() => setDialogOpen(true)}
      />
    </>
  );
});

TelegramNode.displayName = "TelegramNode";
