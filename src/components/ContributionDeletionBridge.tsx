"use client";

import { useEffect } from "react";
import { contributionRepository } from "@/lib/contributions/local-store";

export default function ContributionDeletionBridge() {
  useEffect(() => {
    const onKitchenEvent = (event: Event) => {
      const type = (event as CustomEvent<{ type?: string }>).detail?.type;
      if (type === "local_data_deleted") void contributionRepository.deleteAll();
    };
    window.addEventListener("cook-anything:kitchen", onKitchenEvent);
    return () => window.removeEventListener("cook-anything:kitchen", onKitchenEvent);
  }, []);
  return null;
}
