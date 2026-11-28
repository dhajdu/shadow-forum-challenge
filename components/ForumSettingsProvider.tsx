"use client";

// The forum's public settings for client components. The root layout loads them
// on the server (getForumSettings) and passes them in once.
import { createContext, useContext, type ReactNode } from "react";
import { DEFAULT_FORUM_SETTINGS, publicSettings, type PublicForumSettings } from "@/lib/forum-config";

const Ctx = createContext<PublicForumSettings>(publicSettings(DEFAULT_FORUM_SETTINGS));

export function ForumSettingsProvider({ value, children }: { value: PublicForumSettings; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useForumSettings = () => useContext(Ctx);
