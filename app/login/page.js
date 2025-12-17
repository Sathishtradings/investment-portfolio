"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

/**
 * Modern Login / Signup UI
 * - Password visibility toggle
 * - Google OAuth button
 * - Signup / Login modes
 * - Auto-redirect when already authenticated
 *
 * Paste this into app/login/page.js
 */

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState("login"); // 'login' | 'signup'
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);

  // redirect if already authenticated
  useEffect(() => {
    const check = async () => {
      try {
        const { data } = await supabaseClient.auth.getSession();
        if (data?.session) {
          router.push("/portfolio");
        }
      } catch (err) {
        console.error("session check error", err);
      }
    };
    check();
  }, [router]);

  // simple password strength hint
  const passwordStrength = useMemo(() => {
    if (!password) return "";
    if (password.length < 6) return "Too short";
    if (password.length < 10) return "Weak";
    return "Good";
  }, [password]);

  const clearMessages = () => {
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    setLoading(true);

    try {
      if (!email) throw new Error("Please enter an email");
      if (mode === "signup" && (!password || password.length < 6)) {
        throw new Error("Password should be at least 6 characters");
      }

      let res;
      if (mode === "login") {
        res = await supabaseClient.auth.signInWithPassword({ email, password });
        if (res.error) throw res.error;
        // On success, navigate to portfolio
        router.push("/portfolio");
      } else {
        // signup
        res = await supabaseClient.auth.signUp({ email, password });
        if (res.error) throw res.error;
        // If your Supabase requires email confirmation, user will need to confirm via email.
        setMode("login");
        setInfo("Account created. Please check your email to confirm (if required), then login.");
      }
    } catch (err) {
      console.error("auth error", err);
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  // Optional: magic link sign in
  const sendMagicLink = async () => {
    clearMessages();
    if (!email) {
      setError("Enter email for magic link");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabaseClient.auth.signInWithOtp({ email });
      if (error) throw error;
      setInfo("Magic link sent — check your email.");
    } catch (err) {
      console.error("magic link error", err);
      setError(err.message || "Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  // Google OAuth
  const handleGoogle = async () => {
    clearMessages();
    setOauthLoading(true);
    try {
      // Make sure your Supabase OAuth Redirect URI is configured: e.g. http://localhost:3000
      const { error } = await supabaseClient.auth.signInWithOAuth({ provider: "google" });
      if (error) throw error;
      // Supabase will redirect the user to Google and back; no further action needed here.
    } catch (err) {
      console.error("oauth error", err);
      setError(err.message || "OAuth failed");
      setOauthLoading(false);
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <div style={styles.left}>
          <h2 style={styles.brandTitle}>HanaMora</h2>
          <p style={styles.brandSub}>Investment Portfolio Manager</p>
          <p style={styles.lead}>
            Securely track investments, view returns and manage positions — now with single sign-on and a nicer login UI.
          </p>

          <div style={{ marginTop: 18 }}>
            <small style={{ color: "#94a3b8" }}>
              By continuing, you agree to our Terms and Privacy Policy.
            </small>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardInner}>
            <div style={styles.headerRow}>
              <h3 style={{ margin: 0 }}>{mode === "login" ? "Sign in" : "Create account"}</h3>
              <div style={{ fontSize: 13, color: "#64748b" }}>
                {mode === "login" ? "Welcome back" : "Create a new account"}
              </div>
            </div>

            {error && <div style={styles.errorBox}>{error}</div>}
            {info && <div style={styles.infoBox}>{info}</div>}

            <form onSubmit={handleSubmit} style={{ marginTop: 12 }}>
              <label style={styles.label}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="input"
                style={styles.input}
                autoComplete="email"
              />

              <label style={{ ...styles.label, marginTop: 12 }}>Password</label>
              <div style={{ position: "relative" }}>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "login" ? "Your password" : "Create a strong password"}
                  className="input"
                  style={styles.input}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  style={styles.pwdToggle}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
<button
  type="button"
  onClick={async () => {
    if (!email) {
      alert("Enter your email first");
      return;
    }
    await supabaseClient.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    alert("Password reset link sent to your email");
  }}
  style={{
    background: "none",
    border: "none",
    color: "#93c5fd",
    fontSize: "0.85rem",
    cursor: "pointer",
    marginBottom: "1rem",
  }}
>
  Forgot password?
</button>

              </div>

              {mode === "signup" && (
                <div style={{ marginTop: 8, fontSize: 13, color: passwordStrength === "Good" ? "#10b981" : "#f59e0b" }}>
                  Password: {passwordStrength}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                  {loading ? (mode === "login" ? "Signing in..." : "Creating...") : (mode === "login" ? "Sign in" : "Create account")}
                </button>

                <button
                  type="button"
                  onClick={() => { setMode((m) => (m === "login" ? "signup" : "login")); clearMessages(); }}
                  className="btn"
                  style={{ flex: 0.9, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#93c5fd" }}
                >
                  {mode === "login" ? "Sign up" : "Login"}
                </button>
              </div>
            </form>

            <div style={{ textAlign: "center", marginTop: 12 }}>
              <button onClick={sendMagicLink} className="btn" style={{ background: "transparent", color: "#93c5fd", fontSize: 13 }}>
                Send magic link
              </button>
            </div>

            <div style={styles.divider}>
              <span style={{ color: "#94a3b8" }}>or continue with</span>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={handleGoogle}
                disabled={oauthLoading}
                style={styles.oauthButton}
                aria-label="Continue with Google"
              >
                <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ marginRight: 8 }}>
                  <path fill="#EA4335" d="M24 9.5c3.9 0 7 1.6 9.1 3.4l6.6-6.1C36.9 3.7 30.9 1.5 24 1.5 14.7 1.5 6.9 6.9 3.2 14.5l7.7 6C12.5 16 17.8 9.5 24 9.5z"/>
                  <path fill="#34A853" d="M46.5 24.5c0-1.6-.1-2.9-.4-4.2H24v8h12.8c-.6 3-2.2 5.5-4.7 7.2l7.4 5.7C44.6 36.3 46.5 30.7 46.5 24.5z"/>
                  <path fill="#4A90E2" d="M10.9 29.1c-.9-2.6-1.2-5.4-.1-8.1L3 14.9C0.9 19.5 0 24.6 0 29.1c0 4.3 0.8 8 3.2 11.6l7.7-6z"/>
                  <path fill="#FBBC05" d="M24 46.5c6.9 0 12.9-2.2 17.6-6.1l-8.8-6.8c-2.6 1.9-5.8 3-8.8 3-6.2 0-11.5-6.6-12.2-15.6l-7.7 6C6.9 41 14.7 46.5 24 46.5z"/>
                </svg>
                {oauthLoading ? "Opening..." : "Google"}
              </button>

              {/* Placeholder for other OAuth providers */}
              <button disabled style={{ ...styles.oauthButton, opacity: 0.6, cursor: "not-allowed" }}>GitHub</button>
            </div>

            <div style={{ marginTop: 12, textAlign: "center", fontSize: 13, color: "#94a3b8" }}>
              <small>Need help? <a href="#" style={{ color: "#93c5fd" }}>Contact support</a></small>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Inline styles to keep file self-contained */
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)",
  },
  container: {
    width: "100%",
    maxWidth: 1100,
    display: "flex",
    gap: 24,
    alignItems: "stretch",
  },
  left: {
    flex: 1,
    color: "#fff",
    padding: 28,
    borderRadius: 12,
    background: "linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))",
    border: "1px solid rgba(255,255,255,0.04)",
    boxShadow: "0 8px 30px rgba(2,6,23,0.6)",
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: 800,
    marginBottom: 4,
  },
  brandSub: {
    color: "#93c5fd",
    marginBottom: 12,
  },
  lead: {
    color: "#c7d2fe",
    lineHeight: 1.5,
  },
  card: {
    width: 420,
    borderRadius: 12,
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.06)",
    boxShadow: "0 6px 24px rgba(2,6,23,0.6)",
    overflow: "hidden",
  },
  cardInner: {
    padding: 20,
  },
  headerRow: {
    marginBottom: 6,
  },
  label: {
    display: "block",
    fontSize: 13,
    color: "#94a3b8",
    marginBottom: 6,
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    color: "#fff",
    fontSize: 14,
  },
  pwdToggle: {
    position: "absolute",
    right: 8,
    top: 8,
    padding: "6px 10px",
    borderRadius: 6,
    background: "transparent",
    color: "#93c5fd",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
  },
  divider: {
    marginTop: 14,
    marginBottom: 10,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  oauthButton: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(255,255,255,0.02)",
    color: "#fff",
    cursor: "pointer",
    fontSize: 14,
  },
  errorBox: {
    background: "rgba(220,38,38,0.08)",
    color: "#fecaca",
    marginBottom: 8,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(220,38,38,0.12)",
  },
  infoBox: {
    background: "rgba(59,130,246,0.06)",
    color: "#bfdbfe",
    marginBottom: 8,
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid rgba(59,130,246,0.08)",
  },
};
