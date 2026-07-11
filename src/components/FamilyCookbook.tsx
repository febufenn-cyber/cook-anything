"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { readSaved, writeSaved, type SavedRecipe } from "./SaveRecipeButton";
import { titleFromSlug } from "@/lib/format";

export default function FamilyCookbook() {
  const [saved, setSaved] = useState<SavedRecipe[]>([]);
  const [mounted, setMounted] = useState(false);
  const [newCollection, setNewCollection] = useState("");
  const [collections, setCollections] = useState<string[]>([]);

  useEffect(() => {
    setMounted(true);
    const refresh = () => {
      const list = readSaved();
      setSaved(list);
      setCollections([...new Set(["Saved", ...list.map((s) => s.collection)])]);
    };
    refresh();
    window.addEventListener("ca:saved-changed", refresh);
    return () => window.removeEventListener("ca:saved-changed", refresh);
  }, []);

  function moveTo(slug: string, collection: string) {
    writeSaved(readSaved().map((s) => (s.slug === slug ? { ...s, collection } : s)));
  }
  function remove(slug: string) {
    writeSaved(readSaved().filter((s) => s.slug !== slug));
  }
  function addCollection() {
    const name = newCollection.trim();
    if (name && !collections.includes(name)) setCollections((c) => [...c, name]);
    setNewCollection("");
  }

  if (!mounted) return <p className="text-sm text-tamarind-faint">Opening your cookbook…</p>;

  if (saved.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-cardamom bg-card p-10 text-center">
        <p className="font-display text-xl">Your cookbook is empty</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-tamarind-soft">
          Save recipes as you browse and organise them into collections — weeknight dinners,
          grandmother&apos;s festival dishes, gym meal-prep. Saved recipes stay on this device;
          accounts and family sharing are on the way.
        </p>
        <Link
          href="/what-can-i-cook"
          className="mt-5 inline-block rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind"
        >
          Find something to cook
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={newCollection}
          onChange={(e) => setNewCollection(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCollection()}
          placeholder="New collection, e.g. Paatti's recipes"
          className="rounded-full border border-cardamom bg-card px-4 py-2 text-sm outline-none focus:border-turmeric"
        />
        <button
          onClick={addCollection}
          className="rounded-full border border-cardamom bg-card px-4 py-2 text-sm font-medium hover:border-turmeric"
        >
          + Create collection
        </button>
        <p className="w-full text-xs text-tamarind-faint sm:ml-auto sm:w-auto">
          Stored privately on this device · {saved.length} recipe{saved.length === 1 ? "" : "s"}
        </p>
      </div>

      {collections.map((col) => {
        const items = saved.filter((s) => s.collection === col);
        if (items.length === 0 && col !== "Saved") return null;
        return (
          <section key={col} className="mt-8">
            <h2 className="font-display text-xl">{col}</h2>
            <ul className="mt-3 divide-y divide-cardamom rounded-card border border-cardamom bg-card shadow-lift">
              {items.length === 0 && (
                <li className="p-5 text-sm text-tamarind-faint">Nothing saved here yet.</li>
              )}
              {items.map((s) => (
                <li key={s.slug} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <Link href={`/recipes/${s.slug}`} className="min-w-0 flex-1 font-medium hover:text-turmeric-deep">
                    {s.title}
                    <span className="ml-2 text-xs font-normal text-curry">{titleFromSlug(s.cuisine)}</span>
                  </Link>
                  <select
                    value={s.collection}
                    onChange={(e) => moveTo(s.slug, e.target.value)}
                    className="rounded-lg border border-cardamom bg-rice px-2 py-1 text-xs"
                    aria-label={`Move ${s.title} to collection`}
                  >
                    {collections.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(s.slug)}
                    className="text-xs font-medium text-chilli hover:underline"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
