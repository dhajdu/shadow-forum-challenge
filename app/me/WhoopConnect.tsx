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
  const synced = lastSync ? shortDate(lastSync.slice(0, 10)) : null;

  return (
    <div className={s.whoop}>
      <div className={s.whoopRow}>
        {connected ? (
          <>
            <span className={s.whoopOn}>WHOOP connected{synced ? ` · synced ${synced}` : ""}</span>
            <form action={disconnectWhoop}>
              <button className="btn-ghost" type="submit">
                Disconnect
              </button>
            </form>
          </>
        ) : external ? (
          <span className={s.whoopOff}>Synced outside the forum</span>
        ) : (
          <a className={`btn-ghost ${s.connectBtn}`} href="/api/whoop/connect">
            Connect WHOOP
          </a>
        )}
      </div>
      {status === "revoked" && !external && (
        <p className={s.whoopPrivacy}>{lastError || "WHOOP access expired or was revoked. Connect again to resume syncing."}</p>
      )}
      {connected && lastError && <p className={s.whoopNotice}>{lastError}</p>}
      {notice && <p className={s.whoopNotice}>{notice}</p>}
      <p className={s.whoopPrivacy}>
        {external
          ? "Daily scores for this account come from an external sync. Connect WHOOP will not overwrite them. The export upload is still here as a fallback."
          : "Connecting stores an encrypted link to your WHOOP account on this server and syncs each day of recovery, sleep performance, strain, resting heart rate, and HRV. The leaderboard shows the blended daily score and how many days were scored or missed. It does not show heart rate, HRV, or journal answers. Disconnect revokes access at WHOOP and deletes the stored tokens. The export upload remains as a fallback."}
      </p>
    </div>
  );
}
