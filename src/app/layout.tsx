import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { ProfileThemeProvider } from "@/components/providers/ProfileThemeProvider";
import { ToastProvider } from "@/components/providers/ToastProvider";
import { PwaRegister } from "@/components/providers/PwaRegister";
import { AppShell } from "@/components/layout/AppShell";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains-mono",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF8F5" },
    { media: "(prefers-color-scheme: dark)", color: "#181715" },
  ],
};

export const metadata: Metadata = {
  title: "Cadernin — Organização de Estudos",
  description:
    "Seu espaço pessoal editorial para organização de estudos, cronograma, exercícios, simulados e desempenho.",
  manifest: "/manifest.json",
  applicationName: "Cadernin",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Cadernin",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { url: "/icons/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

const themeInitScript = `
(function() {
  try {
    var saved = window.localStorage.getItem('caderno_editorial_theme_v1');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (saved === 'light') {
      document.documentElement.classList.remove('dark');
    }
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plusJakartaSans.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <PwaRegister />
        <ToastProvider>
          <ProfileThemeProvider>
            <AppShell>{children}</AppShell>
          </ProfileThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
