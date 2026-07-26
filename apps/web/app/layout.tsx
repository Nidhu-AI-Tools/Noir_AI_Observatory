import type { Metadata } from "next";
import type { ReactNode } from "react";

import { Navigation } from "../components/navigation";
import "./globals.css";

export const metadata: Metadata = {
  description:
    "A continuously updated view of AI releases, research, APIs, and model behavior.",
  title: {
    default: "Noir AI Observatory",
    template: "%s | Noir AI Observatory",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen">
          <Navigation />
          <main className="mx-auto w-full max-w-7xl px-5 py-10 sm:px-8 lg:px-10">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
