import { redirect } from "next/navigation";

// The library is called Resources now.
export default function OldLibrary() {
  redirect("/forum/resources");
}
