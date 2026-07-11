"use client";

/**
 * Cook mode: full-screen, kitchen-readable steps with a per-step timer.
 * Tries to keep the screen awake while cooking (Wake Lock API, best-effort).
 */
import { useEffect, useRef, useState } from "react";
import type { Recipe } from "@/lib/types";
import { formatQuantity } from "@/lib/format";

export default function CookMode({ recipe }: { recipe: Recipe }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [showIngredients, setShowIngredients] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);

  const current = recipe.steps[step];

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    if ("wakeLock" in navigator) {
      (navigator as Navigator & { wakeLock: { request: (t: string) => Promise<{ release: () => Promise<void> }> } })
        .wakeLock.request("screen")
        .then((l) => { wakeLockRef.current = l; })
        .catch(() => {});
    }
    return () => {
      document.body.style.overflow = "";
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [open]);

  useEffect(() => {
    setSecondsLeft(null);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [step]);

  function startTimer(minutes: number) {
    if (timerRef.current) clearInterval(timerRef.current);
    setSecondsLeft(minutes * 60);
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s === null || s <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          return s === null ? null : 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  if (!open) {
    return (
      <button
        onClick={() => { setOpen(true); setStep(0); }}
        className="no-print w-full rounded-card bg-turmeric px-6 py-3.5 text-center font-semibold text-tamarind shadow-lift transition-colors hover:bg-turmeric-deep hover:text-rice sm:w-auto"
      >
        Start cook mode
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-rice" role="dialog" aria-label={`Cooking ${recipe.title}`}>
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-cardamom px-4 py-3">
        <p className="font-display truncate text-lg">{recipe.title}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIngredients((v) => !v)}
            className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium"
          >
            {showIngredients ? "Steps" : "Ingredients"}
          </button>
          <button
            onClick={() => setOpen(false)}
            className="rounded-full border border-cardamom bg-card px-3 py-1.5 text-sm font-medium"
            aria-label="Exit cook mode"
          >
            Exit ✕
          </button>
        </div>
      </div>

      {/* Progress */}
      <div className="flex gap-1 px-4 pt-3" aria-hidden>
        {recipe.steps.map((s, i) => (
          <div
            key={s.order}
            className={`h-1.5 flex-1 rounded-full ${i < step ? "bg-curry" : i === step ? "bg-turmeric" : "bg-cardamom"}`}
          />
        ))}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-10">
        {showIngredients ? (
          <ul className="mx-auto max-w-xl space-y-3">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex items-baseline justify-between gap-4 border-b border-cardamom pb-2 text-lg">
                <span>{ing.name}{ing.optional ? " (optional)" : ""}</span>
                <span className="shrink-0 font-semibold">{formatQuantity(ing)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-turmeric-deep">
              Step {step + 1} of {recipe.steps.length}
            </p>
            <p className="mt-4 text-2xl leading-relaxed sm:text-3xl sm:leading-relaxed">{current.text}</p>
            {current.timerMinutes && (
              <div className="mt-6">
                {secondsLeft === null ? (
                  <button
                    onClick={() => startTimer(current.timerMinutes!)}
                    className="rounded-full border-2 border-turmeric px-5 py-2.5 font-semibold text-turmeric-deep"
                  >
                    Start {current.timerMinutes} min timer
                  </button>
                ) : (
                  <p
                    className={`font-display text-5xl tabular-nums ${secondsLeft === 0 ? "text-chilli" : "text-tamarind"}`}
                    role="timer"
                    aria-live={secondsLeft === 0 ? "assertive" : "off"}
                  >
                    {secondsLeft === 0
                      ? "Time's up!"
                      : `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, "0")}`}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom nav — big kitchen-thumb targets */}
      {!showIngredients && (
        <div className="grid grid-cols-2 gap-3 border-t border-cardamom p-4">
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1))}
            disabled={step === 0}
            className="rounded-card border border-cardamom bg-card py-4 text-lg font-semibold disabled:opacity-40"
          >
            ← Back
          </button>
          {step < recipe.steps.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              className="rounded-card bg-turmeric py-4 text-lg font-semibold text-tamarind"
            >
              Next →
            </button>
          ) : (
            <button
              onClick={() => setOpen(false)}
              className="rounded-card bg-curry py-4 text-lg font-semibold text-white"
            >
              Done — serve it!
            </button>
          )}
        </div>
      )}
    </div>
  );
}
