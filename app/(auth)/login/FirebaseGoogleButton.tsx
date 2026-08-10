"use client";

import { useState } from "react";

type Props = {
  next: string;
  config: {
    apiKey: string;
    authDomain: string;
    projectId: string;
    appId: string;
  };
};

export function FirebaseGoogleButton({ next, config }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const configured = Boolean(config.apiKey && config.authDomain && config.projectId && config.appId);
  if (!configured) return null;

  async function signIn() {
    setBusy(true);
    setError("");
    try {
      const [{ initializeApp, getApps }, { getAuth, GoogleAuthProvider, signInWithPopup }] = await Promise.all([
        import("firebase/app"),
        import("firebase/auth"),
      ]);
      const app = getApps()[0] || initializeApp(config);
      const auth = getAuth(app);
      const credential = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await credential.user.getIdToken();
      const response = await fetch("/api/auth/firebase/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idToken, next }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message || "Sign in failed.");
      window.location.assign(body.next || "/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  }

  return (
    <div className="space-y-2">
      <button type="button" onClick={signIn} disabled={busy} className="btn-grad w-full inline-flex items-center justify-center px-5 py-3 text-[14px] disabled:opacity-60">
        {busy ? "Signing in..." : "Continue with Firebase Google"}
      </button>
      {error && (
        <div className="rounded-md border border-[#f2c2c2] bg-[#fff4f4] px-3 py-2 text-[13px] text-[#a32d2d]">
          {error}
        </div>
      )}
    </div>
  );
}
