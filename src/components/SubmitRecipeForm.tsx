"use client";

/**
 * Local recipe-draft foundation. It creates a structured file in the platform
 * shape, but does not upload, submit, moderate or publish anything.
 */
import { useState } from "react";

interface DraftIngredient { name: string; quantity: string; unit: string; }

const DRAFTS_KEY = "ca:recipe-drafts";
const LEGACY_DRAFTS_KEY = "ca:submitted-drafts";

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
  const [saved, setSaved] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  function buildDraft() {
    const slug = title.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    return {
      id: `ca-${slug}`,
      slug,
      title: title.trim(),
      nativeTitle: nativeTitle.trim() || null,
      description: story.trim().slice(0, 200) || `A family recipe draft by ${contributor.trim() || "a home cook"}.`,
      cuisine: cuisine.trim().toLowerCase(),
      region: region.trim() || null,
      language,
      ingredients: ingredients
        .filter((ingredient) => ingredient.name.trim())
        .map((ingredient) => ({
          name: ingredient.name.trim(),
          normalizedName: ingredient.name.trim().toLowerCase().replace(/\s+/g, "-"),
          quantity: ingredient.quantity ? Number(ingredient.quantity) || null : null,
          unit: ingredient.unit || null,
          optional: false,
        })),
      steps: steps.filter((step) => step.trim()).map((text, index) => ({ order: index + 1, text: text.trim() })),
      culturalNote: story.trim() || null,
      author: contributor.trim() || "Anonymous home cook",
      source: "Local community recipe draft",
      sourceUrl: null,
      license: "original",
      verificationStatus: "community_submitted",
      image: null,
      imageLicense: null,
      draftSavedAt: new Date().toISOString(),
      submissionStatus: "local_only_not_submitted",
    };
  }

  function saveDraft() {
    setErrorMsg(null);
    if (!title.trim()) return setErrorMsg("Give your recipe a title.");
    if (!cuisine.trim()) return setErrorMsg("Which cuisine or community does this come from?");
    if (ingredients.filter((ingredient) => ingredient.name.trim()).length < 2) return setErrorMsg("List at least two ingredients.");
    if (steps.filter((step) => step.trim()).length < 2) return setErrorMsg("Describe at least two steps.");
    if (!rightsConfirmed) return setErrorMsg("Please confirm this recipe is yours to share.");

    const draft = buildDraft();
    try {
      const current = JSON.parse(localStorage.getItem(DRAFTS_KEY) ?? localStorage.getItem(LEGACY_DRAFTS_KEY) ?? "[]");
      localStorage.setItem(DRAFTS_KEY, JSON.stringify([...current, draft]));
      localStorage.removeItem(LEGACY_DRAFTS_KEY);
    } catch {
      // Storage may be unavailable. The user can still download the draft file.
    }
    setSaved(true);
  }

  function download() {
    const draft = buildDraft();
    const blob = new Blob([JSON.stringify(draft, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `${draft.slug || "recipe"}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  }

  const input = "w-full rounded-xl border border-cardamom bg-rice px-4 py-2.5 text-sm outline-none focus:border-turmeric placeholder:text-tamarind-faint";
  const label = "block text-sm font-medium text-tamarind-soft mb-1.5 mt-5 first:mt-0";

  if (saved) {
    return (
      <div className="rounded-card border border-curry/30 bg-curry-tint p-8 text-center">
        <p className="font-display text-2xl text-curry">Draft saved on this device</p>
        <p className="mx-auto mt-3 max-w-md text-sm text-tamarind-soft">
          Nothing was uploaded or submitted. Nobody has reviewed this draft, and it is not published.
          It remains in this browser until you clear browser data. Download the structured JSON below
          to keep a separate copy.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button onClick={download} className="rounded-full bg-turmeric px-5 py-2.5 text-sm font-semibold text-tamarind">
            Download draft JSON
          </button>
          <button onClick={() => setSaved(false)} className="rounded-full border border-cardamom bg-card px-5 py-2.5 text-sm font-medium">
            Create another draft
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-cardamom bg-card p-6 shadow-lift sm:p-8">
      <div className="mb-6 rounded-card bg-turmeric-tint/60 p-4 text-sm text-tamarind-soft">
        <strong>This is a local draft tool, not a submission form.</strong> Saving stores the draft only
        in this browser. Accounts, uploading and moderation are not active yet.
      </div>

      <label className={label} htmlFor="sr-title">Recipe title</label>
      <input id="sr-title" className={input} value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Paatti's kathirikai curry" />

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="sr-native">Native title (any script)</label>
          <input id="sr-native" className={input} value={nativeTitle} onChange={(event) => setNativeTitle(event.target.value)} placeholder="பாட்டி கத்திரிக்காய் கறி" />
        </div>
        <div>
          <label className={label} htmlFor="sr-lang">Language</label>
          <select id="sr-lang" className={input} value={language} onChange={(event) => setLanguage(event.target.value)}>
            <option value="en">English</option>
            <option value="ta">Tamil</option>
            <option value="hi">Hindi</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className={label} htmlFor="sr-cuisine">Cuisine / community</label>
          <input id="sr-cuisine" className={input} value={cuisine} onChange={(event) => setCuisine(event.target.value)} placeholder="Tamil, Chettinad, Kerala…" />
        </div>
        <div>
          <label className={label} htmlFor="sr-region">Region / town (optional)</label>
          <input id="sr-region" className={input} value={region} onChange={(event) => setRegion(event.target.value)} placeholder="Madurai" />
        </div>
      </div>

      <label className={label}>Ingredients</label>
      <div className="space-y-2">
        {ingredients.map((ingredient, index) => (
          <div key={index} className="flex gap-2">
            <input
              className={input}
              value={ingredient.name}
              onChange={(event) => setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))}
              placeholder="Ingredient"
              aria-label={`Ingredient ${index + 1} name`}
            />
            <input
              className={`${input} max-w-20`}
              value={ingredient.quantity}
              onChange={(event) => setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: event.target.value } : item))}
              placeholder="Qty"
              aria-label={`Ingredient ${index + 1} quantity`}
            />
            <input
              className={`${input} max-w-24`}
              value={ingredient.unit}
              onChange={(event) => setIngredients((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, unit: event.target.value } : item))}
              placeholder="Unit"
              aria-label={`Ingredient ${index + 1} unit`}
            />
          </div>
        ))}
      </div>
      <button onClick={() => setIngredients((current) => [...current, { name: "", quantity: "", unit: "" }])} className="mt-2 text-sm font-medium text-turmeric-deep hover:underline">
        + Add ingredient
      </button>

      <label className={label}>Steps</label>
      <div className="space-y-2">
        {steps.map((step, index) => (
          <textarea
            key={index}
            className={`${input} min-h-16`}
            value={step}
            onChange={(event) => setSteps((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
            placeholder={`Step ${index + 1}`}
            aria-label={`Step ${index + 1}`}
          />
        ))}
      </div>
      <button onClick={() => setSteps((current) => [...current, ""])} className="mt-2 text-sm font-medium text-turmeric-deep hover:underline">
        + Add step
      </button>

      <label className={label} htmlFor="sr-story">The story behind it (optional)</label>
      <textarea id="sr-story" className={`${input} min-h-20`} value={story} onChange={(event) => setStory(event.target.value)} placeholder="Whose recipe is this? When is it cooked in your family?" />

      <label className={label} htmlFor="sr-name">Your name for the future contributor record</label>
      <input id="sr-name" className={input} value={contributor} onChange={(event) => setContributor(event.target.value)} placeholder="Febin from Chennai" />

      <label className="mt-6 flex items-start gap-3 rounded-xl border border-cardamom bg-rice p-4 text-sm text-tamarind-soft">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(event) => setRightsConfirmed(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-turmeric"
        />
        <span>
          This is my own recipe or a family/traditional recipe I have the right to share, written in my
          own words. I&apos;m not pasting text from a book, website or app. This confirmation is saved in
          the local draft but does not grant Cook Anything permission until a real submission flow exists.
        </span>
      </label>

      {errorMsg && <p className="mt-4 text-sm font-medium text-chilli">{errorMsg}</p>}

      <button onClick={saveDraft} className="mt-6 w-full rounded-card bg-turmeric px-6 py-3.5 font-semibold text-tamarind transition-colors hover:bg-turmeric-deep hover:text-rice sm:w-auto">
        Save draft on this device
      </button>
    </div>
  );
}
