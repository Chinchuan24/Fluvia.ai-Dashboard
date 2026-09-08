import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./lib/auth.jsx";
import Layout from "./Layout.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Admin from "./pages/Admin.jsx";
import Login from "./pages/Login.jsx";

/**
 * BrowserRouter, not HashRouter.
 *
 * The rewrite in vercel.json sends every unmatched path to index.html, so
 * deep links work and the URLs stay clean. It also keeps the URL fragment
 * free, which matters here: the Supabase magic-link callback comes back as a
 * fragment (#access_token=...), and a hash router would be fighting the auth
 * client for the same part of the URL.
 *
 * If you ever move to a host that cannot rewrite — GitHub Pages, plain S3 —
 * switch this to HashRouter and set BASE_PATH at build time.
 */
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
