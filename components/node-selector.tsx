"use client";

import { nanoid } from "nanoid";
import {
  FileTextIcon,
  GlobeIcon,
  MousePointerClickIcon,
  SendIcon,
  SparklesIcon,
  MessageCircleIcon,
  CreditCardIcon,
} from "lucide-react";
import { useSetAtom } from "jotai";
import type { Node } from "@xyflow/react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { editorAtom } from "@/features/editor/store/atoms";

const NodeType = {
  MANUAL_TRIGGER: "MANUAL_TRIGGER",
  GOOGLE_FORM_TRIGGER: "GOOGLE_FORM_TRIGGER",
  STRIPE_TRIGGER: "STRIPE_TRIGGER",
  HTTP_REQUEST: "HTTP_REQUEST",
  GEMINI: "GEMINI",
  DISCORD: "DISCORD",
  WHATSAPP: "WHATSAPP",
} as const;

type NodeTypeValue =
  (typeof NodeType)[keyof typeof NodeType];

type NodeOption = {
  type: NodeTypeValue;
  name: string;
  description: string;
  icon: React.ElementType;
};

const nodeOptions: NodeOption[] = [
  {
    type: NodeType.MANUAL_TRIGGER,
    name: "Manual Trigger",
    description: "Run workflow manually",
    icon: MousePointerClickIcon,
  },
  {
    type: NodeType.GOOGLE_FORM_TRIGGER,
    name: "Google Form",
    description: "Trigger when form is submitted",
    icon: FileTextIcon,
  },
  {
    type: NodeType.STRIPE_TRIGGER,
    name: "Stripe",
    description: "Trigger from Stripe event",
    icon: CreditCardIcon,
  },
  {
    type: NodeType.HTTP_REQUEST,
    name: "HTTP Request",
    description: "Send API request",
    icon: GlobeIcon,
  },
  {
    type: NodeType.GEMINI,
    name: "Gemini",
    description: "Generate AI response",
    icon: SparklesIcon,
  },
  {
    type: NodeType.DISCORD,
    name: "Discord",
    description: "Send Discord message",
    icon: SendIcon,
  },
  {
    type: NodeType.WHATSAPP,
    name: "WhatsApp",
    description: "Send WhatsApp message",
    icon: MessageCircleIcon,
  },
];

type NodeSelectorProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const NodeSelector = ({
  open,
  onOpenChange,
}: NodeSelectorProps) => {
  const setEditor = useSetAtom(editorAtom);

  const handleAddNode = (type: NodeTypeValue) => {
    const newNode: Node = {
      id: nanoid(),
      type,
      position: { x: 0, y: 0 },
      data: {},
    };

    setEditor((currentEditor) => {
      if (!currentEditor) return currentEditor;

      const flowElement = document.querySelector<HTMLElement>(".react-flow");
      const bounds = flowElement?.getBoundingClientRect();
      const center = bounds
        ? {
            x: bounds.left + bounds.width / 2,
            y: bounds.top + bounds.height / 2,
          }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 };

      currentEditor.addNodes({
        ...newNode,
        position: currentEditor.screenToFlowPosition(center),
      });
      return currentEditor;
    });

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Node</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          {nodeOptions.map((option) => {
            const Icon = option.icon;

            return (
              <button
                key={option.type}
                type="button"
                className="group flex w-full items-center gap-3 rounded-xl bg-card p-4 text-left text-card-foreground ring-1 ring-foreground/10 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => handleAddNode(option.type)}
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
                  <Icon aria-hidden="true" className="size-5" />
                </span>

                <span className="min-w-0">
                  <span className="block font-medium">{option.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
};
