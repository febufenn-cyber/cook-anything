"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import IngredientMatcher from "./IngredientMatcher";
import { kitchenRepository } from "@/lib/kitchen/repository";
import { isoNow } from "@/lib/kitchen/schema";
import type { LocalKitchenProfile, PantryItem } from "@/lib/kitchen/types";

export default function KitchenMatcherBridge() {
  const [ready, setReady] = useState(false);
  const [initialHave, setInitialHave] = useState<string[]>([]);
  const [profile, setProfile] = useState<LocalKitchenProfile | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    Promise.all([kitchenRepository.getProfile(), kitchenRepository.listPantryItems()])
      .then(([savedProfile, pantry]) => {
        if (cancelled) return;
        const available = pantry
          .filter((item) => item.status === "available" || item.status === "running_low")
          .map((item) => item.ingredientSlug);
        const url = new URL(window.location.href);
        const queryHave = url.searchParams.get("have")?.split(",").filter(Boolean) ?? [];
        const useSavedKitchen = queryHave.length === 0 && available.length > 0;
        if (useSavedKitchen) {
          url.searchParams.set("have", available.join(","));
          if (savedProfile.excludedIngredients.length) url.searchParams.set("avoid", savedProfile.excludedIngredients.join(","));
          if (savedProfile.dietaryPreferences[0]) url.searchParams.set("diet", savedProfile.dietaryPreferences[0]);
          url.searchParams.set("pantry", savedProfile.pantryProfile === "custom" ? "none" : savedProfile.pantryProfile);
          window.history.replaceState(null, "", url.toString());
        }
        setInitialHave(useSavedKitchen ? available : queryHave);
        setProfile(savedProfile);
        setReady(true);
      })
      .catch(() => setReady(true));
    return () => { cancelled = true; };
  }, []);

  const savedContext = useMemo(() => {
    if (!profile) return "";
    const details = [
      profile.dietaryPreferences[0],
      profile.allergensToAvoid.length ? `${profile.allergensToAvoid.length} allergen filter${profile.allergensToAvoid.length === 1 ? "" : "s"}` : "",
      profile.cookware.length ? `${profile.cookware.length} special tools` : "",
    ].filter(Boolean);
    return details.join(" · ");
  }, [profile]);

  async function saveCurrentKitchen() {
    const url = new URL(window.location.href);
    const have = [...new Set(url.searchParams.get("have")?.split(",").filter(Boolean) ?? [])];
    const avoid = [...new Set(url.searchParams.get("avoid")?.split(",").filter(Boolean) ?? [])];
    const diet = url.searchParams.get("diet");
    const pantry = url.searchParams.get("pantry");
    const now = isoNow();
    const currentProfile = profile ?? await kitchenRepository.getProfile();
    await Promise.all(have.map((ingredientSlug) => kitchenRepository.upsertPantryItem({
      ingredientSlug,
      status: "available",
      source: "user_added",
      updatedAt: now,
    } satisfies PantryItem)));
    const next: LocalKitchenProfile = {
      ...currentProfile,
      pantryProfile: pantry === "none" || pantry === "minimal" || pantry === "indian-basics" ? pantry : currentProfile.pantryProfile,
      dietaryPreferences: diet ? [diet] : [],
      excludedIngredients: avoid,
      updatedAt: now,
    };
    await kitchenRepository.saveProfile(next);
    setProfile(next);
    setMessage(`${have.length} ingredient${have.length === 1 ? "" : "s"} saved to this browser.`);
    window.setTimeout(() => setMessage(""), 3500);
  }

  if (!ready) return <p className="text-sm text-tamarind-faint">Loading your local kitchen…</p>;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-card border border-cardamom bg-card px-4 py-3 text-sm">
        <div>
          <p className="font-semibold">Your kitchen stays on this device</p>
          <p className="text-xs text-tamarind-faint">
            {initialHave.length ? `Reused ${initialHave.length} saved ingredients.` : "Nothing saved yet."}
            {savedContext ? ` ${savedContext}.` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void saveCurrentKitchen()} className="min-h-10 rounded-full bg-turmeric px-4 py-2 text-xs font-semibold text-tamarind">
            Save current kitchen
          </button>
          <Link href="/kitchen" className="min-h-10 rounded-full border border-cardamom bg-rice px-4 py-2 text-xs font-semibold">
            Manage my kitchen
          </Link>
        </div>
        {message && <p className="w-full text-xs font-medium text-curry" aria-live="polite">{message}</p>}
      </div>
      <IngredientMatcher initialHave={initialHave} />
    </div>
  );
}
