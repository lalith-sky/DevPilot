import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HackNova | Developer Platform",
  description: "Manage registered agents and track tasks in the HackNova developer platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
