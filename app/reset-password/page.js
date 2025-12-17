"use client";

import { useState } from "react";
import { supabaseClient } from "@/lib/supabaseClient";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const updatePassword = async () => {
    setLoading(true);
    const { error } = await supabaseClient.auth.updateUser({
      password,
    });
    setLoading(false);

    if (error) {
      alert(error.message);
    } else {
      alert("Password updated successfully. Please login.");
      window.location.href = "/login";
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: 360 }}>
        <h2>Reset Password</h2>
        <input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input"
          style={{ width: "100%", marginBottom: "1rem" }}
        />
        <button onClick={updatePassword} disabled={loading} className="btn btn-primary" style={{ width: "100%" }}>
          {loading ? "Updating..." : "Update Password"}
        </button>
      </div>
    </div>
  );
}
