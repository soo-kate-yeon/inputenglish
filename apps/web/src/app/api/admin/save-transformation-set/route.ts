import { retiredAdminRoute } from "@/lib/admin/retired-route";

export async function GET() {
  return retiredAdminRoute(
    "Legacy transformation set reads have been retired.",
  );
}

export async function POST() {
  return retiredAdminRoute(
    "Legacy transformation set persistence has been retired.",
  );
}

export async function PATCH() {
  return retiredAdminRoute(
    "Legacy transformation set updates have been retired.",
  );
}
