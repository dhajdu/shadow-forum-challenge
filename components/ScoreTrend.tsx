// Tiny inline-SVG sparkline of daily scores (oldest → newest).
export function ScoreTrend({ scores }: { scores: number[] }) {
  if (scores.length < 2) {
    return <div className="trend-empty">Not enough data yet</div>;
  }

  const w = 640;
  const h = 120;
  const pad = 8;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const pts = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (s - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="trend" preserveAspectRatio="none" role="img" aria-label="Score trend">
      <defs>
        <linearGradient id="trendline" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#2f7dff" />
          <stop offset="0.5" stopColor="#ff2fb0" />
          <stop offset="1" stopColor="#ff4326" />
        </linearGradient>
      </defs>
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke="url(#trendline)"
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
