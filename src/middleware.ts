import { type NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const hasSession = request.cookies
    .getAll()
    .some((cookie) => cookie.name.includes("auth-token") && cookie.value.length > 0);
  if (hasSession || process.env.NODE_ENV === "development") return NextResponse.next();

  const shellUrl = process.env.NEXT_PUBLIC_SHELL_URL ?? "https://maza-maza.vercel.app";
  const login = new URL("/login", shellUrl);
  login.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(login, 302);
}

export const config = { matcher: ["/operacao/:path*"] };
