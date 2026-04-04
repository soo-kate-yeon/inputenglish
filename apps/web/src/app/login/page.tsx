import { Button } from "@framingui/ui";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-between overflow-hidden">
      {/* Background Image (placeholder) */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{
          backgroundImage: "url('/images/login-bg.jpg')",
          backgroundColor: "#1a1a2e",
        }}
      />

      {/* Gradient Dimming Layer */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />

      {/* Slogan - centered */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="text-2xl leading-snug font-bold tracking-tight text-white sm:text-3xl">
          하루 5분,
          <br />
          당신의 영어를 위해
          <br />
          가장 필요한 인풋
        </h1>
      </div>

      {/* Auth CTAs - bottom */}
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 px-6 pb-12">
        <Button
          variant="outline"
          size="lg"
          className="w-full border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
        >
          Google로 계속하기
        </Button>
        <Button
          variant="default"
          size="lg"
          className="w-full bg-white text-black hover:bg-white/90"
        >
          Apple로 계속하기
        </Button>
        <Button
          variant="secondary"
          size="lg"
          className="w-full bg-transparent text-white/70 underline-offset-4 hover:text-white hover:underline"
        >
          이메일로 시작하기
        </Button>
      </div>
    </div>
  );
}
