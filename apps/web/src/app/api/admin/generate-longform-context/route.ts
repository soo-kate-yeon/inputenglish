import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function POST() {
  return retiredAdminRoute(
    "Legacy longform context generation has been retired.",
  );
}
