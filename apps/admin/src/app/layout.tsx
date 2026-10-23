import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Adventure Foundry Admin",
  description: "Moderation and store tools for Adventure Foundry",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
