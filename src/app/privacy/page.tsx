import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Cook Anything stores locally, what may be cached offline, where companion content goes, and how to export or delete your data.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Privacy" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Search, local kitchen and drafts</h2>
          <p>
            Cook Anything currently runs without accounts and without advertising trackers. Ingredient
            searches are processed in your browser against a downloaded recipe index and are not sent
            to our server. Your pantry, explicit preferences, saved recipes, cooking history, shopping
            list and meal plan are stored in IndexedDB in this browser. Cook Mode progress and a few small
            settings use browser storage so interrupted sessions can recover.
          </p>
          <p>
            You can inspect, export, import or delete these records from <strong>My Kitchen</strong>. Kitchen
            exports do not include API keys, hosted cookies, companion messages or photos. A recipe draft
            saved on this device has not been submitted, uploaded, reviewed or published. Clearing browser
            data or using the delete-all control removes local records from this browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Offline application cache</h2>
          <p>
            If your browser supports service workers, Cook Anything may cache same-origin application
            pages, static assets, the recipe search index and the public trust manifest so previously
            available core features can work offline. A waiting application update is activated only when
            you choose to update; it is not forced during an active cooking session.
          </p>
          <p>
            The service worker is designed not to cache companion API routes, trusted companion snapshots,
            requests carrying authorization or API-key headers, cross-origin provider calls, companion
            messages, responses or photos. Deleting all local data also requests removal of Cook Anything
            application caches.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Bring-your-own-key companion</h2>
          <p>
            When you connect your own API key, companion messages and any photos you attach are sent
            directly from your browser to the provider and endpoint shown in the settings panel. They do
            not pass through the Cook Anything hosted companion server. A custom OpenAI-compatible endpoint
            receives both your API key and companion content, so continue only when you trust the exact
            hostname displayed.
          </p>
          <p>
            Your key is kept only in the current page session by default. It is written to persistent
            browser storage only when you explicitly select “Remember key on this device.” A remembered
            key remains raw browser data accessible to code running on this site until you disconnect it
            or clear browser data; it is not protected by meaningful device-level encryption from the site
            itself. Provider usage may be billed and processed or retained under the provider&apos;s terms.
          </p>
          <p>
            Do not attach faces, identity documents, private messages, medical records or other sensitive
            material to a cooking request. A kitchen photo may contain more personal information than you
            intended. Photo analysis cannot prove internal doneness, oil temperature, exact weight or
            allergen safety.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Hosted companion</h2>
          <p>
            Hosted companion execution remains disabled while its security and staging controls are
            verified. Before the first hosted session, the product shows the active processing notice.
            When enabled, hosted mode accepts text only. Your message, selected recipe, recent bounded
            conversation context and cooking state may be processed through Cloudflare and either the
            configured AI provider or the private companion bridge.
          </p>
          <p>
            Hosted sessions use a random secure browser cookie rather than an account. Bounded conversation
            history and cooking state are stored temporarily so the session can continue. The service is
            configured to delete an inactive session after approximately two hours. Closing the companion
            sends a deletion request and clears the session cookie, although an interrupted network request
            may leave server data until automatic expiry.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Recipe trust and allergen information</h2>
          <p>
            Allergen, dietary and safety information is derived from canonical ingredient metadata and
            recipe declarations unless a page explicitly identifies a human review. Automated assessment
            is not an allergen-free guarantee, medical advice or proof against packaged-product
            cross-contact. Check the labels of the exact products you use and seek qualified medical advice
            where a food allergy or health condition makes mistakes consequential.
          </p>
          <p>
            Most current recipes are structurally validated drafts and are not cook-tested. Trust records
            are version-bound so material recipe changes cannot silently inherit stronger evidence from an
            older version.
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
