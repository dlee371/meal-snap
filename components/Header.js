// Site header (server component). Reads the session on the server, so it renders
// the right links on first load without a loading flicker.
import Link from "next/link";
import { getSession } from "@/lib/session";
import SignOutButton from "@/components/SignOutButton";

export default async function Header() {
  const session = await getSession();

  return (
    <header className="border-b border-foreground/10">
      <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-4 py-3">
        <Link href={session ? "/log" : "/"} className="font-semibold">
          Meal Snap
        </Link>

        {session ? (
          <nav className="flex items-center gap-4 text-sm">
            {/* Dashboard link arrives in Phase 6. */}
            <Link href="/snap" className="hover:underline">
              Snap
            </Link>
            <Link href="/log" className="hover:underline">
              Log
            </Link>
            <SignOutButton />
          </nav>
        ) : (
          <Link href="/login" className="text-sm hover:underline">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
