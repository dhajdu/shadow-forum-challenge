"use client";

import { useState } from "react";
import { RaceBoard } from "@/components/RaceBoard";
import type { Standing } from "@/lib/standings";

export function RaceTabs({
  contest,
  all,
  defaultTab,
}: {
  contest: Standing[];
  all: Standing[];
  defaultTab: "contest" | "all";
}) {
  const [tab, setTab] = useState<"contest" | "all">(defaultTab);
  const standings = tab === "contest" ? contest : all;

  return (
    <div>
      <div className="seg raceseg">
        <button className={`seg-btn ${tab === "contest" ? "on" : ""}`} onClick={() => setTab("contest")}>
          Contest
        </button>
        <button className={`seg-btn ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>
          All time
        </button>
        <span className="raceseg-note">
          {tab === "contest"
            ? "Ranked on the contest window (from Sep 23)."
            : "All your WHOOP history — the contest resets Sep 23."}
        </span>
      </div>
      <RaceBoard standings={standings} />
    </div>
  );
}
