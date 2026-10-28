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

type SafeHttpRequest = typeof requestSafeHttp;

const isEndpointValidationError = (message: string) =>
  message.startsWith("Endpoint must ") ||
  message.startsWith("Endpoint host ");

const isJsonContentType = (contentType?: string) => {
  const mediaType = contentType?.split(";", 1)[0].trim().toLowerCase();
  return Boolean(
    mediaType &&
      (mediaType === "application/json" ||
        (mediaType.startsWith("application/") && mediaType.endsWith("+json")))
  );
};

/** Injectable so executor behavior can be tested without making network calls. */
export function createHttpRequestExecutor(
  request: SafeHttpRequest = requestSafeHttp
): NodeExecutor<HttpRequestData> {
  return async ({ data, nodeId, context, publish }) => {
    await publish(httpRequestChannel().status({ nodeId, status: "loading" }));

    try {
      if (!data.endpoint) {
        throw new NonRetriableError("HTTP Request node: No endpoint configured");
      }
      if (!data.method) {
        throw new NonRetriableError("HTTP Request node: Method not configured");
      }
      if (!data.variableName) {
        throw new NonRetriableError("HTTP Request node: Variable name not configured");
      }

      let renderedEndpoint: string;
      try {
        renderedEndpoint = Handlebars.compile(data.endpoint)(context);
      } catch {
        throw new NonRetriableError(
          "HTTP Request node: Endpoint template could not be rendered. Check its variables."
        );
      }

      let resolvedBody: string | undefined;
      if (["POST", "PUT", "PATCH"].includes(data.method)) {
        try {
          resolvedBody = Handlebars.compile(data.body || "{}")(context);
          JSON.parse(resolvedBody);
        } catch {
          throw new NonRetriableError(
            "HTTP Request node: Request body must render to valid JSON."
          );
        }
      }

      let response;
      try {
        response = await request(renderedEndpoint, data.method, resolvedBody);
      } catch (error) {
        const message = error instanceof Error ? error.message : "";
        if (isEndpointValidationError(message)) {
          throw new NonRetriableError(`HTTP Request node: ${message}`);
        }
        throw new NonRetriableError(
          "HTTP Request node: Could not reach the endpoint. Check the URL, DNS, and service availability."
        );
      }

      if (response.status < 200 || response.status >= 300) {
        throw new NonRetriableError(
          `HTTP Request node: Request failed with HTTP ${response.status}. Check the endpoint and request configuration.`
        );
      }

      let responseData: unknown;
      try {
        responseData = response.body.length === 0
          ? null
          : isJsonContentType(response.contentType)
          ? JSON.parse(response.body)
          : response.body;
      } catch {
        throw new NonRetriableError(
          "HTTP Request node: Response contained invalid JSON. Check the endpoint response format."
        );
      }

      const result = {
        status: response.status,
        statusText: response.statusText,
        data: responseData,
      };

      await publish(httpRequestChannel().status({ nodeId, status: "success" }));
      return { ...context, [data.variableName]: result };
    } catch (error) {
      await publish(httpRequestChannel().status({ nodeId, status: "error" }));
      if (error instanceof NonRetriableError) throw error;
      throw new NonRetriableError(
        "HTTP Request node: Request failed. Check the endpoint and request configuration."
      );
    }
  };
}

export const httpRequestExecutor = createHttpRequestExecutor();
