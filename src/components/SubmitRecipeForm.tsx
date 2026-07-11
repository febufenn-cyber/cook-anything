"use client";

/**
 * Recipe submission foundation. Produces a structured draft in the exact
 * platform schema (verificationStatus: community_submitted), saved locally
 * and downloadable as JSON — ready to plug into a real backend later.
 */
import { useState } from "react";

interface DraftIngredient { name: string; quantity: string; unit: string; }

const DRAFTS_KEY = "ca:submitted-drafts";

export default function SubmitRecipeForm() {
  const [title, setTitle] = useState("");
  const [nativeTitle, setNativeTitle] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("en");
  const [story, setStory] = useState("");
  const [contributor, setContributor] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([{ name: "", quantity: "", unit: "" }]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function buildDraft() {
    const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `ca-${slug}`,
      slug,
      title: title.trim(),
      nativeTitle: nativeTitle.trim() || null,
      description: story.trim().slice(0, 200) || `A family recipe shared by ${contributor.trim() || "a home cook"}.`,
      cuisine: cuisine.trim().toLowerCase(),
      region: region.trim() || null,
      language,
      ingredients: ingredients
        .filter((i) => i.name.trim())
        .map((i) => ({
          name: i.name.trim(),
          normalizedName: i.name.trim().toLowerCase().replace(/\s+/g, "-"),
          quantity: i.quantity ? Number(i.quantity) || null : null,
          unit: i.unit || null,
          optional: false,
        })),
      steps: steps.filter((s) => s.trim()).map((text, i) => ({ order: i + 1, text: text.trim() })),
      culturalNote: story.trim() || null,
      author: contributor.trim() || "Anonymous home cook",
      source: "Community submission",
      sourceUrl: null,
      license: "original",
      verificationStatus: "community_submitted",
      image: null,
      imageLicense: null,
      submittedAt: new Date().toISOString(),
    };
  }

  function submit() {
    setErrorMsg(null);
    if (!title.trim()) return setErrorMsg("Give your recipe a title.");
    if (!cuisine.trim()) return setErrorMsg("Which cuisine or community does this come from?");
    if (ingredients.filter((i) => i.name.trim()).length < 2) return setErrorMsg("List at least two ingredients.");
    if (steps.filter((s) => s.trim()).length < 2) return setErrorMsg("Describe at least two steps.");
    if (!rightsConfirmed) return setErrorMsg("Please confirm this recipe is yours to share.");

    const draft = buildDraft();
    try {
      const existing = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? "[]");
      localStorage.setItem(DRAFTS_KEY, JSON.stringify([...existing, draft]));
    } catch { /* storage full/blocked — download still works */ }
    setSubmitted(true);
  }

  function download() {
    const blob = new Blob([JSON.stringify(buildDraft(), null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${buildDraft().slug || "recipe"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const input = "w-full rounded-xl border border-cardamom bg-rice px-4 py-2.5 text-sm outline-none focus:border-turmeric placeholder:text-tamarind-faint";
  const label = "block text-sm font-medium text-tamarind-soft mb-1.5 mt-5 first:mt-0";

  if (submitted) {
    return (
      <div className="rounded-card border border-curry/30 bg-curry-tint p-8 text-center">
        <p className="font-display text-2xl text-curry">Nandri! Recipe received 🌿</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-tamarind-soft">
          Your recipe is saved as a <strong>community draft</strong> on this device. Community
          recipes are published with the &ldquo;community submitted&rdquo; badge after moderation —
          publishing accounts are coming soon. You can download your structured draft below.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button onClick={download} className="rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind">
            Download draft JSON
          </button>
          <button onClick={() => setSubmitted(false)} className="rounded-full border border-cardamom bg-card px-5 py-2.5 text-sm font-medium">
            Submit another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-cardamom bg-card p-6 shadow-lift sm:p-8">
      <label className={label} htmlFor="sr-title">Recipe title</label>
      <input id="sr-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Paatti's kathirikai curry" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="sr-native">Native title (any script)</label>
          <input id="sr-native" className={input} value={nativeTitle} onChange={(e) => setNativeTitle(e.target.value)} placeholder="பாட்டி கத்திரிக்காய் கறி" />
        </div>
        <div>
          <label className={label} htmlFor="sr-lang">Language</label>
          <select id="sr-lang" className={input} value={language} onChange={(e) => setLanguage(e.target.value)}>
            <option value="en">English</option>
            <option value="ta">Tamil</option>
            <option value="hi">Hindi</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sr-cuisine">Cuisine / community</label>
          <input id="sr-cuisine" className={input} value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Tamil, Chettinad, Kerala…" />
        </div>
        <div>
          <label className={label} htmlFor="sr-region">Region / town (optional)</label>
          <input id="sr-region" className={input} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Madurai" />
        </div>
      </div>

      <label className={label}>Ingredients</label>
      <div className="space-y-2">
        {ingredients.map((ing, i) => (
          <div key={i} className="flex gap-2">
            <input
              className={input}
              value={ing.name}
              onChange={(e) => setIngredients((arr) => arr.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
              placeholder="Ingredient"
              aria-label={`Ingredient ${i + 1} name`}
            />
            <input
              className={`${input} max-w-20`}
              value={ing.quantity}
              onChange={(e) => setIngredients((arr) => arr.map((x, j) => (j === i ? { ...x, quantity: e.target.value } : x)))}
              placeholder="Qty"
              aria-label={`Ingredient ${i + 1} quantity`}
            />
            <input
              className={`${input} max-w-24`}
              value={ing.unit}
              onChange={(e) => setIngredients((arr) => arr.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))}
              placeholder="Unit"
              aria-label={`Ingredient ${i + 1} unit`}
            />
          </div>
        ))}
      </div>
      <button onClick={() => setIngredients((a) => [...a, { name: "", quantity: "", unit: "" }])} className="mt-2 text-sm font-medium text-turmeric-deep hover:underline">
        + Add ingredient
      </button>

      <label className={label}>Steps</label>
      <div className="space-y-2">
        {steps.map((s, i) => (
          <textarea
            key={i}
            className={`${input} min-h-16`}
            value={s}
            onChange={(e) => setSteps((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
            placeholder={`Step ${i + 1}`}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
      <button onClick={() => setSteps((a) => [...a, ""])} className="mt-2 text-sm font-medium text-turmeric-deep hover:underline">
        + Add step
      </button>

      <label className={label} htmlFor="sr-story">The story behind it (optional)</label>
      <textarea id="sr-story" className={`${input} min-h-20`} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Whose recipe is this? When is it cooked in your family?" />

      <label className={label} htmlFor="sr-name">Your name (shown as contributor)</label>
      <input id="sr-name" className={input} value={contributor} onChange={(e) => setContributor(e.target.value)} placeholder="Febin from Chennai" />

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-cardamom bg-rice p-4 text-sm text-tamarind-soft">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => setRightsConfirmed(e.target.checked)}
          className="mt-0.5 h-4 w-4 accent-turmeric"
        />
        <span>
          This is my own recipe or a family/traditional recipe I have the right to share, written
          in my own words. I&apos;m not pasting text from a book, website, or app. It will be published
          under the <strong>community submitted</strong> status.
        </span>
      </label>

      {errorMsg && <p className="mt-4 text-sm font-medium text-chilli">{errorMsg}</p>}

      <button onClick={submit} className="mt-6 w-full rounded-card bg-turmeric px-6 py-3.5 font-semibold text-tamarind transition-colors hover:bg-turmeric-deep hover:text-rice sm:w-auto">
        Submit recipe
      </button>
    </div>
  );
}
