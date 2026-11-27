// The share extension (iOS share sheet → "Shadow Forum") hands the app a WHOOP export.
// This opens My goal with the file ready to upload. In Expo Go and on web the native module is
// absent and this does nothing.
import { router } from "expo-router";
import { useEffect } from "react";
import { useShareIntent } from "expo-share-intent";

export function ShareIntake() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntent({ resetOnBackground: true });
  useEffect(() => {
    const f = shareIntent.files?.[0];
    if (!hasShareIntent || !f) return;
    router.push({ pathname: "/contest/goal", params: { upload: "1", file: f.path, name: f.fileName } });
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent]);
  return null;
}
