import Handlebars from "handlebars";
import { NonRetriableError } from "inngest";

import type { NodeExecutor } from "@/features/exections/types";
import { httpRequestChannel } from "@/inngest/channels/http-request";
import { requestSafeHttp } from "./http-request/safe-url";

Handlebars.registerHelper("json", (context) => {
  const jsonString = JSON.stringify(context, null, 2);
  return new Handlebars.SafeString(jsonString);
});

type HttpRequestData = {
  variableName?: string;
  endpoint?: string;
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: string;
};

export const httpRequestExecutor: NodeExecutor<HttpRequestData> = async ({
  data,
  nodeId,
  context,
  step,
  publish,
}) => {
  await publish(
    httpRequestChannel().status({
      nodeId,
      status: "loading",
    })
  );

  if (!data.endpoint) {
    await publish(
      httpRequestChannel().status({
        nodeId,
        status: "error",
      })
    );

    throw new NonRetriableError(
      "HTTP Request node: No endpoint configured"
    );
  }

  if (!data.method) {
    await publish(
      httpRequestChannel().status({
        nodeId,
        status: "error",
      })
    );

    throw new NonRetriableError(
      "HTTP Request node: Method not configured"
    );
  }

  if (!data.variableName) {
    await publish(
      httpRequestChannel().status({
        nodeId,
        status: "error",
      })
    );

    throw new NonRetriableError(
      "HTTP Request node: Variable name not configured"
    );
  }

  const endpointTemplate = data.endpoint;
  const method = data.method;
  const variableName = data.variableName;
  const bodyTemplate = data.body;

  const result = await step.run("http-request", async () => {
    const renderedEndpoint = Handlebars.compile(endpointTemplate)(context);
    let resolvedBody: string | undefined;
    if (["POST", "PUT", "PATCH"].includes(method)) {
      resolvedBody = Handlebars.compile(
        bodyTemplate || "{}"
      )(context);

      JSON.parse(resolvedBody);
    }

    let response;
    try {
      response = await requestSafeHttp(renderedEndpoint, method, resolvedBody);
    } catch (error) {
      throw new NonRetriableError(
        error instanceof Error ? error.message : "HTTP Request node: Unsafe endpoint"
      );
    }

    const responseData = response.contentType?.includes("application/json")
      ? JSON.parse(response.body)
      : response.body;

    return {
      status: response.status,
      statusText: response.statusText,
      data: responseData,
    };
  });

  await publish(
    httpRequestChannel().status({
      nodeId,
      status: "success",
    })
  );

  return {
    ...context,
    [variableName]: result,
  };
};
