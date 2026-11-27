import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://reponecromancer.fun"),
  title: "RepoNecromancer — raise dead repos",
  description:
    "Exhume abandoned JavaScript projects, diagnose what killed them, transplant dead dependencies, patch breaking changes with AST codemods and prove they live with generated regression tests.",
  openGraph: {
    title: "RepoNecromancer — raise dead repos",
    description: "Dead dependencies in, green tests out. Built with Kiro for Kiroween 2026.",
    url: "https://reponecromancer.fun",
    siteName: "RepoNecromancer",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
