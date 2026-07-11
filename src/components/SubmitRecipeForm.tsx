"use client";

import { useEffect, useMemo, useState } from "react";
import { usePortableKitchen } from "./PortableKitchenProvider";
import { contributionRepository } from "@/lib/contributions/local-store";
import { saveCloudDraftVersion, submitCloudVersion } from "@/lib/contributions/cloud";
import type {
  AiAssistance,
  ContributionScope,
  DraftIngredient,
  DraftStep,
  PublicationLicence,
  RecipeDraftContent,
  RightsAttestation,
  SourceType,
} from "@/lib/contributions/types";

function id(prefix: string): string {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

const emptyIngredient = (): DraftIngredient => ({ id: id("ingredient"), name: "", optional: false });
const emptyStep = (order: number): DraftStep => ({ id: id("step"), order, text: "" });

export default function SubmitRecipeForm() {
  const { configured, session, households } = usePortableKitchen();
  const [draftId, setDraftId] = useState<string | undefined>();
  const [title, setTitle] = useState("");
  const [nativeTitle, setNativeTitle] = useState("");
  const [description, setDescription] = useState("");
  const [cuisine, setCuisine] = useState("");
  const [region, setRegion] = useState("");
  const [language, setLanguage] = useState("en");
  const [servings, setServings] = useState(4);
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [story, setStory] = useState("");
  const [ingredients, setIngredients] = useState<DraftIngredient[]>([emptyIngredient(), emptyIngredient()]);
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep(1), emptyStep(2)]);
  const [cookware, setCookware] = useState("");
  const [allergens, setAllergens] = useState<string[]>([]);
  const [dietary, setDietary] = useState("");
  const [safetyNotes, setSafetyNotes] = useState("");
  const [sourceType, setSourceType] = useState<SourceType>("family");
  const [aiAssistance, setAiAssistance] = useState<AiAssistance>("none");
  const [aiNotes, setAiNotes] = useState("");
  const [publicName, setPublicName] = useState("");
  const [licence, setLicence] = useState<PublicationLicence>("CC-BY-4.0");
  const [publishStory, setPublishStory] = useState(false);
  const [ownWords, setOwnWords] = useState(false);
  const [rightToShare, setRightToShare] = useState(false);
  const [target, setTarget] = useState("local");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void contributionRepository.migrateLegacyDrafts();
    if (typeof window === "undefined") return;
    const requested = new URLSearchParams(window.location.search).get("draft");
    if (!requested) return;
    void contributionRepository.getDraft(requested).then(async (draft) => {
      if (!draft) return;
      const version = await contributionRepository.getVersion(draft.latestVersionId);
      if (!version) return;
      const content = version.content;
      setDraftId(draft.id);
      setTitle(content.title);
      setNativeTitle(content.nativeTitle ?? "");
      setDescription(content.description);
      setCuisine(content.cuisine);
      setRegion(content.region ?? "");
      setLanguage(content.language);
      setServings(content.servings);
      setPrepMinutes(content.prepMinutes?.toString() ?? "");
      setCookMinutes(content.cookMinutes?.toString() ?? "");
      setStory(content.culturalStory ?? "");
      setIngredients(content.ingredients);
      setSteps(content.steps);
      setCookware(content.cookware.join(", "));
      setAllergens(content.declaredAllergens);
      setDietary(content.claimedDietaryLabels.join(", "));
      setSafetyNotes((content.safetyNotes ?? []).join("\n"));
      if (version.rights) {
        setSourceType(version.rights.sourceType);
        setAiAssistance(version.rights.aiAssistance);
        setAiNotes(version.rights.aiAssistanceNotes ?? "");
        setPublicName(version.rights.publicContributorName ?? "");
        setLicence(version.rights.licence);
        setPublishStory(version.rights.publishCulturalStory);
        setOwnWords(version.rights.writtenInOwnWords);
        setRightToShare(version.rights.rightToShare);
      }
    });
  }, []);

  const selectedScope = useMemo<ContributionScope>(() => {
    if (target.startsWith("household:")) return { type: "household", id: target.slice("household:".length) };
    return { type: "personal" };
  }, [target]);

  function buildContent(): RecipeDraftContent {
    return {
      schemaVersion: 1,
      title: title.trim(),
      ...(nativeTitle.trim() ? { nativeTitle: nativeTitle.trim() } : {}),
      description: description.trim(),
      cuisine: cuisine.trim(),
      ...(region.trim() ? { region: region.trim() } : {}),
      language,
      servings,
      ...(prepMinutes ? { prepMinutes: Number(prepMinutes) } : {}),
      ...(cookMinutes ? { cookMinutes: Number(cookMinutes) } : {}),
      ingredients: ingredients.filter((item) => item.name.trim()).map((item) => ({
        ...item,
        name: item.name.trim(),
        ...(item.canonicalSlug?.trim() ? { canonicalSlug: item.canonicalSlug.trim() } : {}),
        ...(item.unit?.trim() ? { unit: item.unit.trim() } : {}),
        ...(item.quantityText?.trim() ? { quantityText: item.quantityText.trim() } : {}),
        ...(item.notes?.trim() ? { notes: item.notes.trim() } : {}),
      })),
      steps: steps.filter((item) => item.text.trim()).map((item, index) => ({ ...item, order: index + 1, text: item.text.trim() })),
      cookware: cookware.split(",").map((item) => item.trim()).filter(Boolean),
      ...(story.trim() ? { culturalStory: story.trim() } : {}),
      safetyNotes: safetyNotes.split("\n").map((item) => item.trim()).filter(Boolean),
      claimedDietaryLabels: dietary.split(",").map((item) => item.trim()).filter(Boolean),
      declaredAllergens: allergens,
    };
  }

  function buildRights(): RightsAttestation | null {
    if (!ownWords && !rightToShare) return null;
    return {
      sourceType,
      writtenInOwnWords: ownWords,
      rightToShare,
      aiAssistance,
      ...(aiNotes.trim() ? { aiAssistanceNotes: aiNotes.trim() } : {}),
      ...(publicName.trim() ? { publicContributorName: publicName.trim() } : {}),
      publishCulturalStory: publishStory,
      licence,
      acceptedAt: new Date().toISOString(),
    };
  }

  async function save(submit = false) {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const content = buildContent();
      const rights = buildRights();
      const local = await contributionRepository.saveVersion({
        draftId,
        content,
        rights,
        ...(session ? { ownerId: session.user.id } : {}),
        scope: target === "local" ? { type: "personal" } : selectedScope,
      });
      setDraftId(local.draft.id);
      if (target === "local") {
        if (submit) throw new Error("sign_in_and_choose_cloud_before_submission");
        setMessage(`Version ${local.version.versionNumber} saved only on this device. Nothing was uploaded or submitted.`);
        return;
      }
      if (!configured || !session) throw new Error("sign_in_required_for_cloud_drafts");
      const cloud = await saveCloudDraftVersion({
        scope: selectedScope,
        content,
        rights,
        expectedLatestVersionId: undefined,
      });
      if (submit) {
        if (!rights) throw new Error("rights_incomplete");
        const result = await submitCloudVersion(cloud.draft.id, cloud.latestVersion.id);
        await contributionRepository.saveSubmission(result.submission);
        setMessage(`Submitted immutable version ${cloud.latestVersion.versionNumber} for automated checks and editorial review.`);
      } else {
        setMessage(`Saved version ${cloud.latestVersion.versionNumber} to ${selectedScope.type === "household" ? "the household cookbook" : "your private cloud cookbook"}. It is not public.`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message.replaceAll("_", " ") : "Could not save the draft.");
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-xl border border-cardamom bg-rice px-4 py-2.5 text-sm outline-none focus:border-turmeric placeholder:text-tamarind-faint";
  const label = "mb-1.5 mt-5 block text-sm font-medium text-tamarind-soft first:mt-0";
  const allergenOptions = ["dairy", "gluten", "nuts", "peanuts", "soy", "egg", "fish", "shellfish", "sesame", "mustard"];

  return (
    <div className="space-y-6 rounded-card border border-cardamom bg-card p-6 shadow-lift sm:p-8">
      <div className="rounded-card bg-turmeric-tint/60 p-4 text-sm text-tamarind-soft">
        <strong>Private by default.</strong> Saving locally or to a household does not publish the recipe. Submission freezes one exact version for checks and review; later edits create another version.
      </div>

      <div>
        <label className={label} htmlFor="draft-target">Save target</label>
        <select id="draft-target" className={input} value={target} onChange={(event) => setTarget(event.target.value)}>
          <option value="local">This device only</option>
          {session && <option value="personal">My private cloud cookbook</option>}
          {session && households.map((household) => <option key={household.id} value={`household:${household.id}`}>{household.name} household</option>)}
        </select>
        {!session && <p className="mt-2 text-xs text-tamarind-faint">Sign in from Account only when you want cloud backup, household collaboration or submission.</p>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="draft-title">Recipe title</label><input id="draft-title" className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Paatti’s kathirikai curry" /></div>
        <div><label className={label} htmlFor="draft-native">Native title</label><input id="draft-native" className={input} value={nativeTitle} onChange={(e) => setNativeTitle(e.target.value)} placeholder="பாட்டி கத்திரிக்காய் கறி" /></div>
        <div><label className={label} htmlFor="draft-cuisine">Cuisine or community</label><input id="draft-cuisine" className={input} value={cuisine} onChange={(e) => setCuisine(e.target.value)} placeholder="Tamil, Chettinad, Kerala…" /></div>
        <div><label className={label} htmlFor="draft-region">Region or town</label><input id="draft-region" className={input} value={region} onChange={(e) => setRegion(e.target.value)} placeholder="Madurai" /></div>
        <div><label className={label} htmlFor="draft-language">Primary language</label><select id="draft-language" className={input} value={language} onChange={(e) => setLanguage(e.target.value)}><option value="en">English</option><option value="ta">Tamil</option><option value="hi">Hindi</option><option value="other">Other</option></select></div>
        <div><label className={label} htmlFor="draft-servings">Servings</label><input id="draft-servings" type="number" min={1} max={100} className={input} value={servings} onChange={(e) => setServings(Number(e.target.value))} /></div>
        <div><label className={label} htmlFor="draft-prep">Preparation minutes</label><input id="draft-prep" type="number" min={0} className={input} value={prepMinutes} onChange={(e) => setPrepMinutes(e.target.value)} /></div>
        <div><label className={label} htmlFor="draft-cook">Cooking minutes</label><input id="draft-cook" type="number" min={0} className={input} value={cookMinutes} onChange={(e) => setCookMinutes(e.target.value)} /></div>
      </div>

      <label className={label} htmlFor="draft-description">Short description</label>
      <textarea id="draft-description" className={`${input} min-h-20`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the dish in your own words." />

      <div>
        <label className={label}>Ingredients</label>
        <div className="space-y-3">
          {ingredients.map((ingredient, index) => (
            <div key={ingredient.id} className="grid gap-2 rounded-xl border border-cardamom p-3 sm:grid-cols-[1fr_8rem_8rem_auto]">
              <input className={input} value={ingredient.name} onChange={(e) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, name: e.target.value } : item))} placeholder="Ingredient" aria-label={`Ingredient ${index + 1} name`} />
              <input className={input} value={ingredient.quantityText ?? ""} onChange={(e) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, quantityText: e.target.value } : item))} placeholder="Quantity" aria-label={`Ingredient ${index + 1} quantity`} />
              <input className={input} value={ingredient.unit ?? ""} onChange={(e) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, unit: e.target.value } : item))} placeholder="Unit" aria-label={`Ingredient ${index + 1} unit`} />
              <button type="button" className="text-xs font-medium text-chilli" onClick={() => setIngredients((current) => current.filter((item) => item.id !== ingredient.id))}>Remove</button>
              <input className={`${input} sm:col-span-3`} value={ingredient.canonicalSlug ?? ""} onChange={(e) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, canonicalSlug: e.target.value } : item))} placeholder="Canonical slug if known, e.g. coconut-milk" aria-label={`Ingredient ${index + 1} canonical slug`} />
              <label className="flex items-center gap-2 text-xs text-tamarind-soft"><input type="checkbox" checked={ingredient.optional} onChange={(e) => setIngredients((current) => current.map((item) => item.id === ingredient.id ? { ...item, optional: e.target.checked } : item))} /> Optional</label>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setIngredients((current) => [...current, emptyIngredient()])} className="mt-3 text-sm font-medium text-turmeric-deep">+ Add ingredient</button>
      </div>

      <div>
        <label className={label}>Steps</label>
        <div className="space-y-3">
          {steps.map((step, index) => (
            <div key={step.id} className="flex gap-2">
              <span className="mt-3 w-6 text-sm text-tamarind-faint">{index + 1}</span>
              <textarea className={`${input} min-h-20`} value={step.text} onChange={(e) => setSteps((current) => current.map((item) => item.id === step.id ? { ...item, text: e.target.value } : item))} placeholder={`Step ${index + 1}`} />
              <button type="button" className="text-xs font-medium text-chilli" onClick={() => setSteps((current) => current.filter((item) => item.id !== step.id).map((item, itemIndex) => ({ ...item, order: itemIndex + 1 })))}>Remove</button>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setSteps((current) => [...current, emptyStep(current.length + 1)])} className="mt-3 text-sm font-medium text-turmeric-deep">+ Add step</button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div><label className={label} htmlFor="draft-cookware">Cookware, comma separated</label><input id="draft-cookware" className={input} value={cookware} onChange={(e) => setCookware(e.target.value)} placeholder="kadai, pressure cooker" /></div>
        <div><label className={label} htmlFor="draft-dietary">Claimed dietary labels</label><input id="draft-dietary" className={input} value={dietary} onChange={(e) => setDietary(e.target.value)} placeholder="vegetarian, gluten-free" /></div>
      </div>

      <fieldset>
        <legend className={label}>Known allergens in the recipe</legend>
        <div className="flex flex-wrap gap-3">{allergenOptions.map((allergen) => <label key={allergen} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={allergens.includes(allergen)} onChange={(e) => setAllergens((current) => e.target.checked ? [...current, allergen] : current.filter((item) => item !== allergen))} /> {allergen}</label>)}</div>
        <p className="mt-2 text-xs text-tamarind-faint">Leaving this empty never means allergen-free. Automated derivation and human review remain required.</p>
      </fieldset>

      <label className={label} htmlFor="draft-safety">Safety notes, one per line</label><textarea id="draft-safety" className={`${input} min-h-20`} value={safetyNotes} onChange={(e) => setSafetyNotes(e.target.value)} placeholder="Pressure-release method, raw poultry cross-contamination, hot-oil warning…" />
      <label className={label} htmlFor="draft-story">Family or cultural story</label><textarea id="draft-story" className={`${input} min-h-24`} value={story} onChange={(e) => setStory(e.target.value)} placeholder="Who taught you? When is this dish cooked?" />

      <section className="rounded-card border border-cardamom bg-rice p-5">
        <h2 className="font-display text-xl">Rights and transparency</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className={label} htmlFor="draft-source">Source type</label><select id="draft-source" className={input} value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}><option value="original">Original formulation</option><option value="family">Family recipe</option><option value="traditional">Traditional dish</option><option value="adapted">Adapted formulation</option><option value="documented">Documented source</option></select></div>
          <div><label className={label} htmlFor="draft-licence">Publication licence</label><select id="draft-licence" className={input} value={licence} onChange={(e) => setLicence(e.target.value as PublicationLicence)}><option value="CC-BY-4.0">CC BY 4.0</option><option value="CC-BY-SA-4.0">CC BY-SA 4.0</option><option value="CC0-1.0">CC0 1.0</option><option value="permission-granted">Specific permission granted</option></select></div>
          <div><label className={label} htmlFor="draft-ai">AI assistance</label><select id="draft-ai" className={input} value={aiAssistance} onChange={(e) => setAiAssistance(e.target.value as AiAssistance)}><option value="none">None</option><option value="structure">Structure only</option><option value="translation">Translation</option><option value="drafting">Drafting assistance</option></select></div>
          <div><label className={label} htmlFor="draft-name">Public contributor name or pseudonym</label><input id="draft-name" className={input} value={publicName} onChange={(e) => setPublicName(e.target.value)} placeholder="Febin from Madurai" /></div>
        </div>
        {aiAssistance !== "none" && <><label className={label} htmlFor="draft-ai-notes">How AI was used</label><textarea id="draft-ai-notes" className={`${input} min-h-16`} value={aiNotes} onChange={(e) => setAiNotes(e.target.value)} /></>}
        <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={ownWords} onChange={(e) => setOwnWords(e.target.checked)} className="mt-1" /><span>I wrote this recipe in my own words and did not paste protected text from a book, site or app.</span></label>
        <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={rightToShare} onChange={(e) => setRightToShare(e.target.checked)} className="mt-1" /><span>I own this formulation or have the right to share this family/traditional recipe under the selected licence.</span></label>
        <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={publishStory} onChange={(e) => setPublishStory(e.target.checked)} className="mt-1" /><span>The cultural story may be shown publicly if this exact version is approved.</span></label>
      </section>

      {message && <p className="rounded-xl bg-curry-tint p-4 text-sm text-curry">{message}</p>}
      {error && <p className="rounded-xl bg-chilli/10 p-4 text-sm font-medium text-chilli">{error}</p>}
      <div className="flex flex-wrap gap-3">
        <button type="button" disabled={saving} onClick={() => void save(false)} className="rounded-full bg-turmeric px-6 py-3 font-semibold text-tamarind disabled:opacity-50">{saving ? "Saving…" : "Save new version"}</button>
        <button type="button" disabled={saving || target === "local" || !session} onClick={() => void save(true)} className="rounded-full border border-curry bg-curry-tint px-6 py-3 font-semibold text-curry disabled:opacity-40">Submit this exact version for review</button>
      </div>
    </div>
  );
}
