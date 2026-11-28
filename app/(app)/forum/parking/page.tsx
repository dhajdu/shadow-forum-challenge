import { redirect } from "next/navigation";

// The Parking Lot is called Topics now.
export default function OldParking() {
  redirect("/forum/topics");
}
