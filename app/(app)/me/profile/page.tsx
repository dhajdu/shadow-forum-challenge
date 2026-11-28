import { redirect } from "next/navigation";

// Profile editing lives on /me now.
export default function ProfileRedirect() {
  redirect("/me");
}
