// app/api/investments/[id]/route.js
import { NextResponse } from "next/server";
import { supabaseAdmin } from "../../../../lib/supabaseAdmin";

export const runtime = "nodejs";

async function getUserFromAuthHeader(request) {
  const auth = request.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const token = auth.split(" ")[1];
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) {
    console.error("Auth getUser error:", error);
    return null;
  }
  return data.user;
}

export async function PUT(request, context) {
  const params = await context.params; // unwrap promise
  const { id } = params;

  const user = await getUserFromAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { shares, currentPrice, name, symbol, type, buyPrice } = body;

  // check ownership first
  const { data: found, error: fetchErr } = await supabaseAdmin
    .from("investments")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !found) {
    console.error("Ownership fetch error:", fetchErr);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const updateObj = {};
  if (shares != null) updateObj.shares = shares;
  if (currentPrice != null) updateObj.current_price = currentPrice;
  if (name != null) updateObj.name = name;
  if (symbol != null) updateObj.symbol = symbol.toUpperCase();
  if (type != null) updateObj.type = type;
  if (buyPrice != null) updateObj.buy_price = buyPrice;

  const { data, error } = await supabaseAdmin
    .from("investments")
    .update(updateObj)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("PUT /api/investments/:id error:", error);
    return NextResponse.json({ error: "Failed to update investment" }, { status: 500 });
  }

  return NextResponse.json(data);
}

export async function DELETE(request, context) {
  const params = await context.params;
  const { id } = params;

  const user = await getUserFromAuthHeader(request);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // check ownership
  const { data: found, error: fetchErr } = await supabaseAdmin
    .from("investments")
    .select("user_id")
    .eq("id", id)
    .single();

  if (fetchErr || !found) {
    console.error("Ownership fetch error:", fetchErr);
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (found.user_id !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data, error } = await supabaseAdmin
    .from("investments")
    .delete()
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("DELETE /api/investments/:id error:", error);
    return NextResponse.json({ error: "Failed to delete investment" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
