import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Engine",
  description: "Personal lead-generation engine. Single user, drafts only.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght,SOFT,WONK@9..144,300..900,0..100,0..1&family=Instrument+Sans:wght@400..700&family=JetBrains+Mono:wght@400..700&display=swap"
        />
      </head>
      <body className="min-h-screen bg-canvas font-sans text-body text-primary antialiased">
        {children}
      </body>
    </html>
  );
}
