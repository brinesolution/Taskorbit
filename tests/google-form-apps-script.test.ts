import assert from "node:assert/strict";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

import { buildGoogleFormAppsScript } from "../features/trigger/google-form-apps-script";

const webhookUrl = "https://taskorbit.example/api/webhooks/google-form?workflowId=workflow-test";
const token = "fake-test-bearer-token";
const fakeResponseBody = "private-response-body-with-secret";

function runScript(statusCode: number) {
  let request: { url: string; options: Record<string, unknown> } | undefined;
  const context = createContext({
    UrlFetchApp: {
      fetch: (url: string, options: Record<string, unknown>) => {
        request = { url, options };
        return { getResponseCode: () => statusCode, getContentText: () => fakeResponseBody };
      },
    },
  }) as { onFormSubmit?: (event?: unknown) => void };
  runInContext(buildGoogleFormAppsScript(webhookUrl, token), context);
  return { handler: context.onFormSubmit!, getRequest: () => request };
}

function formSubmitEvent() {
  return {
    source: { getId: () => "form-test-id", getTitle: () => "Form test" },
    response: {
      getId: () => "response-test-id",
      getTimestamp: () => "2026-01-02T03:04:05.000Z",
      getRespondentEmail: () => "respondent@example.test",
      getItemResponses: () => [{
        getItem: () => ({ getTitle: () => "Favorite color" }),
        getResponse: () => "blue",
      }],
    },
  };
}

test("generated handler tells users to submit the form when run without a trigger event", () => {
  const { handler } = runScript(200);

  assert.throws(() => handler(), /submit the form.*installed trigger/i);
});

test("generated handler preserves the authenticated Google Forms webhook payload", () => {
  const { handler, getRequest } = runScript(200);

  handler(formSubmitEvent());

  const request = getRequest();
  assert.equal(request?.url, webhookUrl);
  assert.equal(request?.options.method, "post");
  assert.equal(request?.options.contentType, "application/json");
  assert.equal((request?.options.headers as { Authorization?: string }).Authorization, `Bearer ${token}`);
  assert.equal(request?.options.muteHttpExceptions, true);
  assert.deepEqual(JSON.parse(request?.options.payload as string), {
    formId: "form-test-id",
    formTitle: "Form test",
    responseId: "response-test-id",
    timestamp: "2026-01-02T03:04:05.000Z",
    respondentEmail: "respondent@example.test",
    responses: { "Favorite color": "blue" },
  });
});

test("generated handler fails safely on a rejected webhook response", () => {
  const { handler } = runScript(401);

  assert.throws(() => handler(formSubmitEvent()), (error: unknown) => {
    const message = String((error as { message?: unknown })?.message ?? error);
    assert.match(message, /HTTP 401/);
    assert.doesNotMatch(message, new RegExp(token));
    assert.doesNotMatch(message, new RegExp(fakeResponseBody));
    assert.doesNotMatch(message, /respondent@example\.test|Favorite color|blue|invalid token/i);
    return true;
  });
});
