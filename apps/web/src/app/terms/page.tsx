import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Use - InputEnglish",
  description: "InputEnglish Terms of Use",
};

const toc = [
  { id: "overview", label: "Overview" },
  { id: "acceptance", label: "Acceptance of Terms" },
  { id: "subscriptions", label: "Subscriptions" },
  { id: "cancellation", label: "Cancellation & Refunds" },
  { id: "usage", label: "Acceptable Use" },
  { id: "intellectual-property", label: "Intellectual Property" },
  { id: "disclaimer", label: "Disclaimer" },
  { id: "limitation", label: "Limitation of Liability" },
  { id: "termination", label: "Termination" },
  { id: "changes", label: "Changes to Terms" },
  { id: "governing-law", label: "Governing Law" },
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

export default function TermsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/80 backdrop-blur-sm">
        <div className="mx-auto flex h-12 max-w-[960px] items-center justify-between px-6">
          <Link href="/" className="text-[15px] font-semibold text-neutral-900">
            InputEnglish
          </Link>
          <nav className="flex gap-5 text-[13px]">
            <Link href="/terms" className="font-medium text-neutral-900">
              Terms
            </Link>
            <Link
              href="/privacy"
              className="text-neutral-500 transition-colors hover:text-neutral-900"
            >
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

      {/* Body */}
      <div className="mx-auto w-full max-w-[960px] flex-1 px-6 pt-12 pb-20 lg:grid lg:grid-cols-[180px_1fr] lg:gap-10">
        {/* Left TOC */}
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
            Terms of Use
          </h1>
          <p className="mt-2 text-[13px] text-neutral-400">
            Last updated: April 8, 2026
          </p>

          <article className="mt-10 space-y-10 text-[15px] leading-relaxed text-neutral-700">
            <section>
              <H2 id="overview" num="1">
                Overview
              </H2>
              <p className="mt-4">
                These Terms of Use (&ldquo;Terms&rdquo;) govern your use of the
                InputEnglish application (&ldquo;the App&rdquo;), an AI-powered
                English shadowing learning service operated by InputEnglish
                (&ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;). By
                downloading, installing, or using the App, you agree to be bound
                by these Terms.
              </p>
            </section>

            <section>
              <H2 id="acceptance" num="2">
                Acceptance of Terms
              </H2>
              <p className="mt-4">
                By accessing or using the App, you confirm that you are at least
                14 years of age and agree to comply with these Terms. If you do
                not agree to these Terms, you must not use the App.
              </p>
            </section>

            <section>
              <H2 id="subscriptions" num="3">
                Subscriptions
              </H2>
              <p className="mt-4">
                InputEnglish offers the following auto-renewable subscription
                plans for Premium access:
              </p>
              <div className="mt-4 space-y-2.5">
                {[
                  {
                    plan: "Monthly",
                    price: "KRW 9,900/month",
                    desc: "Billed monthly, auto-renews every month.",
                  },
                  {
                    plan: "3-Month",
                    price: "KRW 24,900/3 months",
                    desc: "Billed every 3 months, auto-renews every 3 months.",
                  },
                  {
                    plan: "Annual",
                    price: "KRW 89,000/year",
                    desc: "Billed annually, auto-renews every year.",
                  },
                ].map((item) => (
                  <div
                    key={item.plan}
                    className="rounded-md bg-neutral-50 px-4 py-3"
                  >
                    <dt className="text-[14px] font-medium text-neutral-900">
                      {item.plan} &mdash; {item.price}
                    </dt>
                    <dd className="mt-0.5 text-[14px] text-neutral-500">
                      {item.desc}
                    </dd>
                  </div>
                ))}
              </div>
              <ul className="mt-4 list-disc space-y-1.5 pl-5 marker:text-neutral-300">
                <li>
                  Payment is charged to your iTunes Account at confirmation of
                  purchase.
                </li>
                <li>
                  Subscriptions automatically renew unless auto-renew is turned
                  off at least 24 hours before the end of the current period.
                </li>
                <li>
                  Your account will be charged for renewal within 24 hours prior
                  to the end of the current period at the same price.
                </li>
                <li>
                  You can manage and cancel your subscriptions by going to your
                  Account Settings in the App Store after purchase.
                </li>
              </ul>
            </section>

            <section>
              <H2 id="cancellation" num="4">
                Cancellation &amp; Refunds
              </H2>
              <p className="mt-4">
                You may cancel your subscription at any time through the App
                Store Account Settings. Cancellation takes effect at the end of
                the current billing period. No refunds are provided for partial
                subscription periods. Refund requests are handled by Apple in
                accordance with their refund policies.
              </p>
            </section>

            <section>
              <H2 id="usage" num="5">
                Acceptable Use
              </H2>
              <p className="mt-4">You agree not to:</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-5 marker:text-neutral-300">
                <li>
                  Use the App for any unlawful purpose or in violation of these
                  Terms
                </li>
                <li>
                  Attempt to reverse-engineer, decompile, or disassemble the App
                </li>
                <li>
                  Reproduce, distribute, or create derivative works based on the
                  App content
                </li>
                <li>
                  Interfere with or disrupt the App&apos;s servers or networks
                </li>
                <li>Share your account credentials with third parties</li>
              </ul>
            </section>

            <section>
              <H2 id="intellectual-property" num="6">
                Intellectual Property
              </H2>
              <p className="mt-4">
                All content, features, and functionality of the App, including
                but not limited to text, graphics, logos, and software, are the
                exclusive property of InputEnglish and are protected by
                copyright, trademark, and other intellectual property laws.
                Video content sourced from third parties remains the property of
                their respective owners.
              </p>
            </section>

            <section>
              <H2 id="disclaimer" num="7">
                Disclaimer
              </H2>
              <p className="mt-4">
                The App is provided &ldquo;as is&rdquo; and &ldquo;as
                available&rdquo; without warranties of any kind, either express
                or implied. We do not guarantee that the App will be
                uninterrupted, error-free, or free of harmful components.
              </p>
            </section>

            <section>
              <H2 id="limitation" num="8">
                Limitation of Liability
              </H2>
              <p className="mt-4">
                To the fullest extent permitted by applicable law, InputEnglish
                shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages arising out of or related to
                your use of the App.
              </p>
            </section>

            <section>
              <H2 id="termination" num="9">
                Termination
              </H2>
              <p className="mt-4">
                We may terminate or suspend your access to the App at any time,
                without notice, for conduct that we believe violates these Terms
                or is harmful to other users, us, or third parties. Upon
                termination, your right to use the App ceases immediately.
              </p>
            </section>

            <section>
              <H2 id="changes" num="10">
                Changes to Terms
              </H2>
              <p className="mt-4">
                We reserve the right to modify these Terms at any time. Changes
                will be posted on this page with an updated revision date.
                Continued use of the App after changes constitutes acceptance of
                the revised Terms.
              </p>
            </section>

            <section>
              <H2 id="governing-law" num="11">
                Governing Law
              </H2>
              <p className="mt-4">
                These Terms shall be governed by and construed in accordance
                with the laws of the Republic of Korea, without regard to
                conflict of law principles.
              </p>
            </section>

            <section>
              <H2 id="contact" num="12">
                Contact
              </H2>
              <p className="mt-4">
                For questions about these Terms, contact us at {mail}.
              </p>
            </section>
          </article>
        </main>
      </div>

      {/* Footer */}
      <footer className="border-t border-neutral-200">
        <div className="mx-auto flex max-w-[960px] flex-col gap-3 px-6 py-8 text-[12px] text-neutral-400 sm:flex-row sm:items-center sm:justify-between">
          <span>&copy; 2026 InputEnglish</span>
          <nav className="flex gap-5">
            <Link
              href="/terms"
              className="transition-colors hover:text-neutral-900"
            >
              Terms
            </Link>
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
