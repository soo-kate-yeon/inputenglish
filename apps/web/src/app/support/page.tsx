import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support - InputEnglish",
  description: "InputEnglish Support",
};

export default function SupportPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-gray-800">
      <h1 className="mb-8 text-3xl font-bold">Support</h1>

      <section className="space-y-6 leading-relaxed">
        <div>
          <h2 className="mb-2 text-xl font-semibold">Contact Us</h2>
          <p>
            For questions, bug reports, or feature requests, please reach out to
            us at{" "}
            <a
              href="mailto:support@inputenglish.kr"
              className="text-blue-600 underline"
            >
              support@inputenglish.kr
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">FAQ</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium">What is shadowing?</h3>
              <p className="text-gray-600">
                Shadowing is a language learning technique where you listen to
                native speech and repeat it simultaneously, like a shadow. It
                helps improve pronunciation, intonation, and rhythm naturally.
              </p>
            </div>
            <div>
              <h3 className="font-medium">How do I cancel my subscription?</h3>
              <p className="text-gray-600">
                Go to Settings &gt; Apple ID &gt; Subscriptions on your iPhone,
                find InputEnglish, and tap Cancel Subscription.
              </p>
            </div>
            <div>
              <h3 className="font-medium">How do I delete my account?</h3>
              <p className="text-gray-600">
                Contact us at support@inputenglish.kr and we will process your
                account deletion within 30 days.
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
