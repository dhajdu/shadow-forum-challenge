import { Redirect } from "expo-router";
import { today } from "@shared/contest";

// /contest/report → this month's report.
export default function ReportIndex() {
  return <Redirect href={{ pathname: "/contest/report/[month]", params: { month: today().slice(0, 7) } }} />;
}
