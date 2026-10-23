import type { WorkflowImportFile } from "./import-format";

export type WorkflowTemplate = WorkflowImportFile & {
  description: string;
  integrations: string[];
};

export const workflowTemplates: WorkflowTemplate[] = [
  {
    format: "taskorbit.workflow",
    version: 1,
    name: "Lead intake and follow-up",
    description:
      "Summarize a new form submission with Gemini and send the team a Discord follow-up.",
    integrations: ["Google Forms", "Gemini", "Discord"],
    graph: {
      nodes: [
        {
          id: "lead-form",
          type: "GOOGLE_FORM_TRIGGER",
          position: { x: 0, y: 120 },
          data: {},
        },
        {
          id: "lead-summary",
          type: "GEMINI",
          position: { x: 300, y: 120 },
          data: {
            variableName: "leadSummary",
            model: "gemini-2.0-flash",
            systemPrompt:
              "You are a concise sales operations assistant. Highlight the lead's needs and one useful next step.",
            userPrompt:
              "Summarize this new form submission and recommend a next step: {{json this}}",
          },
        },
        {
          id: "lead-discord",
          type: "DISCORD",
          position: { x: 600, y: 120 },
          data: {
            variableName: "discordMessage",
            webhookUrl: "",
            content: "New lead received. Follow-up summary: {{leadSummary.text}}",
            username: "TaskOrbit",
          },
        },
      ],
      edges: [
        {
          id: "lead-form-summary",
          source: "lead-form",
          target: "lead-summary",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
        {
          id: "lead-summary-discord",
          source: "lead-summary",
          target: "lead-discord",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
      ],
    },
  },
  {
    format: "taskorbit.workflow",
    version: 1,
    name: "Payment receipt alert",
    description:
      "Turn a successful Stripe payment event into a clear WhatsApp notification.",
    integrations: ["Stripe", "WhatsApp"],
    graph: {
      nodes: [
        {
          id: "payment-stripe",
          type: "STRIPE_TRIGGER",
          position: { x: 0, y: 120 },
          data: {},
        },
        {
          id: "payment-whatsapp",
          type: "WHATSAPP",
          position: { x: 320, y: 120 },
          data: {
            variableName: "paymentNotice",
            phoneNumberId: "",
            to: "",
            message:
              "Payment received: {{stripe.amount}} {{stripe.currency}} from customer {{stripe.customerId}}.",
          },
        },
      ],
      edges: [
        {
          id: "payment-stripe-whatsapp",
          source: "payment-stripe",
          target: "payment-whatsapp",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
      ],
    },
  },
  {
    format: "taskorbit.workflow",
    version: 1,
    name: "Project activity digest",
    description:
      "Fetch public repository details, generate a short digest, then share it with the team.",
    integrations: ["Manual Trigger", "HTTP Request", "Gemini", "Discord"],
    graph: {
      nodes: [
        {
          id: "digest-manual",
          type: "MANUAL_TRIGGER",
          position: { x: 0, y: 120 },
          data: {},
        },
        {
          id: "digest-fetch",
          type: "HTTP_REQUEST",
          position: { x: 280, y: 120 },
          data: {
            variableName: "repository",
            endpoint: "https://api.github.com/repos/vercel/next.js",
            method: "GET",
          },
        },
        {
          id: "digest-summary",
          type: "GEMINI",
          position: { x: 560, y: 120 },
          data: {
            variableName: "projectDigest",
            model: "gemini-2.0-flash",
            systemPrompt:
              "You write concise project updates for an engineering team.",
            userPrompt:
              "Summarize the repository name, description, and stars from this data in two sentences: {{json repository.data}}",
          },
        },
        {
          id: "digest-discord",
          type: "DISCORD",
          position: { x: 840, y: 120 },
          data: {
            variableName: "digestMessage",
            webhookUrl: "",
            content: "Project activity digest: {{projectDigest.text}}",
            username: "TaskOrbit",
          },
        },
      ],
      edges: [
        {
          id: "digest-manual-fetch",
          source: "digest-manual",
          target: "digest-fetch",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
        {
          id: "digest-fetch-summary",
          source: "digest-fetch",
          target: "digest-summary",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
        {
          id: "digest-summary-discord",
          source: "digest-summary",
          target: "digest-discord",
          sourceHandle: "source-1",
          targetHandle: "target-1",
        },
      ],
    },
  },
];
