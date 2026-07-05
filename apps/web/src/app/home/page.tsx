import Link from "next/link";
import { Button } from "@framingui/ui";

// Public landing entry point for logged-out visitors — the middleware's
// fallback destination (utils/supabase/middleware.ts) for any path that
// isn't a protected route, an /auth callback, or another exempted public
// page. Previously unreachable (no page existed here at all).
export default function HomePage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/login-bg.jpg')",
          backgroundColor: "#1a1a2e",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl leading-snug font-bold tracking-tight text-white sm:text-3xl">
          하루 5분,
          <br />
          당신의 영어를 위해
          <br />
          가장 필요한 인풋
        </h1>
      </div>

      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 px-6 pb-12">
        <Button
          asChild
          variant="default"
          size="lg"
          className="w-full bg-white text-black hover:bg-white/90"
        >
          <Link href="/login">시작하기</Link>
        </Button>
      </div>
    </div>
  );
}
