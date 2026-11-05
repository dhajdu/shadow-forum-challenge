import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { describe, it } from "node:test";
import { parseWhoopEvent, verifyWhoopWebhook, whoopWebhookSignature } from "./webhook";

const secret = "client-secret";
const timestamp = "1730764800000";
const body =
  '{"user_id":456,"id":"550e8400-e29b-41d4-a716-446655440000","type":"sleep.updated","trace_id":"e369c784-5100-49e8-8098-75d35c47b31b"}';
const signature = "LfRo3eNhi7h3Vs/T3JHmQmJApmW1ak0VaK8j4JnYTnU=";

describe("WHOOP webhook signature", () => {
  it("accepts the documented HMAC of timestamp + raw body", () => {
    assert.equal(whoopWebhookSignature(timestamp, body, secret), signature);
    assert.equal(
      signature,
      createHmac("sha256", secret).update(timestamp + body).digest("base64")
    );
    assert.equal(
      verifyWhoopWebhook({ timestamp, signature, rawBody: body, secret, now: Number(timestamp) }),
      true
    );
  });

  it("rejects a bad signature, a stale timestamp, and a missing secret", () => {
    assert.equal(
      verifyWhoopWebhook({ timestamp, signature: "not-the-signature", rawBody: body, secret, now: Number(timestamp) }),
      false
    );
    assert.equal(
      verifyWhoopWebhook({
        timestamp,
        signature,
        rawBody: body,
        secret,
        now: Number(timestamp) + 6 * 60 * 1000,
      }),
      false
    );
    assert.equal(verifyWhoopWebhook({ timestamp, signature, rawBody: body, secret: null, now: Number(timestamp) }), false);
  });

  it("parses a v2 event", () => {
    assert.deepEqual(parseWhoopEvent(body), {
      user_id: 456,
      id: "550e8400-e29b-41d4-a716-446655440000",
      type: "sleep.updated",
      trace_id: "e369c784-5100-49e8-8098-75d35c47b31b",
    });
    assert.equal(parseWhoopEvent("not-json"), null);
  });
});
