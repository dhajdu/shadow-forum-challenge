"use client";

import { useEffect } from "react";

import { SIGN_PROMPT_COOKIE } from "@/app/_data/cookies";

// Home sends a member who hasn't signed here once per browser session (their next login);
// this cookie, with no max-age, says it already happened.
export function MarkPrompted({ version }: { version: number }) {
  useEffect(() => {
    document.cookie = `${SIGN_PROMPT_COOKIE}=${version}; path=/; samesite=lax`;
  }, [version]);
  return null;
}
