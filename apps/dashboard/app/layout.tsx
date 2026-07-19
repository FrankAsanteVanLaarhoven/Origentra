import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/lib/theme";
import { I18nProvider } from "@/lib/i18n";
import { SoundProvider } from "@/lib/sound";
import { AppShell } from "@/components/AppShell";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Origentra — Control Plane",
  description: "Secure every identity. Prove every asset. Control every release.",
};

// Set the resolved theme before first paint to avoid a flash.
const noFlash = `(()=>{try{var p=localStorage.getItem('origentra-theme')||'system';var d=p==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):p;document.documentElement.dataset.theme=d;}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlash }} />
      </head>
      <body className="min-h-full">
        <ThemeProvider>
          <I18nProvider>
            <SoundProvider>
              <AppShell>{children}</AppShell>
            </SoundProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
