/**
 * Magic-link sign-in.
 *
 * There is no password field, and adding one would be worse than useless:
 * this is a static bundle, so any password it compared would be sitting in
 * the JavaScript for anyone to read. A link mailed to an address you control
 * has nothing to steal or guess.
 *
 * Sign-ups are closed in the Supabase dashboard (see ACCESS.md), and the
 * request below sets shouldCreateUser: false, so an address that is not
 * already a user gets no link rather than a new account.
 */

import { useState } from "react";
import { Navigate } from "react-router-dom";
import { auth, isConfigured, configError } from "../lib/db.js";
import { useAuth } from "../lib/auth.jsx";
import { Reveal } from "../components/motion.jsx";

export default function Login() {
  const { session, canEdit } = useAuth();
  const [email, setEmail] = useState("");
  const [state, setState] = useState("idle");
  const [message, setMessage] = useState(null);

  if (session && canEdit) return <Navigate to="/admin" replace />;

  async function submit(event) {
    event.preventDefault();
    if (!email.trim()) return;
    setState("sending");
    setMessage(null);
    try {
      await auth.sendMagicLink(email.trim(), `${window.location.origin}/admin`);
      setState("sent");
    } catch (err) {
      setState("error");
      setMessage(err.message ?? String(err));
    }
  }

  if (!isConfigured) {
    return (
      <div className="centred">
        <Reveal className="notice notice--warn" style={{ maxWidth: 460 }}>
          <strong>Supabase is not configured.</strong>
          <span>{configError}</span>
        </Reveal>
      </div>
    );
  }

  return (
    <div className="centred">
      <Reveal className="card" style={{ width: "min(420px, 100%)" }}>
        <div className="card__head">
          <h1 className="card__title">Sign in</h1>
        </div>

        {state === "sent" ? (
          <div className="stack">
            <p>
              If <strong>{email}</strong> is an account on this project, a
              sign-in link is on its way.
            </p>
            <p className="muted" style={{ fontSize: "var(--step--1)" }}>
              The link is single-use and expires. Open it in this browser if
              you can — that is the smoothest path back.
            </p>
            <button type="button" className="btn btn--ghost" onClick={() => setState("idle")}>
              Use a different address
            </button>
          </div>
        ) : (
          <form className="stack" onSubmit={submit}>
            <div className="field">
              <label className="field__label" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
              />
            </div>

            <button type="submit" className="btn btn--primary" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Email me a link"}
            </button>

            {state === "error" ? (
              <div className="notice notice--alert">
                <span>{message}</span>
              </div>
            ) : null}

            <p className="muted" style={{ fontSize: "var(--step--1)" }}>
              No password — there is nowhere safe to check one in a static
              site. Only accounts that already exist can sign in.
            </p>
          </form>
        )}
      </Reveal>
    </div>
  );
}
