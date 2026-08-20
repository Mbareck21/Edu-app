import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";

import RegisterSW from "@/components/RegisterSW";
import "./globals.css";

const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["500", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Quest",
  description: "Words, reading and math practice.",
  applicationName: "Quest",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Quest",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#22A06B",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="min-h-dvh antialiased">
        {/* Phone-first: the app stays a phone-width column on a laptop, with
            the warm sand background around it. */}
        <div className="app-shell mx-auto min-h-dvh w-full max-w-app bg-bg shadow-lift">
          {children}
        </div>
        <RegisterSW />
      </body>
    </html>
  );
}
