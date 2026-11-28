// Like the website: until a member signs the newest Constitution, nothing else opens.
import { type ReactNode } from "react";
import { Screen } from "@/components/ui";
import * as data from "@/data";
import { useLoad } from "@/lib/useLoad";
import { ConstitutionView } from "./Constitution";

export function ConstitutionGate({ children }: { children: ReactNode }) {
  const { data: must, reload } = useLoad(() => data.mustSignConstitution().catch(() => false));
  if (!must) return <>{children}</>;
  return (
    <Screen banner="back" title="Constitution">
      <ConstitutionView gate onSigned={reload} />
    </Screen>
  );
}
