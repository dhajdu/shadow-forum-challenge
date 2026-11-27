// The only Supabase client in the app. It runs as the signed-in member, so every read is
// filtered by row-level security in the database. Never filter forum data in the client.
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";
import type { Database } from "@shared/database.types";
import { config } from "./config";
import { sessionStorage } from "./secureStorage";

export const supabase = createClient<Database>(
  config.supabaseUrl || "https://not-configured.supabase.co",
  config.supabaseAnonKey || "not-configured",
  {
    auth: {
      storage: sessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);

// Refresh tokens only while the app is in the foreground.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
