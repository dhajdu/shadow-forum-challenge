import Link from "next/link";
import { redirect } from "next/navigation";
import { getForumContext } from "@/app/_data/context";
import { longDay } from "@/app/_data/format";
import { AvatarUpload } from "@/components/AvatarUpload";
import { ProfileForm } from "@/components/ProfileForm";
import { SignOutButton } from "@/components/SignOutButton";
import { Settings } from "./Settings";
import s from "./me.module.css";

// Profile: your photo, details, password and account settings.
export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ whoop?: string; view?: string }> }) {
  const params = await searchParams;
  // WHOOP connect still returns to /me; the WHOOP data lives on Biometrics now
  if (params.whoop || params.view) redirect(`/biometrics?${new URLSearchParams(params as Record<string, string>)}`);

  const { db, user, viewer, forum } = await getForumContext();
  const { data } = await db.from("profiles").select("full_name, email, avatar_url").eq("id", user.id).single();
  const profile = data as { full_name: string; email: string | null; avatar_url: string | null } | null;
  const name = profile?.full_name || viewer.full_name;
  const initials = name.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <main className="page">
      <header className={s.head}>
        <AvatarUpload userId={user.id} url={profile?.avatar_url ?? null} initials={initials} />
        <div className={s.who}>
          <div className="eyebrow">Profile</div>
          <h1>{name}</h1>
          <p className={s.since}>
            {viewer.is_founding ? "Founding member" : "Member"}
            {viewer.forum_joined_on ? ` · in the forum since ${longDay(viewer.forum_joined_on)}` : ""}
          </p>
          <div className={s.quick}>
            {forum.whoopEnabled && <Link href="/biometrics" className="btn-ghost inline">Biometrics</Link>}
            <Link href="/goals" className="btn-ghost inline">Goals</Link>
            <SignOutButton className="btn-ghost" />
          </div>
        </div>
      </header>

      <div className={s.grid}>
        <ProfileForm fullName={name} email={profile?.email ?? user.email ?? ""} />
      </div>
      <Settings />
    </main>
  );
}
