// app/api/investments/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../lib/supabaseAdmin";

export const runtime = "nodejs";

async function getUserFromAuthHeader(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.split(" ")[1];
  // verify token and get user
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.error("Auth getUser error:", error);
    return null;
  }
  return data.user;
}

export async function GET(request) {
  const user = await getUserFromAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("investments")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("GET /api/investments error:", error);
    return NextResponse.json({ error: "Failed to load investments" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function POST(request) {
  const user = await getUserFromAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, symbol, type, shares, buyPrice, currentPrice } = body;
  if (!name || !symbol || !type || shares == null || buyPrice == null || currentPrice == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("investments")
    .insert({
      name,
      symbol: symbol.toUpperCase(),
      type,
      shares,
      buy_price: buyPrice,
      current_price: currentPrice,
      user_id: user.id,
    })
    .select()
    .single();

  if (error) {
    console.error("POST /api/investments error:", error);
    return NextResponse.json({ error: "Failed to add investment" }, { status: 500 });
  }

  return NextResponse.json(data, { status: 201 });
}
