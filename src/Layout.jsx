/**
 * The shared chrome: tokens, the ambient canvas, and the bar that tells you
 * whether you are viewing or editing.
 *
 * That last part matters more than it looks. On a page where some visitors
 * can edit and most cannot, the difference has to be stated rather than
 * inferred from which buttons happen to be present.
 */

import { Link, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import AmbientCanvas from "./components/AmbientCanvas.jsx";
import { useAuth } from "./lib/auth.jsx";
import { sgtTime } from "./lib/format.js";
import "./styles/dashboard.css";

function Clock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return <span className="bar__clock">{sgtTime(now)} SGT</span>;
}

export default function Layout({ children }) {
  const { canEdit, email, loading, signOut } = useAuth();
  const { pathname } = useLocation();

  return (
    <>
      <AmbientCanvas />
      <div className="shell">
        <header className="bar">
          <Link to="/dashboard" className="bar__brand">
            Fluvia<span>.ai</span>
          </Link>

          <span className="bar__spacer" />
          <Clock />

          {loading ? (
            <span className="chip">Checking…</span>
          ) : canEdit ? (
            <>
              <span className="chip chip--edit" title={email}>
                Editing
              </span>
              {pathname !== "/admin" ? (
                <Link to="/admin" className="btn btn--ghost">
                  Admin
                </Link>
              ) : (
                <Link to="/dashboard" className="btn btn--ghost">
                  Dashboard
                </Link>
              )}
              <button type="button" className="btn btn--ghost" onClick={signOut}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <span className="chip">View only</span>
              <Link to="/login" className="btn btn--ghost">
                Sign in
              </Link>
            </>
          )}
        </header>

        <main className="main">{children}</main>
      </div>
    </>
  );
}
