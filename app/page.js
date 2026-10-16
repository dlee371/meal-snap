// Public landing page. The demo-account login link is added in Phase 7.
import Link from "next/link";

export default function Home() {
  return (
    <section className="flex flex-col gap-4 py-10">
      <h1 className="text-3xl font-bold">Meal Snap Logger</h1>
      <p className="text-foreground/70">
        Snap a photo of your meal. AI estimates the foods and nutrition, you correct
        anything it got wrong, and it lands in your daily log.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-block rounded-md bg-foreground px-4 py-2 font-medium text-background"
        >
          Get started
        </Link>
      </div>
    </section>
  );
}
