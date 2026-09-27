import "./globals.css";
import { Bricolage_Grotesque } from "next/font/google";

const brand = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-brand", display: "swap" });

export const metadata = {
  title: "yappr: every podcast, free",
  description: "Search and listen to any podcast for free. One short ad before and after, never in the middle.",
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
      </head>
      <body>{children}</body>
    </html>
  );
}
