import { NextResponse } from "next/server";
import { minMobileBuild, APP_BUILD_HEADER } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Public: the oldest iPhone build the server still accepts. Older builds get 426 from the API. */
export async function GET() {
  return NextResponse.json({ min_build: minMobileBuild(), build_header: APP_BUILD_HEADER });
}
