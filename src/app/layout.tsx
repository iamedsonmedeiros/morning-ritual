import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://app.edson.digital"),
  title: {
    default: "Morning Ritual",
    template: "%s | Morning Ritual",
  },
  description:
    "Web app de rotina, hábitos e consistência inspirado no Milagre da Manhã.",
  applicationName: "Morning Ritual",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#22d3ee",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased scroll-smooth`}
    >
      <body className="min-h-[100dvh] bg-slate-950 font-sans text-slate-50 touch-manipulation">{children}</body>
    </html>
  );
}
