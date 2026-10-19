// Fonts come from the `geist` npm package (bundled locally) instead of
// next/font/google, so builds never need to download from Google Fonts.
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import Header from "@/components/Header";
import TimeZoneSync from "@/components/TimeZoneSync";
import "./globals.css";

export const metadata = {
  title: "Meal Snap Logger",
  description: "Snap a meal, let AI estimate it, then correct and log it.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      {/* .variable defines the CSS variables --font-geist-sans / --font-geist-mono,
          which globals.css already uses. */}
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased min-h-screen`}
      >
        <TimeZoneSync />
        <Header />
        <main className="mx-auto w-full max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
