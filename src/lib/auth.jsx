/**
 * Who is signed in, and whether to show them edit controls.
 *
 * `useCanEdit()` is cosmetic. It decides which buttons render, and that is
 * the whole of its job. Anyone can open devtools and flip it to true; what
 * happens then is that the buttons appear, they press one, and Postgres
 * refuses the write. The refusal is the security. See ACCESS.md.
 *
 * The allowlist here is read from VITE_OWNER_EMAILS, which is compiled into
 * the public bundle. It must match owner_emails() in supabase/schema.sql —
 * that copy is the one the server checks.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { auth as authApi, isConfigured } from "./db.js";

const OWNER_EMAILS = String(import.meta.env.VITE_OWNER_EMAILS ?? "")
  .split(",")
  .map((entry) => entry.trim().toLowerCase())
  .filter(Boolean);

export function isOwnerEmail(email) {
  if (!email) return false;
  return OWNER_EMAILS.includes(String(email).trim().toLowerCase());
}

const AuthContext = createContext({
  session: null,
  email: null,
  loading: true,
  canEdit: false,
  signOut: async () => {},
});

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(isConfigured);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return undefined;
    }
    let active = true;

    authApi
      .session()
      .then((current) => {
        if (active) setSession(current);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Covers the magic-link callback too: the client reads the fragment,
    // establishes the session and fires this.
    const stop = authApi.onChange((next) => {
      if (active) {
        setSession(next);
        setLoading(false);
      }
    });

    return () => {
      active = false;
      stop();
    };
  }, []);

  const value = useMemo(() => {
    const email = session?.user?.email ?? null;
    return {
      session,
      email,
      loading,
      canEdit: isOwnerEmail(email),
      signOut: authApi.signOut,
    };
  }, [session, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** The one question the components ask. Cosmetic — see the note above. */
export function useCanEdit() {
  return useContext(AuthContext).canEdit;
}

/** True while we still do not know, so the UI can avoid flashing "View only". */
export function useAuthLoading() {
  return useContext(AuthContext).loading;
}

export const ownerEmails = OWNER_EMAILS;
