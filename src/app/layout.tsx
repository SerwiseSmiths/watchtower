import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "bootstrap/dist/css/bootstrap.min.css";
import "./globals.css";

import BootstrapClient from "@/components/BootstrapClient";

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
      <body className={outfit.className}>
        {children}
        <BootstrapClient />
      </body>
    </html>
  );
}
