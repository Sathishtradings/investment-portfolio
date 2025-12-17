import { NextResponse } from "next/server";
import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";

export async function middleware(req) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { pathname } = req.nextUrl;

  // Protect portfolio
  if (pathname.startsWith("/portfolio") && !session) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Prevent logged-in users from seeing login
  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/portfolio", req.url));
  }

  return res;
}

export const config = {
  matcher: ["/portfolio/:path*", "/login"],
};
