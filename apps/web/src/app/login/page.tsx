import { Heading } from "@framingui/ui";
import { LoginActions } from "./LoginActions";

export default function LoginPage() {
  return (
    <div className="dark relative flex min-h-dvh flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-neutral-900 to-neutral-950">
      {/* Slogan - centered */}
      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
        <Heading
          level={1}
          className="text-2xl leading-snug tracking-tight text-white sm:text-3xl"
        >
          하루 5분,
          <br />
          당신의 영어를 위해
          <br />
          가장 필요한 인풋
        </Heading>
      </div>

      {/* Auth CTAs - bottom */}
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-3 px-6 pb-12">
        <LoginActions />
      </div>
    </div>
  );
}
