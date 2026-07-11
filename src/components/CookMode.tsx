"use client";

/** Full-screen, interruption-safe kitchen mode with timestamp timers. */
import { useEffect, useMemo, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatQuantity } from "@/lib/format";
import {
  COOK_SESSION_SCHEMA_VERSION,
  clearCookSession,
  createCookTimer,
  loadCookSession,
  recipeCookVersion,
  remainingTimerSeconds,
  saveCookSession,
  scaleIngredientForServings,
  type PersistedCookSession,
  type PersistedCookTimer,
} from "@/lib/cook-session";

export default function CookMode({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [servings, setServings] = useState(recipe.servings);
  const [showIngredients, setShowIngredients] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [timer, setTimer] = useState<PersistedCookTimer | null>(null);
  const [now, setNow] = useState(Date.now());
  const [savedSession, setSavedSession] = useState<PersistedCookSession | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const launchRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const current = recipe.steps[step];
  const secondsLeft = remainingTimerSeconds(timer, now);
  const scaledIngredients = useMemo(
    () => recipe.ingredients.map((ingredient) => scaleIngredientForServings(ingredient, recipe.servings, servings, recipe.methods)),
    [recipe, servings],
  );

  useEffect(() => setSavedSession(loadCookSession(recipe)), [recipe]);

  useEffect(() => {
    if (!timer) return;
    const tick = () => setNow(Date.now());
    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [timer]);

  useEffect(() => {
    if (!open) return;
    const session: PersistedCookSession = {
      schemaVersion: COOK_SESSION_SCHEMA_VERSION,
      recipeId: recipe.slug,
      recipeVersion: recipeCookVersion(recipe),
      servings,
      stepIndex: step,
      completedSteps: [...new Set(completedSteps)].sort((a, b) => a - b),
      timer,
      updatedAt: Date.now(),
    };
    saveCookSession(session);
    setSavedSession(session);
  }, [open, recipe, servings, step, completedSteps, timer]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    const requestWakeLock = () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      (navigator as Navigator & { wakeLock: { request: (type: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request("screen")
        .then((lock) => { wakeLockRef.current = lock; })
        .catch(() => {});
    };
    requestWakeLock();
    document.addEventListener("visibilitychange", requestWakeLock);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    window.setTimeout(() => dialogRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("visibilitychange", requestWakeLock);
      document.removeEventListener("keydown", onKeyDown);
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
      launchRef.current?.focus();
    };
  }, [open]);

  function begin(resume: boolean) {
    const session = resume ? loadCookSession(recipe) : null;
    if (session) {
      setStep(session.stepIndex);
      setCompletedSteps(session.completedSteps);
      setServings(session.servings);
      setTimer(session.timer);
    } else {
      setStep(0);
      setCompletedSteps([]);
      setServings(recipe.servings);
      setTimer(null);
    }
    setShowIngredients(false);
    setNow(Date.now());
    setOpen(true);
  }

  function goNext() {
    setCompletedSteps((currentSteps) => [...new Set([...currentSteps, step])]);
    setStep((currentStep) => Math.min(recipe.steps.length - 1, currentStep + 1));
  }

  function finish() {
    clearCookSession(recipe.slug);
    setSavedSession(null);
    setTimer(null);
    setCompletedSteps([]);
    setOpen(false);
  }

  function changeServings(delta: number) {
    setServings((value) => Math.max(1, Math.min(100, value + delta)));
  }

  if (!open) {
    return (
      <div className="no-print flex flex-wrap gap-2">
        <button
          ref={launchRef}
          onClick={() => begin(Boolean(savedSession))}
          className="min-h-12 w-full rounded-card bg-turmeric px-6 py-3.5 text-center font-semibold text-tamarind shadow-lift transition-colors hover:bg-turmeric-deep hover:text-rice sm:w-auto"
        >
          {savedSession ? `Resume cook mode · step ${savedSession.stepIndex + 1}` : "Start cook mode"}
        </button>
        {savedSession && (
          <button
            onClick={() => { clearCookSession(recipe.slug); setSavedSession(null); begin(false); }}
            className="min-h-12 rounded-card border border-cardamom bg-card px-4 py-3 text-sm font-medium"
          >
            Restart
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex flex-col bg-rice pb-[env(safe-area-inset-bottom)]"
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${recipe.title}`}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-2 border-b border-cardamom px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div className="min-w-0">
          <p className="font-display truncate text-lg">{recipe.title}</p>
          <p className="text-xs text-tamarind-faint">Progress is saved on this device · serves {servings}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button onClick={() => setLargeText((value) => !value)} className="min-h-11 min-w-11 rounded-full border border-cardamom bg-card px-3 text-sm font-semibold" aria-pressed={largeText} title="Toggle larger kitchen text">A+</button>
          <button onClick={() => setShowIngredients((value) => !value)} className="min-h-11 rounded-full border border-cardamom bg-card px-3 text-sm font-medium">
            {showIngredients ? "Steps" : "Ingredients"}
          </button>
          <button onClick={() => setOpen(false)} className="min-h-11 rounded-full border border-cardamom bg-card px-3 text-sm font-medium" aria-label="Exit and keep saved progress">Exit ✕</button>
        </div>
      </div>

      <div className="flex gap-1 px-4 pt-3" aria-label={`Step ${step + 1} of ${recipe.steps.length}`}>
        {recipe.steps.map((recipeStep, index) => (
          <button
            key={recipeStep.order}
            onClick={() => setStep(index)}
            className={`h-2 min-w-2 flex-1 rounded-full ${completedSteps.includes(index) ? "bg-curry" : index === step ? "bg-turmeric" : "bg-cardamom"}`}
            aria-label={`Go to step ${index + 1}${completedSteps.includes(index) ? ", completed" : ""}`}
          />
        ))}
      </div>

      {timer && (
        <div className={`mx-4 mt-3 flex flex-wrap items-center justify-between gap-2 rounded-card border px-4 py-3 ${secondsLeft === 0 ? "border-chilli bg-chilli-tint" : "border-turmeric bg-turmeric-tint/50"}`} role="timer" aria-live={secondsLeft === 0 ? "assertive" : "polite"}>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-tamarind-faint">Timer from step {timer.stepIndex + 1}</p>
            <p className="font-display text-3xl tabular-nums text-tamarind">{secondsLeft === 0 ? "Time’s up" : `${Math.floor((secondsLeft ?? 0) / 60)}:${String((secondsLeft ?? 0) % 60).padStart(2, "0")}`}</p>
          </div>
          <div className="flex gap-2">
            {timer.stepIndex !== step && <button onClick={() => setStep(timer.stepIndex)} className="min-h-11 rounded-full border border-cardamom bg-card px-3 text-xs font-medium">Open timer step</button>}
            <button onClick={() => setTimer(null)} className="min-h-11 rounded-full border border-cardamom bg-card px-3 text-xs font-medium">Dismiss</button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-10">
        {showIngredients ? (
          <div className="mx-auto max-w-xl">
            <div className="mb-5 flex items-center justify-between rounded-card border border-cardamom bg-card p-3">
              <span className="text-sm font-medium">Scale servings</span>
              <div className="flex items-center gap-3">
                <button onClick={() => changeServings(-1)} disabled={servings <= 1} className="min-h-11 min-w-11 rounded-full border border-cardamom text-xl disabled:opacity-40" aria-label="Decrease servings">−</button>
                <strong className="min-w-8 text-center text-lg">{servings}</strong>
                <button onClick={() => changeServings(1)} className="min-h-11 min-w-11 rounded-full border border-cardamom text-xl" aria-label="Increase servings">+</button>
              </div>
            </div>
            <ul className="space-y-3">
              {scaledIngredients.map((ingredient, index) => (
                <li key={`${ingredient.normalizedName}-${index}`} className="border-b border-cardamom pb-3">
                  <div className={`flex items-baseline justify-between gap-4 ${largeText ? "text-xl" : "text-lg"}`}>
                    <span>{ingredient.name}{ingredient.optional ? " (optional)" : ""}</span>
                    <span className="shrink-0 font-semibold">{formatQuantity(ingredient)}</span>
                  </div>
                  {ingredient.scalingNote && <p className="mt-1 text-xs text-tamarind-faint">{ingredient.scalingNote}</p>}
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-turmeric-deep">Step {step + 1} of {recipe.steps.length}</p>
            <p className={`mt-4 leading-relaxed ${largeText ? "text-3xl sm:text-4xl" : "text-2xl sm:text-3xl"}`}>{current.text}</p>
            {current.timerMinutes && (!timer || timer.stepIndex !== step) && (
              <button
                onClick={() => { setTimer(createCookTimer(step, `Step ${step + 1}`, current.timerMinutes!)); setNow(Date.now()); }}
                className="mt-7 min-h-12 rounded-full border-2 border-turmeric px-5 py-2.5 font-semibold text-turmeric-deep"
              >
                Start {current.timerMinutes} min timer
              </button>
            )}
            {completedSteps.includes(step) && <p className="mt-6 inline-block rounded-full bg-curry-tint px-3 py-1.5 text-sm font-semibold text-curry">Completed</p>}
          </div>
        )}
      </div>

      {!showIngredients && (
        <div className="grid grid-cols-2 gap-3 border-t border-cardamom p-4">
          <button onClick={() => setStep((value) => Math.max(0, value - 1))} disabled={step === 0} className="min-h-14 rounded-card border border-cardamom bg-card py-4 text-lg font-semibold disabled:opacity-40">← Back</button>
          {step < recipe.steps.length - 1 ? (
            <button onClick={goNext} className="min-h-14 rounded-card bg-turmeric py-4 text-lg font-semibold text-tamarind">Done · next →</button>
          ) : (
            <button onClick={finish} className="min-h-14 rounded-card bg-curry py-4 text-lg font-semibold text-white">Done · serve it!</button>
          )}
        </div>
      )}
    </div>
  );
}
