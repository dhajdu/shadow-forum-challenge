import { redirect } from "next/navigation";

// Legacy route: the race now lives under the Contest tab.
export default function Race() {
  redirect("/contest");
}
