import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { demoLogin, demoMayRequest, isDemoEmail } from "./demo";

describe("demo sign-in", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_DEMO_LOGIN;
  });

  it("is off unless NEXT_PUBLIC_DEMO_LOGIN is set", () => {
    assert.equal(demoLogin(), null);
    assert.equal(isDemoEmail("anyone@example.com"), false);
  });

  it("reads email|password and matches the email in any case", () => {
    process.env.NEXT_PUBLIC_DEMO_LOGIN = " Demo@Example.com | pass-word ";
    assert.deepEqual(demoLogin(), { email: "demo@example.com", password: "pass-word" });
    assert.equal(isDemoEmail("DEMO@example.com"), true);
    assert.equal(isDemoEmail("member@example.com"), false);
    assert.equal(isDemoEmail(null), false);
  });

  it("needs both parts", () => {
    process.env.NEXT_PUBLIC_DEMO_LOGIN = "demo@example.com";
    assert.equal(demoLogin(), null);
  });

  it("lets the demo account read and ask, nothing else", () => {
    assert.equal(demoMayRequest("GET", "/forum"), true);
    assert.equal(demoMayRequest("POST", "/api/ask"), true);
    assert.equal(demoMayRequest("POST", "/me"), false);
    assert.equal(demoMayRequest("DELETE", "/api/account"), false);
    assert.equal(demoMayRequest("POST", "/api/mcp"), false);
  });
});
