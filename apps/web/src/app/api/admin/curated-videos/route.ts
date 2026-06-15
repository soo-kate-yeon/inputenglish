import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "curated-videos is retired; premium sessions are authored through the premium pipeline.",
    "/api/admin/premium/pipeline/draft",
  );
}
