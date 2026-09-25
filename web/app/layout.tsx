import type { Metadata } from "next";
import { Suspense } from "react";
import localFont from "next/font/local";
import { IBM_Plex_Mono, Noto_Sans_JP } from "next/font/google";
import { sidebarBattlefields } from "../lib/battlefields";
import { backgroundFiles } from "../lib/backgrounds";
import { backgroundVar, bootScript } from "./shell/frost";
import Sidebar from "./shell/Sidebar";
import "./globals.css";

// Fonts (DESIGN-SYSTEM.md section 8), all self-hosted by next/font
const neutralface = localFont({
  src: [
    { path: "./fonts/NeutralFace.otf", weight: "400" },
    { path: "./fonts/NeutralFace-Bold.otf", weight: "700" },
  ],
  variable: "--font-neutralface",
  display: "swap",
});
const aspekta = localFont({
  src: [
    { path: "./fonts/Aspekta-400.woff2", weight: "400" },
    { path: "./fonts/Aspekta-500.woff2", weight: "500" },
    { path: "./fonts/Aspekta-600.woff2", weight: "600" },
    { path: "./fonts/Aspekta-700.woff2", weight: "700" },
  ],
  variable: "--font-aspekta",
  display: "swap",
});
// No Japanese subset is offered for preloading; the browser fetches only the
// glyph files the kana need.
const notoJp = Noto_Sans_JP({
  weight: ["400", "500"],
  variable: "--font-noto-jp",
  display: "swap",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "KAMUI",
  description: "Job search battlefields",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const backgrounds = backgroundFiles();
  const battlefields = await sidebarBattlefields();

  return (
    <html
      lang="en"
      className={`${neutralface.variable} ${aspekta.variable} ${notoJp.variable} ${plexMono.variable} antialiased`}
      // bootScript sets the Frost and background variables on <html> before paint
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: bootScript(backgrounds) }} />
      </head>
      <body>
        {/* 1. the photograph, fixed; 2. the tint over it (section 7) */}
        <div
          aria-hidden
          className="fixed inset-0 bg-cover bg-center transition-[background-image] duration-500"
          style={{
            backgroundImage: backgrounds[0]
              ? `var(--bg-image, ${backgroundVar(backgrounds[0])})`
              : undefined,
          }}
        />
        <div aria-hidden className="fixed inset-0 bg-tint" />

        {/* 3. the glass panel, inset from the screen edge, holding everything */}
        <div className="relative flex h-dvh p-frame">
          <div className="frost-panel relative flex min-w-0 flex-1 overflow-hidden rounded-panel border border-panel-edge shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
            <Suspense>
              <Sidebar battlefields={battlefields} backgrounds={backgrounds} />
            </Suspense>
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
