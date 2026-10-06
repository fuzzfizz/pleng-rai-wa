import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Security Proxy (Next.js 16)
// Restricts /admin and /api/admin to localhost only
// ==========================================

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "";

    // Check if accessing from local machine
    const isLocalhost =
      host.startsWith("localhost") ||
      host.startsWith("127.0.0.1") ||
      host.startsWith("[::1]");

    if (isLocalhost) {
      return NextResponse.next();
    }

    // Optional override via ADMIN_SECRET_KEY query or header if explicitly configured
    const adminSecret = process.env.ADMIN_SECRET_KEY;
    const querySecret = request.nextUrl.searchParams.get("secret");
    const headerSecret = request.headers.get("x-admin-secret");

    if (
      adminSecret &&
      adminSecret !== "pleng-rai-wa-admin-dev-secret" &&
      (querySecret === adminSecret || headerSecret === adminSecret)
    ) {
      return NextResponse.next();
    }

    // Block public internet access:
    if (pathname.startsWith("/api/admin")) {
      return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    // Redirect public web visitors back to home page
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/api/admin/:path*"],
};
