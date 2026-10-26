"use client";

import type { ReactNode } from "react";
import {
  NodeToolbar,
  Position,
} from "@xyflow/react";
import {
  SettingsIcon,
  TrashIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";

interface WorkflowNodeProps {
  children: ReactNode;
  showToolbar?: boolean;
  onDelete?: () => void;
  onSettings?: () => void;
  name?: string;
  description?: string;
}

export function WorkflowNode({
  children,
  showToolbar,
  onDelete,
  onSettings,
  name,
  description,
}: WorkflowNodeProps) {
  return (
    <>
      {showToolbar && (onSettings || onDelete) && (
        <NodeToolbar>
          {onSettings && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Configure ${name ?? "workflow step"}`}
              title={`Configure ${name ?? "workflow step"}`}
              onClick={onSettings}
            >
              <SettingsIcon aria-hidden="true" className="size-4" />
            </Button>
          )}

          {onDelete && (
            <Button
              size="sm"
              variant="ghost"
              aria-label={`Delete ${name ?? "workflow step"}`}
              title={`Delete ${name ?? "workflow step"}`}
              onClick={onDelete}
            >
              <TrashIcon aria-hidden="true" className="size-4" />
            </Button>
          )}
        </NodeToolbar>
      )}

      {children}

      {name && (
        <NodeToolbar
          position={Position.Bottom}
          isVisible
          className="max-w-[200px] text-center"
        >
          <p className="font-medium">
            {name}
          </p>

          {description && (
            <p className="text-xs text-muted-foreground">
              {description}
            </p>
          )}
        </NodeToolbar>
      )}
    </>
  );
}
