"use client";

import { createContext, createElement, useContext, useEffect, useState, type ReactNode } from "react";
import type { SessionUser } from "@/lib/session";

type ApiSession = {
  name?: string;
  email?: string;
  role?: SessionUser["role"];
  activeStoreId?: string;
  storeIds?: string[];
};

const CurrentSessionUserContext = createContext<SessionUser | null>(null);

export function CurrentSessionUserProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return createElement(CurrentSessionUserContext.Provider, { value: user }, children);
}

export function useCurrentSessionUser() {
  const user = useContext(CurrentSessionUserContext);
  if (!user) throw new Error("CurrentSessionUserProvider is required for applicant portal pages.");
  return user;
}

export function useActiveStoreId(fallbackStoreId = "store-sissys-little-rock") {
  const [storeId, setStoreId] = useState(fallbackStoreId);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((session: ApiSession) => {
        const nextStoreId = session.activeStoreId || session.storeIds?.[0];
        if (!cancelled && nextStoreId) setStoreId(nextStoreId);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return storeId;
}
