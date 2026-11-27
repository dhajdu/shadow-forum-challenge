import { redirect } from "next/navigation";

// Your WHOOP data and goals now live on Me.
export default function GoalRedirect() {
  redirect("/me");
}
