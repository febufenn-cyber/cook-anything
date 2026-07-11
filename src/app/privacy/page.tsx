import type { Metadata } from "next";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Cook Anything stores locally, what optional sync and family-recipe review send to the cloud, where companion content goes, and how to export or delete data.",
  alternates: { canonical: "/privacy/" },
};

export default function PrivacyPage() {
  return (
    <>
      <PageHero eyebrow="Trust" title="Privacy" />
      <div className="mx-auto max-w-3xl space-y-8 px-4 py-10 leading-relaxed text-tamarind-soft sm:px-6">
        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Anonymous use and local data</h2>
          <p>
            Cook Anything remains usable without an account and without advertising trackers. Ingredient
            searches are processed in your browser against a downloaded recipe index and are not sent to
            the synchronization service. Your pantry, explicit preferences, saved recipes, cooking history,
            shopping list and meal plan are stored in IndexedDB in this browser. Cook Mode progress and a
            few small settings use browser storage so interrupted sessions can recover.
          </p>
          <p>
            Private family-recipe drafts, immutable local versions and local submission references use a
            separate IndexedDB database. The first visit to the Living Cookbook may migrate older browser-only
            recipe drafts out of localStorage. Saving a family recipe locally does not upload, submit, review or
            publish it.
          </p>
          <p>
            You can inspect, export, import or delete ordinary kitchen records from <strong>My Kitchen</strong>,
            and manage family-recipe drafts from <strong>My Recipes</strong>. Exports do not include API keys,
            account tokens, hosted cookies, companion messages or photos. Clearing browser data removes local
            records. Product delete controls also request removal of the applicable kitchen, sync, contribution
            and Cook Anything cache stores from that browser.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Optional account and kitchen synchronization</h2>
          <p>
            An account is optional. When you sign in and explicitly choose a migration strategy, Cook Anything
            may synchronize your kitchen profile, pantry items, saved-recipe metadata, explicit cooking history,
            shopping items and meal-plan entries through the configured Supabase project. Local changes save to
            this browser first and may remain queued while offline or when sync is paused.
          </p>
          <p>
            Synchronization uses record identifiers, server revisions, device identifiers, tombstones, mutation
            receipts and cursors to prevent duplicate writes and silent whole-kitchen replacement. True concurrent
            edits may be stored as visible conflicts. Allergen exclusions and explicitly excluded ingredients are
            conservatively combined rather than silently weakened. A migration or conflict choice creates a local
            recovery snapshot that expires after approximately 14 days.
          </p>
          <p>
            Authentication access and refresh tokens are stored in this browser so the account session can
            continue. They are never included in kitchen records or exports. Synced records are encrypted in
            transit and protected by the cloud provider&apos;s storage controls; this is not end-to-end encryption
            because the synchronization service can process record contents.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Private family recipes and submissions</h2>
          <p>
            Signed-in users may save versioned recipe drafts to a personal cloud cookbook or an explicitly selected
            household. Those records can contain recipe text, family stories, native-language titles, contributor
            names or pseudonyms, rights declarations, AI-assistance disclosures, allergen declarations and safety
            notes. Household members can see only drafts within households they are authorized to access.
          </p>
          <p>
            Submission freezes one exact version and content hash. Automated findings, editorial and safety reviews,
            cook-test evidence, workflow events and publication-candidate status are stored so the process can be
            audited. Authorized reviewers may see the submitted version and associated private evidence. Contributors
            cannot review, cook-test or approve publication of their own submission.
          </p>
          <p>
            Saving, synchronizing, submitting, editorial approval and publication are separate states. A browser
            cannot directly add content to the public recipe corpus. Approved candidates first enter a quarantined
            draft GitHub pull request. They become public only after canonical metadata, rights and trust evidence are
            reviewed and the repository&apos;s complete publication gate passes.
          </p>
          <p>
            A contributor chooses whether a public name or pseudonym and cultural story may appear. Internal account
            identifiers, email addresses and contact details must not enter public recipe JSON. Published text may
            remain available under the selected licence even after account deletion, subject to the published
            contribution and takedown policy. Unpublished private drafts and submissions follow the account-deletion
            process.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Devices, households and sharing</h2>
          <p>
            Signed-in users may see and revoke registered devices. A private household invitation is random,
            single-use, email-bound and time-limited. Household membership and authorization are enforced by the
            database. Personal cooking history, personal safety preferences, API keys, provider settings and
            companion content are not automatically shared with a household.
          </p>
          <p>
            Household recipe drafts use a separate scope from personal drafts and public recipes. Household editors
            may collaborate on new immutable draft versions; viewers cannot edit. Removing a member removes future
            access but does not rewrite historical authorship and audit records.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Sign-out, export and deletion</h2>
          <p>
            Signing out removes the account session and local synchronization binding but keeps browser-local data.
            Cloud export contains records the user is authorized to read and excludes authentication tokens, BYOK
            credentials and companion content. Requesting cloud account deletion revokes registered devices and
            creates a deletion request; completion depends on the configured trusted backend process. You separately
            choose whether browser-local data should also be erased.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Offline application cache</h2>
          <p>
            If your browser supports service workers, Cook Anything may cache same-origin application pages, static
            assets, the recipe search index and the public trust manifest so previously available core features can
            work offline. A waiting application update is activated only when you choose to update; it is not forced
            during an active cooking session.
          </p>
          <p>
            The service worker is designed not to cache companion API routes, trusted companion snapshots,
            authenticated synchronization or contribution requests, OAuth callbacks, requests carrying authorization
            or API-key headers, cross-origin provider calls, companion messages, responses or photos.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Bring-your-own-key companion</h2>
          <p>
            When you connect your own API key, companion messages and any photos you attach are sent directly from
            your browser to the provider and endpoint shown in the settings panel. They do not pass through the Cook
            Anything hosted companion server, kitchen synchronization service or recipe-review system. A custom
            OpenAI-compatible endpoint receives both your API key and companion content, so continue only when you
            trust the exact hostname displayed.
          </p>
          <p>
            Your key is kept only in the current page session by default. It is written to persistent browser storage
            only when you explicitly select “Remember key on this device.” A remembered key remains raw browser data
            accessible to code running on this site until you disconnect it or clear browser data. Provider usage may
            be billed and processed or retained under the provider&apos;s terms.
          </p>
          <p>
            Do not attach faces, identity documents, private messages, medical records or other sensitive material to
            a cooking request. Photo analysis cannot prove internal doneness, oil temperature, exact weight or
            allergen safety.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Hosted companion</h2>
          <p>
            Hosted companion execution remains disabled while its security and staging controls are verified. Before
            the first hosted session, the product shows the active processing notice. When enabled, hosted mode
            accepts text only. Your message, selected recipe, recent bounded conversation context and cooking state
            may be processed through Cloudflare and either the configured AI provider or private companion bridge.
          </p>
          <p>
            Hosted sessions use a random secure browser cookie rather than an account. Bounded conversation history
            and cooking state are stored temporarily and configured to expire after approximately two hours of
            inactivity. Closing the companion sends a deletion request and clears the session cookie.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Recipe trust and allergen information</h2>
          <p>
            Allergen, dietary and safety information is derived from canonical ingredient metadata and recipe
            declarations unless a page explicitly identifies human review. Automated assessment is not an
            allergen-free guarantee, medical advice or proof against packaged-product cross-contact. Check the exact
            products you use and seek qualified medical advice where mistakes are consequential.
          </p>
          <p>
            Most current public recipes are structurally validated drafts and are not cook-tested. Family-recipe cook
            tests are version-bound evidence, not formal food-safety or medical certification. Material recipe changes
            cannot silently inherit stronger evidence from an older version.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display text-2xl text-tamarind">Security and operational logs</h2>
          <p>
            Cloudflare, Supabase, GitHub and our server infrastructure may process standard technical metadata such as
            IP address, user agent, requested URL, request timing, status and abuse-control counters. Moderation and
            publication logs are designed to record identifiers, states and operational outcomes rather than full
            private recipe stories, API keys, tokens or companion content. Security incidents and legal obligations
            may require limited additional investigation.
          </p>
        </section>
      </div>
    </>
  );
}
