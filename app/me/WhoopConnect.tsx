import { disconnectWhoop } from "@/app/actions/whoop";
import { shortDate } from "./stats";
import s from "./me.module.css";

type Status = "connected" | "disconnected" | "revoked" | null;

const NOTICES: Record<string, string> = {
  connected: "WHOOP connected. Recent days are syncing into your scores.",
  denied: "WHOOP connection was cancelled.",
  error: "Could not connect WHOOP. Try again in a moment.",
  unconfigured: "WHOOP is not configured on the server yet.",
  taken: "That WHOOP account is already linked to another member.",
  external: "This account is updated by an external sync, so Connect WHOOP stays off.",
};

export function whoopNotice(code: string | undefined): string | null {
  if (!code) return null;
  return NOTICES[code] ?? null;
}

export function WhoopConnect({
  status,
  lastSync,
  lastError,
  external,
  notice,
}: {
  status: Status;
  lastSync: string | null;
  lastError: string | null;
  external: boolean;
  notice: string | null;
}) {
  const connected = status === "connected";
  const revoked = status === "revoked" && !external;
  const synced = lastSync ? shortDate(lastSync.slice(0, 10)) : null;

  const label = external
    ? "WHOOP · external sync"
    : connected
      ? `WHOOP${synced ? ` · synced ${synced}` : " connected"}`
      : revoked
        ? "Reconnect WHOOP"
        : "Connect WHOOP";

  return (
    <details className={s.pop} open={notice != null}>
      <summary className="btn-ghost">
        {(connected || revoked) && <i className={`${s.dot} ${revoked ? s.dotWarn : ""}`} aria-hidden />}
        {label}
      </summary>
      <div className={s.panel}>
        {notice && <p className={s.whoopNotice}>{notice}</p>}
        {revoked && (
          <p className={s.whoopWarn}>{lastError || "WHOOP access expired or was revoked. Connect again to resume syncing."}</p>
        )}
        {connected && lastError && <p className={s.whoopWarn}>{lastError}</p>}
        <p className={s.fallbackNote}>
          {external
            ? "Daily scores for this account come from an external sync. Connect WHOOP will not overwrite them. The export upload is still here as a fallback."
            : "Connecting stores an encrypted link to your WHOOP account on this server and syncs each day of recovery, sleep performance, strain, resting heart rate, and HRV. The leaderboard shows the blended daily score and how many days were scored or missed. It does not show heart rate, HRV, or journal answers. Disconnect revokes access at WHOOP and deletes the stored tokens. The export upload remains as a fallback."}
        </p>
        {connected ? (
          <form action={disconnectWhoop} className={s.panelActions}>
            <button className="btn-ghost" type="submit">
              Disconnect
            </button>
          </form>
        ) : external ? null : (
          <div className={s.panelActions}>
            <a className={`btn ${s.connectBtn}`} href="/api/whoop/connect">
              {revoked ? "Reconnect WHOOP" : "Connect WHOOP"}
            </a>
          </div>
        )}
      </div>
    </details>
  );
}
