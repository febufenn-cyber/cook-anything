import type { Metadata } from "next";
import AccountPanel from "@/components/AccountPanel";
import CloudDataTools from "@/components/CloudDataTools";
import PageHero from "@/components/PageHero";

export const metadata: Metadata = {
  title: "Account and kitchen sync",
  description: "Optionally keep your Cook Anything kitchen across devices with conflict-safe local-first synchronization.",
  alternates: { canonical: "/account/" },
  robots: { index: false },
};

export default function AccountPage() {
  return (
    <>
      <PageHero
        eyebrow="Optional portable kitchen"
        title="Your kitchen on every device"
        intro="Cook Anything remains fully usable without an account. Sign in only when you want encrypted-in-transit cloud backup, multi-device synchronization or a private household space."
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <AccountPanel />
        <CloudDataTools />
      </div>
    </>
  );
}
