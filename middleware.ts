import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes only developers (org owners / solo devs) should access
const DEVELOPER_ROUTES = [
  "/dashboard",
  "/policies",
  "/audit-logs",
  "/api-keys",
  "/settings",
  "/playground",
  "/onboarding",
];

// Routes that require any authenticated user (member or admin)
const WORKSPACE_ROUTES = ["/chat", "/team"];

function isDeveloperRoute(pathname: string) {
  return DEVELOPER_ROUTES.some((r) => pathname.startsWith(r));
}

function isWorkspaceRoute(pathname: string) {
  return WORKSPACE_ROUTES.some((r) => pathname.startsWith(r));
}

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  const isAuthRoute =
    pathname.startsWith("/login") || pathname.startsWith("/signup");

  const isProtected = isDeveloperRoute(pathname) || isWorkspaceRoute(pathname);

  // ── Not logged in → send to login ───────────────────────────────────────
  if (!user && isProtected) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user) {
    // Determine whether this user is a pure org employee (no developer projects)
    const isPureEmployee = async () => {
      const [{ data: membership }, { data: project }] = await Promise.all([
        supabase
          .from("organization_members")
          .select("role")
          .eq("user_id", user.id)
          .limit(1)
          .single(),
        supabase
          .from("projects")
          .select("id")
          .eq("user_id", user.id)
          .limit(1)
          .single(),
      ]);
      // Has an org membership but owns no developer projects
      return !!membership && !project;
    };

    // ── Auth pages: redirect logged-in users to the right home ────────────
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      if (await isPureEmployee()) {
        url.pathname = "/chat";
      } else {
        url.pathname = "/dashboard";
      }
      return NextResponse.redirect(url);
    }

    // ── Developer routes: block pure employees ────────────────────────────
    if (isDeveloperRoute(pathname)) {
      if (await isPureEmployee()) {
        const url = request.nextUrl.clone();
        url.pathname = "/chat";
        return NextResponse.redirect(url);
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/guard|api/stripe/webhook|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
