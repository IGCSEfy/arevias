import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { PageTransition } from "@/components/arevias/page-transition";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-lg text-foreground">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-relaxed text-foreground/75">
        {children}
      </div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <PageTransition>
      <div className="fixed inset-0 overflow-y-auto bg-background text-foreground">
        <div className="mx-auto max-w-2xl px-6 py-20 sm:py-28">
          <Link
            to="/"
            className="text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            ← Back
          </Link>

          <h1 className="mt-6 font-display text-3xl tracking-tight sm:text-4xl">
            Privacy Policy
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

          <div className="mt-10 space-y-9">
            <p className="text-sm leading-relaxed text-foreground/75">
              This policy explains what Arevias collects, why, and the choices you
              have. We try to collect as little as possible and keep the most
              sensitive thing — your conversations — off our servers entirely.
            </p>

            <Section title="Information we collect">
              <p>
                <strong className="text-foreground/90">Account information.</strong>{" "}
                When you sign up we store your email address (via our authentication
                provider) and, if you sign in with Google, the basic profile details
                Google shares.
              </p>
              <p>
                <strong className="text-foreground/90">Profile &amp; personalization.</strong>{" "}
                Anything you choose to add — display name, handle, bio, avatar, and
                your personalization settings (how you want Arevias to respond) — is
                stored so we can power your experience.
              </p>
              <p>
                <strong className="text-foreground/90">Technical data.</strong>{" "}
                To prevent abuse and enforce rate limits we store a one-way{" "}
                <em>hash</em> of your IP address — never the raw IP itself.
              </p>
            </Section>

            <Section title="Your conversations stay on your device">
              <p>
                Your chat history with Arevias is stored locally in your browser, not
                on our servers. We cannot read your past conversations, and clearing
                your browser data removes them.
              </p>
              <p>
                When you send a message, that message — along with the context and
                personalization needed to reply — is sent to our AI provider (Google,
                via the Gemini API) to generate a response. It is processed to produce
                your reply and is subject to Google&apos;s terms.
              </p>
            </Section>

            <Section title="How we use your information">
              <p>
                To provide and personalize the service, generate AI responses,
                maintain your account, keep the service secure, prevent abuse, and
                communicate with you about your account.
              </p>
            </Section>

            <Section title="Who we share it with">
              <p>
                We do not sell your personal information. We share data only with the
                service providers that run Arevias:
              </p>
              <p>
                <strong className="text-foreground/90">Supabase</strong> — database,
                authentication, and file storage. <br />
                <strong className="text-foreground/90">Google (Gemini API)</strong> —
                generating AI replies from the messages you send.
              </p>
            </Section>

            <Section title="Your rights & choices">
              <p>
                You can view and edit your profile and personalization at any time
                from your account. You can permanently delete your account — and the
                data associated with it — from Settings; this cannot be undone.
              </p>
            </Section>

            <Section title="Cookies & local storage">
              <p>
                We use cookies and browser storage strictly to keep you signed in and
                to store your conversations and preferences on your device. We do not
                use them for advertising.
              </p>
            </Section>

            <Section title="Data security">
              <p>
                We protect access with row-level security, encrypted-at-rest storage
                through our provider, server-only secrets, and rate limiting. No system
                is perfectly secure, but we take reasonable measures to safeguard your
                data.
              </p>
            </Section>

            <Section title="Children">
              <p>
                Arevias is not intended for anyone under 13 (or the minimum age in your
                country). We do not knowingly collect data from children.
              </p>
            </Section>

            <Section title="Changes to this policy">
              <p>
                We may update this policy from time to time. Material changes will be
                reflected by the “last updated” date above.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about your privacy? Email us at{" "}
                <a
                  href="mailto:privacy@arevias.com"
                  className="text-foreground underline underline-offset-4"
                >
                  privacy@arevias.com
                </a>
                .
              </p>
            </Section>
          </div>
        </div>
      </div>
    </PageTransition>
  );
}
