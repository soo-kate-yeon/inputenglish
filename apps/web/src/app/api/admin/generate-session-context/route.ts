import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "Legacy session context generation has been retired.",
  );
}
