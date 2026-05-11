import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthShell }    from "@/components/layout/AuthShell";
import { MainContent }  from "@/components/layout/MainContent";
import { Toaster }      from "@/components/ui/Toaster";

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
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
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
        {/* Restore accessibility settings before React hydration — prevents flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=JSON.parse(localStorage.getItem('accessibility')||'{}');var h=document.documentElement;if(s.textSize==='large')h.classList.add('acc-text-large');if(s.textSize==='xlarge')h.classList.add('acc-text-xlarge');if(s.highContrast)h.classList.add('acc-high-contrast');if(s.lineRelaxed)h.classList.add('acc-line-relaxed');if(s.reduceMotion)h.classList.add('acc-reduced-motion');}catch(e){}})();`,
          }}
        />
        {/* Preconnect to Google Fonts for Rubik + Assistant */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        {/* iOS PWA meta tags */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="OptiPay" />
      </head>
      <body className="font-sans">
        <div className="flex flex-col min-h-dvh">
          {/*
            AuthShell is a client component that:
            - Registers the service worker on mount
            - Renders TopBar always
            - Renders BottomNav only when user is authenticated
          */}
          <AuthShell />

          <MainContent>{children}</MainContent>
        </div>

        {/* Global toast notifications */}
        <Toaster />
      </body>
    </html>
  );
}
