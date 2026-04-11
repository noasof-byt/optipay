import type { Metadata, Viewport } from "next";
import "./globals.css";
import { BottomNav } from "@/components/layout/BottomNav";
import { TopBar } from "@/components/layout/TopBar";
import { Toaster } from "@/components/ui/Toaster";

// ── PWA / SEO Metadata ────────────────────────────────────────────────────────
export const metadata: Metadata = {
  title: {
    default: "OptiPay – חיסכון חכם",
    template: "%s | OptiPay",
  },
  description:
    "מצא את הדרך הזולה ביותר לקנות עם כרטיסי המתנה והמועדונים שלך. השווה מחירים בזמן אמת.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "OptiPay",
    startupImage: ["/icons/apple-splash-1170x2532.png"],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "he_IL",
    url: process.env.NEXT_PUBLIC_APP_URL,
    siteName: "OptiPay",
    title: "OptiPay – חיסכון חכם",
    description: "מצא את הדרך הזולה ביותר לקנות עם כרטיסי המתנה והמועדונים שלך.",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png" },
    ],
    apple: "/icons/icon-192x192.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1B4FDB" },
    { media: "(prefers-color-scheme: dark)",  color: "#1B4FDB" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,        // prevent zoom on input focus (mobile UX)
  userScalable: false,
  viewportFit: "cover",   // allows content behind iPhone notch/home indicator
};

// ── Root Layout ───────────────────────────────────────────────────────────────
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        {/* Preconnect to Google Fonts for Rubik */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* iOS specific PWA meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="black-translucent"
        />
        <meta name="apple-mobile-web-app-title" content="OptiPay" />
      </head>
      <body className="font-sans">
        {/* ── App Shell ── */}
        <div className="flex flex-col min-h-dvh">
          <TopBar />

          <main className="flex-1 pt-16">
            {/* pt-16 = TopBar height */}
            {children}
          </main>

          <BottomNav />
        </div>

        {/* Global toast notifications */}
        <Toaster />
      </body>
    </html>
  );
}
