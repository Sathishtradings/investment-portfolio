"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient } from "@/lib/supabaseClient";

export default function LoginPage() {
  const router = useRouter();

  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // ✅ Redirect if already logged in
  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabaseClient.auth.getSession();
      if (data.session) {
        router.replace("/portfolio");
      }
    };
    checkSession();
  }, [router]);

  // ✅ SAFE forgot-password handler (browser-only)
  const handleForgotPassword = async () => {
    try {
      if (!email) {
        setError("Please enter your email first");
        return;
      }

      setLoading(true);
      setError(null);

      // Guard for prerender / SSR
      if (typeof window === "undefined") return;

      const { error } = await supabaseClient.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      alert("Password reset link sent to your email");
    } catch (err) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (!email || !password) {
        throw new Error("Enter email and password");
      }

      let res;
      if (mode === "login") {
        res = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
      } else {
        res = await supabaseClient.auth.signUp({
          email,
          password,
        });
      }

      if (res.error) throw res.error;

      if (mode === "login") {
        router.push("/portfolio");
      } else {
        alert("Signup successful. Please check your email to confirm.");
        setMode("login");
      }
    } catch (err) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background:
          "linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 420,
          padding: "2rem",
          borderRadius: "1rem",
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <h1
          style={{
            fontSize: "1.75rem",
            fontWeight: 700,
            marginBottom: "0.5rem",
            color: "#fff",
            textAlign: "center",
          }}
        >
          HanaMora
        </h1>

        <p
          style={{
            textAlign: "center",
            marginBottom: "1.5rem",
            color: "#93c5fd",
          }}
        >
          {mode === "login"
            ? "Sign in to manage your portfolio"
            : "Create your account"}
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input"
            style={{ width: "100%", marginBottom: "1rem" }}
            required
          />

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            style={{ width: "100%", marginBottom: "0.75rem" }}
            required
          />

          <button
            type="button"
            onClick={handleForgotPassword}
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

          {error && (
            <p style={{ color: "#f87171", marginBottom: "1rem" }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%" }}
          >
            {loading
              ? "Please wait..."
              : mode === "login"
              ? "Login"
              : "Sign up"}
          </button>
        </form>

        <button
          type="button"
          onClick={() =>
            setMode((m) => (m === "login" ? "signup" : "login"))
          }
          style={{
            width: "100%",
            background: "transparent",
            border: "none",
            color: "#93c5fd",
            fontSize: "0.875rem",
            cursor: "pointer",
            marginTop: "1rem",
          }}
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}
