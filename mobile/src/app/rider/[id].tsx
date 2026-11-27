import { Redirect, useLocalSearchParams } from "expo-router";
export default function OldRider() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: "/contest/rider/[id]", params: { id } }} />;
}
