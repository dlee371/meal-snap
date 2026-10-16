"use client";
// One form, two modes: "signin" and "signup". Talks to Better Auth from the browser.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginForm({ redirectTo }) {
  const router = useRouter();
  const [mode, setMode] = useState("signin");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const isSignUp = mode === "signup";

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setPending(true);

    const form = new FormData(event.currentTarget);
    const email = String(form.get("email")).trim();
    const password = String(form.get("password"));

    // Better Auth returns { data, error } instead of throwing.
    const { error } = isSignUp
      ? // `name` is required by Better Auth; we don't ask for one, so use the email prefix.
        await authClient.signUp.email({ email, password, name: email.split("@")[0] })
      : await authClient.signIn.email({ email, password });

    if (error) {
      setError(error.message || "Something went wrong. Please try again.");
      setPending(false);
      return;
    }
    router.push(redirectTo);
    router.refresh(); // so the header re-renders as signed in
  }

  return (
    <section className="mx-auto flex max-w-sm flex-col gap-6 py-8">
      <h1 className="text-2xl font-bold">{isSignUp ? "Create an account" : "Sign in"}</h1>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Email
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-base"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Password
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={isSignUp ? "new-password" : "current-password"}
            className="rounded-md border border-foreground/20 bg-transparent px-3 py-2 text-base"
          />
          {isSignUp && <span className="text-foreground/60">At least 8 characters.</span>}
        </label>

        {error && (
          <p role="alert" className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-foreground px-4 py-2 font-medium text-background disabled:opacity-50"
        >
          {pending ? "Please wait…" : isSignUp ? "Sign up" : "Sign in"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setMode(isSignUp ? "signin" : "signup");
          setError("");
        }}
        className="text-sm text-foreground/70 hover:underline"
      >
        {isSignUp ? "Already have an account? Sign in" : "New here? Create an account"}
      </button>
    </section>
  );
}
