import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import BootstrapClient from "@/components/BootstrapClient";
import { ScaleVars } from "@/components/ScaleVars";
import RealtimeFeed from "@/components/RealtimeFeed";

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Watchtower | Elite Security Monitoring",
  description: "Next-generation security monitoring for your assets.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      {/* Browser extensions (e.g. ColorZilla's cz-shortcut-listen) add attributes to <body>
          before hydration; this only ignores attribute diffs on <body> itself, not its children. */}
      <body className={outfit.className} suppressHydrationWarning>
        <ScaleVars />
        {children}
        <RealtimeFeed />
        <BootstrapClient />
      </body>
    </html>
  );
}
