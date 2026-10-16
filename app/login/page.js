// /login: server component wrapper. It reads ?next= from the URL and hands a
// cleaned-up version to the interactive form.
import LoginForm from "@/components/LoginForm";
import { safeRedirectPath } from "@/lib/safe-redirect";

export const metadata = { title: "Sign in · Meal Snap Logger" };

export default async function LoginPage({ searchParams }) {
  // Next.js 15: searchParams is a Promise, so it must be awaited.
  const { next } = await searchParams;
  return <LoginForm redirectTo={safeRedirectPath(next)} />;
}
