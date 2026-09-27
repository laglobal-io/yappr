import "./globals.css";
import { Bricolage_Grotesque } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const brand = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", display: "swap" });

export const metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://yappr.fm"),
  alternates: { canonical: "/" },
  title: "yappr: every podcast, free",
  description: "Every Podcast. Every Creator. Search and listen to podcasts and live radio, free on yappr.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "yappr", statusBarStyle: "default" },
  icons: { apple: "/apple-touch-icon.png" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F1ECFF" },
    { media: "(prefers-color-scheme: dark)", color: "#15101F" },
  ],
};

// Applies the saved theme before first paint so there's no flash.
const themeScript = `try{var t=localStorage.getItem("yappr:theme");if(t)document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={brand.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {/* Artwork is resized by wsrv.nl; connect early so images start sooner */}
        <link rel="preconnect" href="https://wsrv.nl" crossOrigin="anonymous" />
      </head>
      <body>
        {children}
        {/* Cookie-free page-view counts and real-visitor speed measurements (Vercel) */}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
