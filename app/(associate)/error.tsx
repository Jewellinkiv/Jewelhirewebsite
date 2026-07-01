"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/states";

export default function GroupError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { /* surface to logging in production */ }, [error]);
  return <ErrorState reset={reset} />;
}
