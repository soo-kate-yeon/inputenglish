import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "Legacy learning session persistence has been retired.",
    "/api/admin/premium/sessions/draft",
  );
}
