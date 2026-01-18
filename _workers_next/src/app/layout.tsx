import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { MobileNavWrapper } from "@/components/mobile-nav-wrapper";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { getSetting } from "@/lib/db/queries";

const inter = Inter({ subsets: ["latin"] });

const DEFAULT_TITLE = "LDC Virtual Goods Shop";
const DEFAULT_DESCRIPTION = "High-quality virtual goods, instant delivery";

export async function generateMetadata(): Promise<Metadata> {
  let shopName: string | null = null;
  let shopDescription: string | null = null;
  let shopLogo: string | null = null;
  let noIndex = false;
  try {
    const [name, desc, logo, noIndexSetting] = await Promise.all([
      getSetting("shop_name"),
      getSetting("shop_description"),
      getSetting("shop_logo"),
      getSetting("noindex_enabled")
    ]);
    shopName = name;
    shopDescription = desc;
    shopLogo = logo;
    noIndex = noIndexSetting === 'true';
  } catch {
    shopName = null;
    shopDescription = null;
    shopLogo = null;
  }

  const metadata: Metadata = {
    title: shopName?.trim() || DEFAULT_TITLE,
    description: shopDescription?.trim() || DEFAULT_DESCRIPTION,
    robots: noIndex ? { index: false, follow: false } : undefined,
    manifest: "/manifest.json",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: shopName?.trim() || DEFAULT_TITLE,
    },
    formatDetection: {
      telephone: false,
    },
    other: {
      "mobile-web-app-capable": "yes",
    },
  };

  // Add custom favicon if logo is set
  if (shopLogo?.trim()) {
    metadata.icons = {
      icon: shopLogo.trim(),
      shortcut: shopLogo.trim(),
      apple: shopLogo.trim(),
    };
  }

  return metadata;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  let themeColor: string | null = null;
  try {
    themeColor = await getSetting("theme_color");
  } catch {
    themeColor = null;
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <Providers themeColor={themeColor}>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1 pb-16 md:pb-0">{children}</div>
            <SiteFooter />
            <MobileNavWrapper />
          </div>
        </Providers>
      </body>
    </html>
  );
}
