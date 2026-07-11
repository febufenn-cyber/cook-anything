"use client";

import { useEffect, useState } from "react";

export default function PwaRegistration() {
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;
    let refreshing = false;
    const onControllerChange = () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).then((registration) => {
      if (!active) return;
      if (registration.waiting) setWaiting(registration.waiting);
      registration.addEventListener("updatefound", () => {
        const worker = registration.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed" && navigator.serviceWorker.controller) setWaiting(worker);
        });
      });
    }).catch(() => undefined);
    return () => {
      active = false;
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
    };
  }, []);

  if (!waiting) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-[70] mx-auto flex max-w-xl flex-wrap items-center justify-between gap-3 rounded-card border border-turmeric bg-card p-4 shadow-lift" role="status">
      <div>
        <p className="font-semibold">A Cook Anything update is ready</p>
        <p className="text-xs text-tamarind-faint">Your active Cook Mode session will not update unless you choose to reload.</p>
      </div>
      <div className="flex gap-2">
        <button onClick={() => setWaiting(null)} className="rounded-full border border-cardamom px-3 py-2 text-xs font-medium">Later</button>
        <button onClick={() => waiting.postMessage({ type: "SKIP_WAITING" })} className="rounded-full bg-turmeric px-3 py-2 text-xs font-semibold">Update now</button>
      </div>
    </div>
  );
}
