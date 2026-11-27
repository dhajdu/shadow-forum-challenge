"use client";

import { useEffect } from "react";

export const LAST_VISIT_COOKIE = "sf_last_visit";

// Remembers this visit, so the next Home view can show what is new since now.
export function MarkVisit() {
  useEffect(() => {
    document.cookie = `${LAST_VISIT_COOKIE}=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return null;
}
