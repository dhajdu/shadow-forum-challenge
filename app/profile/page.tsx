import { redirect } from "next/navigation";

// Legacy route: the profile editor now lives under Me.
export default function Profile() {
  redirect("/me/profile");
}
