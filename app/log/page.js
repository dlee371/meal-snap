// /log: placeholder for the daily log (built in Phase 5). For now it just proves
// that a protected page knows who is signed in.
import { requireUser } from "@/lib/session";

export const metadata = { title: "Log · Meal Snap Logger" };

export default async function LogPage() {
  // Middleware already redirects signed-out users; this is the second check
  // (never rely on middleware alone).
  const user = await requireUser("/log");

  return (
    <section className="flex flex-col gap-2">
      <h1 className="text-2xl font-bold">Your log</h1>
      <p className="text-foreground/70">Signed in as {user.email}. Meals arrive in Phase 2.</p>
    </section>
  );
}
