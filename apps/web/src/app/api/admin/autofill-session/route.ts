import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "Legacy learning session autofill has been retired.",
  );
}
