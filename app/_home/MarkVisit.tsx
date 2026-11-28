"use client";

import { useEffect } from "react";

import { LAST_VISIT_COOKIE } from "@/app/_data/cookies";

// Remembers this visit, so the next Home view can show what is new since now.
export function MarkVisit() {
  useEffect(() => {
    document.cookie = `${LAST_VISIT_COOKIE}=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}
