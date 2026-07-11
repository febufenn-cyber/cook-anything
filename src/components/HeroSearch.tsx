"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function HeroSearch() {
  const router = useRouter();
  const [text, setText] = useState("");

  function go() {
    router.push(`/what-can-i-cook${text.trim() ? `?q=${encodeURIComponent(text.trim())}` : ""}`);
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); go(); }}
      className="mt-8 flex max-w-2xl flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="hero-input" className="sr-only">
        What ingredients do you have?
      </label>
      <input
        id="hero-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="chicken, curd, onion, tomato, rice"
        className="flex-1 rounded-full border-2 border-cardamom bg-card px-6 py-4 text-base shadow-lift outline-none placeholder:text-tamarind-faint focus:border-turmeric"
        autoComplete="off"
      />
      <button
        type="submit"
        className="rounded-full bg-turmeric px-8 py-4 font-semibold text-tamarind shadow-lift transition-colors hover:bg-turmeric-deep hover:text-rice"
      >
        Find recipes
      </button>
    </form>
  );
}
