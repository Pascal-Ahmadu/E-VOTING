import type { Metadata } from "next";
import { Lato } from "next/font/google";
import "./globals.css";
import { SidebarProvider } from "@/context/SidebarContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { BrandingProvider } from "@/context/BrandingContext";
import { BRANDING_DEFAULTS } from "@/lib/branding";
import { brandColorCss } from "@/lib/brand-palette";

const lato = Lato({
  subsets: ["latin"],
  weight: ["300", "400", "700", "900"],
  variable: "--font-lato",
});

export async function generateMetadata(): Promise<Metadata> {
  // The tenant is not known this high up; per-organisation titles and icons are
  // set by the /o/[slug] layout, which overrides these.
  const branding = BRANDING_DEFAULTS;
  return {
    title: branding.orgShortName,
    description:
      branding.tagline ?? `${branding.orgName} — secure online voting platform`,
    // An uploaded logo doubles as the favicon; otherwise fall back to the
    // bundled generic icon.
    icons: { icon: branding.logoUrl ?? "/images/favicon.ico" },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = BRANDING_DEFAULTS;

  return (
    <html lang="en">
      <body className={`${lato.variable} ${lato.className} dark:bg-gray-900`}>
        {/* Re-points Tailwind's --color-brand-* ramp at the configured seed
            colour. Rendered after the stylesheet so it wins on document order. */}
        <style
          dangerouslySetInnerHTML={{ __html: brandColorCss(branding.brandColor) }}
        />
        <BrandingProvider branding={branding}>
          <ThemeProvider>
            <SidebarProvider>{children}</SidebarProvider>
          </ThemeProvider>
        </BrandingProvider>
      </body>
    </html>
  );
}
