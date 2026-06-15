import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "Legacy transformation generation has been retired.",
  );
}
