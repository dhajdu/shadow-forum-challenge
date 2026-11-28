import { ContestShell } from "@/components/ContestShell";
import { ExtraCredit, GoalCard } from "@/components/zone";

// /contest/goals — the season's business goal (with your coach) and your personal goals.
// Off season it is the Contest tab's first page, so the tab is never empty.
export default function Goals() {
  return (
    <ContestShell banner="goals" gate={false}>
      {() => (
        <>
          <GoalCard />
          <ExtraCredit />
        </>
      )}
    </ContestShell>
  );
}
