import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Support - InputEnglish",
  description: "InputEnglish Support",
};

export default function SupportPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[720px] items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-semibold text-neutral-900">
            InputEnglish
          </Link>
          <nav className="flex gap-5 text-[13px]">
            <Link
              href="/privacy"
              className="text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Privacy
            </Link>
            <Link href="/support" className="font-medium text-neutral-900">
              Support
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Body ── */}
      <main className="mx-auto w-full max-w-[720px] flex-1 px-6 pt-12 pb-20">
        <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-neutral-900">
          Support
        </h1>

        <article className="mt-12 space-y-10 text-[15px] leading-relaxed text-neutral-700">
          {/* Contact */}
          <section>
            <h2
              id="contact"
              className="scroll-mt-20 border-b border-neutral-200 pb-3 text-[19px] font-semibold leading-snug tracking-tight text-neutral-900"
            >
              Contact Us
            </h2>
            <p className="mt-4">
              For questions, bug reports, or feature requests, please reach out
              to us at{" "}
              <a
                href="mailto:support@inputenglish.kr"
                className="text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-900"
              >
                support@inputenglish.kr
              </a>
              .
            </p>
          </section>

          {/* FAQ */}
          <section>
            <h2
              id="faq"
              className="scroll-mt-20 border-b border-neutral-200 pb-3 text-[19px] font-semibold leading-snug tracking-tight text-neutral-900"
            >
              FAQ
            </h2>
            <div className="mt-4 space-y-4">
              {[
                {
                  q: "What is shadowing?",
                  a: "Shadowing is a language learning technique where you listen to native speech and repeat it simultaneously, like a shadow. It helps improve pronunciation, intonation, and rhythm naturally.",
                },
                {
                  q: "How do I cancel my subscription?",
                  a: "Go to Settings > Apple ID > Subscriptions on your iPhone, find InputEnglish, and tap Cancel Subscription.",
                },
                {
                  q: "How do I delete my account?",
                  a: "Contact us at support@inputenglish.kr and we will process your account deletion within 30 days.",
                },
              ].map((item) => (
                <div
                  key={item.q}
                  className="rounded-md border border-neutral-200 px-4 py-3.5"
                >
                  <h3 className="text-[15px] font-medium text-neutral-900">
                    {item.q}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-neutral-500">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </article>
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[720px] flex-col gap-3 px-6 py-8 text-[12px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 InputEnglish</span>
          <nav className="flex gap-5">
            <Link
              href="/privacy"
              className="transition-colors hover:text-neutral-900"
            >
              Privacy
            </Link>
            <Link
              href="/support"
              className="transition-colors hover:text-neutral-900"
            >
              Support
            </Link>
            <a
              href="mailto:support@inputenglish.kr"
              className="transition-colors hover:text-neutral-900"
            >
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
