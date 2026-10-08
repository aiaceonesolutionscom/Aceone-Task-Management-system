import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "aceone.session";

// Paths that never require authentication
const PUBLIC_PATHS = [
  "/login",
  "/api/auth",
  "/sw.js",
  "/favicon.ico",
  "/robots.txt",
  "/manifest.json",
];

// Suspicious patterns typically used by automated scanners and attackers
const MALICIOUS_PATTERNS = [
  /(\.\.|\%2e\%2e)/i, // Path traversal
  /\%00/i,            // Null byte injection
  /\.(env|git|sql|bak|config|asp|php)$/i, // Sensitive files
  /(wp-admin|phpmyadmin|\.well-known\/security\.txt)/i, // WordPress / DB scans
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Block malicious scanning attempts immediately
  for (const pattern of MALICIOUS_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse("Access Denied", { status: 403 });
    }
  }

  // 2. Allow static files, Next.js internal files, and public routes
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
  ) {
    return NextResponse.next();
  }

  // 3. For protected app routes, check session cookie
  const sessionToken = request.cookies.get(AUTH_COOKIE)?.value;

  if (!sessionToken) {
    // If an API route is hit without session, return 401 Unauthorized
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized: Active session required." },
        { status: 401 }
      );
    }

    // Otherwise redirect to login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Session exists: proceed with request
  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     * - sw.js (service worker)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|sw.js).*)",
  ],
};
