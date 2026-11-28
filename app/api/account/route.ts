import { NextResponse, type NextRequest } from "next/server";
import { outdatedApp } from "@/lib/api";
import { getRequestUser } from "@/lib/supabase/request";
import { createAdminClient } from "@/lib/supabase/admin";
import { CONTACT_EMAIL } from "@/shared/legal";

export const dynamic = "force-dynamic";

// Delete my account (App Store guideline 5.1.1(v)). Any signed-in member may call it, including
// one whose forum access has ended. Removing the auth user cascades to the profile and everything
// that belongs to it (migrations 0001 onwards, made safe by 0039). Kitty lines stay in the forum's
// ledger without the member's name. Files in storage have no foreign key, so the member's own
// WHOOP exports and avatar are removed here; their gallery photos lose their rows and the nightly
// gallery cleanup removes the files.

async function removeFolder(admin: ReturnType<typeof createAdminClient>, bucket: string, folder: string) {
  const store = admin.storage.from(bucket);
  for (;;) {
    const { data, error } = await store.list(folder, { limit: 100 });
    if (error || !data?.length) return;
    const paths = data.filter((f) => f.id).map((f) => `${folder}/${f.name}`);
    if (!paths.length) return;
    const { error: rmErr } = await store.remove(paths);
    if (rmErr) return;
  }
}

/** DELETE { confirm: "DELETE" } */
export async function DELETE(req: NextRequest) {
  const old = outdatedApp(req);
  if (old) return old;
  const auth = await getRequestUser(req);
  if (!auth) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as { confirm?: unknown };
  if (b.confirm !== "DELETE") return NextResponse.json({ error: 'Send { "confirm": "DELETE" }.' }, { status: 400 });

  const id = auth.user.id;
  const admin = createAdminClient();
  await removeFolder(admin, "whoop", id);
  await removeFolder(admin, "avatars", id);

  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    console.error("account delete failed", id, error.message);
    return NextResponse.json(
      { error: `Your account could not be deleted. Email ${CONTACT_EMAIL} and it will be deleted for you.` },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true });
}
