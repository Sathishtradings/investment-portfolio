// app/api/symbols/route.js
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in server env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim();
  if (!q) return NextResponse.json([]);

  try {
    // name contains OR symbol starts with (case-insensitive)
    // Using ILIKE for portability; for better fuzzy search add pg_trgm and similarity later.
    const qLike = `%${q}%`;
    const symbolPrefix = `${q}%`;

    const { data, error } = await supabaseAdmin
      .from("symbols")
      .select("symbol, name, exchange, metadata")
      .or(`name.ilike.${qLike},symbol.ilike.${symbolPrefix}`)
      .limit(20)
      .order("name", { ascending: true });

    if (error) {
      console.error("symbols search error:", error);
      return NextResponse.json([], { status: 500 });
    }

    const results = (data || []).map(r => ({
      name: r.name,
      symbol: (r.symbol || "").toUpperCase(),
      exchange: r.exchange || null,
      metadata: r.metadata || {}
    }));

    return NextResponse.json(results);
  } catch (err) {
    console.error("symbols handler error:", err);
    return NextResponse.json([], { status: 500 });
  }
}
