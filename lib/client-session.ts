"use client";

import { useEffect, useState } from "react";
import { SESSION, SessionUser } from "@/lib/session";

type ApiSession = {
  name?: string;
  email?: string;
  role?: SessionUser["role"];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "JH";
}

export function useCurrentSessionUser() {
  const [user, setUser] = useState<SessionUser>(SESSION);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/me", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : Promise.reject()))
      .then((session: ApiSession) => {
        if (cancelled || !session.name || !session.email || !session.role) return;
        setUser({
          name: session.name,
          email: session.email,
          role: session.role,
          initials: initials(session.name),
        });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return user;
}
