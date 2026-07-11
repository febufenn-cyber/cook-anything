import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Cook Anything processes, where it goes, and how long companion sessions last.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Privacy" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Search, saved recipes and drafts</h2>
          <p>
            Cook Anything currently runs without accounts and without advertising trackers. Ingredient
            searches are processed in your browser against a downloaded recipe index and are not sent
            to our server. Saved recipes, cookbook collections and submitted recipe drafts are stored
            in your browser&apos;s local storage on your device; clearing browser data removes them.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Bring-your-own-key companion</h2>
          <p>
            When you connect your own API key, companion messages and any photos you attach are sent
            directly from your browser to the provider and endpoint you selected. They do not pass
            through the Cook Anything companion server. Your key is currently stored in this browser
            until you disconnect it or clear browser data. Your provider may charge for requests and
            process or retain content under its own terms and privacy policy.
          </p>
          <p>
            Do not attach faces, identity documents, private messages or other sensitive material to a
            cooking request. A kitchen photo may contain more personal information than you intended.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Hosted companion</h2>
          <p>
            Hosted companion execution is disabled while its Phase 1 security controls are verified.
            When it is enabled, hosted mode will accept text only. Your message, the selected recipe,
            recent conversation context and cooking state will be processed through Cloudflare and
            either Anthropic or our private companion bridge, depending on the active backend.
          </p>
          <p>
            Hosted cooking sessions are associated with a random, secure browser cookie rather than an
            account. Their bounded conversation history and cooking state are stored temporarily so the
            companion can continue the same cooking session. The service is configured to erase an
            inactive session after approximately two hours, and closing a session may erase it sooner.
            Hosted mode does not accept kitchen photos during Phase 1.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Security and operational logs</h2>
          <p>
            Cloudflare and our server infrastructure may process standard technical metadata such as IP
            address, user agent, requested URL, request timing, status and abuse-control counters. The
            companion bridge is designed to log operational outcomes rather than full cooking messages,
            prompts, API keys or photos. Security incidents and provider requirements may require limited
            additional investigation.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Future accounts and publishing</h2>
          <p>
            Before accounts, community publishing or cloud sync store additional personal data, this
            policy will be updated and the feature will explain the change at the point of use.
          </p>
        </section>
      </div>
    </>
  );
}
