"use client";

import { useState } from "react";
import { ScoreTrend } from "@/components/ScoreTrend";

export type WhoopDay = {
  day: string;
  score: number | null;
  recovery: number | null;
  strain: number | null;
  resting_hr: number | null;
  hrv: number | null;
  missed: boolean;
};

type MetricKey = "score" | "recovery" | "strain" | "resting_hr" | "hrv";
const METRICS: { key: MetricKey; label: string; unit?: string }[] = [
  { key: "score", label: "WHOOP score" },
  { key: "recovery", label: "Recovery", unit: "%" },
  { key: "strain", label: "Day strain" },
  { key: "resting_hr", label: "Resting HR", unit: "bpm" },
  { key: "hrv", label: "HRV", unit: "ms" },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

export function MyData({
  days,
  contestStartDay,
  rank,
  riderCount,
}: {
  days: WhoopDay[];
  contestStartDay: string;
  rank: number;
  riderCount: number;
}) {
  const [view, setView] = useState<"all" | "contest">("all");
  const rows = view === "contest" ? days.filter((d) => d.day >= contestStartDay) : days;

  const scored = rows.filter((d) => d.score != null).map((d) => d.score as number);
  const avg = scored.length ? round1(scored.reduce((a, b) => a + b, 0) / scored.length) : null;
  const recos = rows.filter((d) => d.recovery != null).map((d) => d.recovery as number);
  const latestReco = recos.length ? recos[recos.length - 1] : null;
  const missed = rows.filter((d) => d.missed).length;

  return (
    <div className="mydata">
      <div className="mydata-top">
        <div className="seg viewseg">
          <button className={`seg-btn ${view === "all" ? "on" : ""}`} onClick={() => setView("all")}>
            All time
          </button>
          <button className={`seg-btn ${view === "contest" ? "on" : ""}`} onClick={() => setView("contest")}>
            Contest
          </button>
        </div>
        <span className="mydata-count">{rows.length} days</span>
      </div>

      {rows.length === 0 ? (
        <p className="trend-empty">
          {view === "contest"
            ? "No contest data yet — the tally starts soon. Keep uploading."
            : "No data yet — upload your WHOOP export below."}
        </p>
      ) : (
        <>
          <div className="kpi-row">
            <div className="kpi"><b>{avg ?? "—"}</b><span>avg score</span></div>
            <div className="kpi"><b>{latestReco ?? "—"}</b><span>recovery</span></div>
            <div className="kpi"><b>{rows.length}</b><span>days</span></div>
            <div className="kpi"><b>{missed}</b><span>missed</span></div>
            <div className="kpi"><b>{rank > 0 ? `#${rank}` : "—"}</b><span>of {riderCount}</span></div>
          </div>

          <div className="trend-grid">
            {METRICS.map((m) => {
              const series = rows.map((d) => d[m.key]).filter((v): v is number => v != null);
              const latest = series.length ? series[series.length - 1] : null;
              return (
                <div className="trend-card" key={m.key}>
                  <div className="trend-h">
                    <span>{m.label}</span>
                    <b>{latest != null ? `${round1(latest)}${m.unit ?? ""}` : "—"}</b>
                  </div>
                  <ScoreTrend scores={series} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
