import { createFileRoute, Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

import { PageTransition } from "@/components/arevias/page-transition";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
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

function TermsPage() {
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
            Terms of Service
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">Last updated: June 2026</p>

          <div className="mt-10 space-y-9">
            <p className="text-sm leading-relaxed text-foreground/75">
              These terms govern your use of Arevias. By creating an account or using
              the service, you agree to them.
            </p>

            <Section title="Eligibility">
              <p>
                You must be at least 13 years old (or the minimum age in your country)
                to use Arevias. By using it, you confirm you meet this requirement.
              </p>
            </Section>

            <Section title="Your account">
              <p>
                You are responsible for keeping your login credentials secure and for
                activity that happens under your account. Let us know promptly if you
                suspect unauthorized access.
              </p>
            </Section>

            <Section title="Acceptable use">
              <p>You agree not to use Arevias to:</p>
              <p>
                break the law; harass, harm, or impersonate others; generate or
                distribute illegal, hateful, or abusive content; attempt to disrupt,
                overload, or reverse-engineer the service; or circumvent rate limits,
                security, or access controls.
              </p>
            </Section>

            <Section title="AI-generated content">
              <p>
                Arevias produces responses using AI. Output can be inaccurate,
                incomplete, or inappropriate, and may not reflect real facts. It is not
                professional, legal, medical, or financial advice — use your own
                judgment and verify anything important.
              </p>
            </Section>

            <Section title="Your content">
              <p>
                You retain ownership of the content you submit. You grant us the
                limited rights needed to operate the service — for example, sending your
                messages to our AI provider to generate replies, and storing your
                profile so the app works.
              </p>
            </Section>

            <Section title="Service availability">
              <p>
                Arevias is offered on an “as is” and “as available” basis. We may
                change, suspend, or discontinue features at any time, and we don&apos;t
                guarantee uninterrupted or error-free service.
              </p>
            </Section>

            <Section title="Limitation of liability">
              <p>
                To the fullest extent permitted by law, Arevias and its operators are
                not liable for indirect, incidental, or consequential damages arising
                from your use of the service.
              </p>
            </Section>

            <Section title="Termination">
              <p>
                You may delete your account at any time from Settings. We may suspend or
                terminate access if these terms are violated.
              </p>
            </Section>

            <Section title="Changes to these terms">
              <p>
                We may update these terms from time to time. Continued use after changes
                means you accept the updated terms.
              </p>
            </Section>

            <Section title="Contact">
              <p>
                Questions about these terms? Email us at{" "}
                <a
                  href="mailto:support@arevias.com"
                  className="text-foreground underline underline-offset-4"
                >
                  support@arevias.com
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
