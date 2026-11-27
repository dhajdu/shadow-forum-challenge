import { redirect } from "next/navigation";

// Legacy route: the rules now live under the Contest tab.
export default function Rules() {
  redirect("/contest/rules");
}
