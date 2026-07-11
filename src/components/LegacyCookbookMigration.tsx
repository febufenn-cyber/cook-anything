"use client";

import { useEffect } from "react";
import { migrateLegacyCookbook } from "@/lib/kitchen/legacy";

export default function LegacyCookbookMigration() {
  useEffect(() => {
    void migrateLegacyCookbook();
  }, []);
  return null;
}
