import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy - InputEnglish",
  description: "InputEnglish Privacy Policy",
};

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-16 text-gray-800">
      <h1 className="mb-8 text-3xl font-bold">Privacy Policy</h1>
      <p className="mb-6 text-sm text-gray-500">Last updated: March 19, 2026</p>

      <section className="space-y-6 leading-relaxed">
        <div>
          <h2 className="mb-2 text-xl font-semibold">1. Overview</h2>
          <p>
            InputEnglish (&quot;we&quot;, &quot;our&quot;, &quot;the app&quot;)
            is an AI-powered English shadowing learning application. We are
            committed to protecting your privacy and handling your personal
            information responsibly.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">
            2. Information We Collect
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Account Information:</strong> Email address and display
              name when you sign up via email or OAuth (Google, Kakao).
            </li>
            <li>
              <strong>Learning Data:</strong> Study progress, session history,
              and playbook entries generated through app usage.
            </li>
            <li>
              <strong>Audio Recordings:</strong> Voice recordings made during
              shadowing practice. These are processed for pronunciation feedback
              and are not stored on our servers permanently.
            </li>
            <li>
              <strong>Device Information:</strong> Device type, OS version, and
              push notification tokens for delivering notifications.
            </li>
            <li>
              <strong>Subscription Data:</strong> Purchase history and
              subscription status managed through RevenueCat.
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">
            3. How We Use Your Information
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>Provide and improve the shadowing learning experience</li>
            <li>Deliver AI-powered pronunciation and learning feedback</li>
            <li>
              Send push notifications about new content and learning reminders
            </li>
            <li>Process and manage in-app subscriptions</li>
            <li>Analyze usage patterns to improve app features</li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">4. Data Storage</h2>
          <p>
            Your data is stored securely using Supabase infrastructure with
            row-level security (RLS) policies. Data is encrypted in transit and
            at rest.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">
            5. Third-Party Services
          </h2>
          <ul className="ml-4 list-disc space-y-1">
            <li>
              <strong>Supabase:</strong> Authentication and database hosting
            </li>
            <li>
              <strong>RevenueCat:</strong> Subscription and payment management
            </li>
            <li>
              <strong>Expo:</strong> Push notification delivery
            </li>
            <li>
              <strong>Google / Kakao:</strong> OAuth authentication providers
            </li>
          </ul>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">6. Data Sharing</h2>
          <p>
            We do not sell, trade, or share your personal information with third
            parties for marketing purposes. Data is shared only with the service
            providers listed above, solely for operating the app.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">7. User Rights</h2>
          <p>You have the right to:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Access your personal data</li>
            <li>Request correction of inaccurate data</li>
            <li>Request deletion of your account and associated data</li>
            <li>Withdraw consent for data processing</li>
          </ul>
          <p className="mt-2">
            To exercise these rights, contact us at{" "}
            <a
              href="mailto:support@shadowoo.kr"
              className="text-blue-600 underline"
            >
              support@shadowoo.kr
            </a>
            .
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">8. Data Retention</h2>
          <p>
            We retain your data for as long as your account is active. Upon
            account deletion, all personal data is removed within 30 days. Audio
            recordings from shadowing sessions are processed in real-time and
            not retained after feedback is generated.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">
            9. Children&apos;s Privacy
          </h2>
          <p>
            InputEnglish is not directed at children under 14. We do not
            knowingly collect personal information from children under 14.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">
            10. Changes to This Policy
          </h2>
          <p>
            We may update this policy from time to time. Changes will be posted
            on this page with an updated revision date.
          </p>
        </div>

        <div>
          <h2 className="mb-2 text-xl font-semibold">11. Contact</h2>
          <p>
            For questions about this privacy policy, contact us at{" "}
            <a
              href="mailto:support@shadowoo.kr"
              className="text-blue-600 underline"
            >
              support@shadowoo.kr
            </a>
            .
          </p>
        </div>
      </section>
    </main>
  );
}
