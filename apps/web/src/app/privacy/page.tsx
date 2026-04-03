import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy - InputEnglish",
  description: "InputEnglish Privacy Policy",
};

const toc = [
  { id: "overview", label: "Overview" },
  { id: "information-we-collect", label: "Information We Collect" },
  { id: "how-we-use", label: "How We Use Your Information" },
  { id: "data-storage", label: "Data Storage" },
  { id: "third-party", label: "Third-Party Services" },
  { id: "data-sharing", label: "Data Sharing" },
  { id: "user-rights", label: "User Rights" },
  { id: "data-retention", label: "Data Retention" },
  { id: "children", label: "Children's Privacy" },
  { id: "changes", label: "Changes to This Policy" },
  { id: "contact", label: "Contact" },
];

function H2({
  id,
  num,
  children,
}: {
  id: string;
  num: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-20 border-b border-neutral-200 pb-3 text-[19px] font-semibold leading-snug tracking-tight text-neutral-900"
    >
      {num}. {children}
    </h2>
  );
}

const mail = (
  <a
    href="mailto:support@inputenglish.kr"
    className="text-neutral-900 underline decoration-neutral-300 underline-offset-2 transition-colors hover:decoration-neutral-900"
  >
    support@inputenglish.kr
  </a>
);

export default function PrivacyPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[960px] items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-semibold text-neutral-900">
            InputEnglish
          </Link>
          <nav className="flex gap-5 text-[13px]">
            <Link href="/privacy" className="font-medium text-neutral-900">
              Privacy
            </Link>
            <Link
              href="/support"
              className="text-neutral-500 transition-colors hover:text-neutral-900"
            >
              Support
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="mx-auto w-full max-w-[960px] flex-1 px-6 pt-12 pb-20 lg:grid lg:grid-cols-[180px_1fr] lg:gap-10">
        {/* Left TOC — sticky on desktop, inline on mobile */}
        <aside>
          <nav className="lg:sticky lg:top-16">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-neutral-400">
              On this page
            </p>
            <ul className="space-y-1 text-[13px] leading-6">
              {toc.map((t) => (
                <li key={t.id}>
                  <a
                    href={`#${t.id}`}
                    className="text-neutral-400 transition-colors hover:text-neutral-900"
                  >
                    {t.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Right Content */}
        <main className="mt-10 lg:mt-0">
          <h1 className="text-[32px] font-semibold leading-tight tracking-tight text-neutral-900">
            Privacy Policy
          </h1>
          <p className="mt-2 text-[13px] text-neutral-400">
            Last updated: March 19, 2026
          </p>

          <article className="mt-10 space-y-10 text-[15px] leading-relaxed text-neutral-700">
            <section>
              <H2 id="overview" num="1">
                Overview
              </H2>
              <p className="mt-4">
                InputEnglish (&ldquo;we&rdquo;, &ldquo;our&rdquo;,
                &ldquo;the&nbsp;app&rdquo;) is an AI-powered English shadowing
                learning application. We are committed to protecting your
                privacy and handling your personal information responsibly.
              </p>
            </section>

            <section>
              <H2 id="information-we-collect" num="2">
                Information We Collect
              </H2>
              <dl className="mt-4 space-y-2.5">
                {[
                  {
                    term: "Account Information",
                    desc: "Email address and display name when you sign up via email or OAuth (Google, Kakao).",
                  },
                  {
                    term: "Learning Data",
                    desc: "Study progress, session history, and playbook entries generated through app usage.",
                  },
                  {
                    term: "Audio Recordings",
                    desc: "Voice recordings made during shadowing practice. These are processed for pronunciation feedback and are not stored on our servers permanently.",
                  },
                  {
                    term: "Device Information",
                    desc: "Device type, OS version, and push notification tokens for delivering notifications.",
                  },
                  {
                    term: "Subscription Data",
                    desc: "Purchase history and subscription status managed through RevenueCat.",
                  },
                ].map((item) => (
                  <div
                    key={item.term}
                    className="rounded-md bg-neutral-50 px-4 py-3"
                  >
                    <dt className="text-[14px] font-medium text-neutral-900">
                      {item.term}
                    </dt>
                    <dd className="mt-0.5 text-[14px] text-neutral-500">
                      {item.desc}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>

            <section>
              <H2 id="how-we-use" num="3">
                How We Use Your Information
              </H2>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 marker:text-neutral-300">
                <li>Provide and improve the shadowing learning experience</li>
                <li>Deliver AI-powered pronunciation and learning feedback</li>
                <li>
                  Send push notifications about new content and learning
                  reminders
                </li>
                <li>Process and manage in-app subscriptions</li>
                <li>Analyze usage patterns to improve app features</li>
              </ul>
            </section>

            <section>
              <H2 id="data-storage" num="4">
                Data Storage
              </H2>
              <p className="mt-4">
                Your data is stored securely using Supabase infrastructure with
                row-level security (RLS) policies. Data is encrypted in transit
                and at rest.
              </p>
            </section>

            <section>
              <H2 id="third-party" num="5">
                Third-Party Services
              </H2>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                {[
                  { name: "Supabase", role: "Authentication & database" },
                  { name: "RevenueCat", role: "Subscription management" },
                  { name: "Expo", role: "Push notifications" },
                  { name: "Google / Kakao", role: "OAuth providers" },
                ].map((s) => (
                  <div
                    key={s.name}
                    className="rounded-md border border-neutral-200 px-3.5 py-2.5"
                  >
                    <p className="text-[14px] font-medium text-neutral-900">
                      {s.name}
                    </p>
                    <p className="text-[13px] text-neutral-500">{s.role}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <H2 id="data-sharing" num="6">
                Data Sharing
              </H2>
              <p className="mt-4">
                We do not sell, trade, or share your personal information with
                third parties for marketing purposes. Data is shared only with
                the service providers listed above, solely for operating the
                app.
              </p>
            </section>

            <section>
              <H2 id="user-rights" num="7">
                User Rights
              </H2>
              <p className="mt-4">You have the right to:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-neutral-300">
                <li>Access your personal data</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your account and associated data</li>
                <li>Withdraw consent for data processing</li>
              </ul>
              <p className="mt-3">
                To exercise these rights, contact us at {mail}.
              </p>
            </section>

            <section>
              <H2 id="data-retention" num="8">
                Data Retention
              </H2>
              <p className="mt-4">
                We retain your data for as long as your account is active. Upon
                account deletion, all personal data is removed within 30 days.
                Audio recordings from shadowing sessions are processed in
                real-time and not retained after feedback is generated.
              </p>
            </section>

            <section>
              <H2 id="children" num="9">
                Children&apos;s Privacy
              </H2>
              <p className="mt-4">
                InputEnglish is not directed at children under 14. We do not
                knowingly collect personal information from children under 14.
              </p>
            </section>

            <section>
              <H2 id="changes" num="10">
                Changes to This Policy
              </H2>
              <p className="mt-4">
                We may update this policy from time to time. Changes will be
                posted on this page with an updated revision date.
              </p>
            </section>

            <section>
              <H2 id="contact" num="11">
                Contact
              </H2>
              <p className="mt-4">
                For questions about this privacy policy, contact us at {mail}.
              </p>
            </section>
          </article>
        </main>
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[960px] flex-col gap-3 px-6 py-8 text-[12px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
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
