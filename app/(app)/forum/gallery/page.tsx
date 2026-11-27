import { redirect } from "next/navigation";

// The Gallery is its own section now.
export default function OldGallery() {
  redirect("/gallery");
}
