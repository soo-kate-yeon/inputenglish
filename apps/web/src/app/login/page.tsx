import { LoginActions } from "./LoginActions";

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
        <LoginActions />
      </div>
    </div>
  );
}
