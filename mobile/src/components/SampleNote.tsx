import { useSyncExternalStore } from "react";
import { isDemo, sampleState } from "@/data";
import { color } from "@/theme/tokens";
import { Banner } from "./ui";

/** Says plainly when forum screens show sample data, so nobody mistakes it for the real forum. */
export function SampleNote() {
  const sample = useSyncExternalStore(sampleState.subscribe, sampleState.get, sampleState.get);
  if (!sample) return null;
  return (
    <Banner tone={color.blueEdge}>
      {isDemo ? "Demo mode: sample data, nothing is sent." : "Sample forum data until the forum tables go live."}
    </Banner>
  );
}
