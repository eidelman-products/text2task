"use client";

import { createClient } from "@/lib/supabase/client";

export default function LogoutButton() {
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <button
      onClick={handleLogout}
      style={{
        padding: "10px 16px",
        borderRadius: "12px",
        border: "1px solid #e2e8f0",
        background: "white",
        color: "#0f172a",
        fontSize: "14px",
        fontWeight: "bold",
        cursor: "pointer",
      }}
    >
      Logout
    </button>
  );
}