import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function GET() {
  return retiredAdminRoute(
    "Legacy admin transcript loading has been retired.",
    "/api/admin/premium/transcript",
  );
}
