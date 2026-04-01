import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import "./globals.css";

const geist = Geist({
  variable: "--font-geist",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Vitalis AI — Fisioterapia Inteligente",
  description: "Rastreamento de exercícios domiciliares com visão computacional. Sem download de app.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#030712",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="pt-BR" className={`${geist.variable} h-full`}>
        <head>
          {/* MediaPipe Pose — carregado via CDN para evitar problemas de SSR */}
          <Script
            src="https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js"
            strategy="beforeInteractive"
            crossOrigin="anonymous"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js"
            strategy="beforeInteractive"
            crossOrigin="anonymous"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js"
            strategy="beforeInteractive"
            crossOrigin="anonymous"
          />
          <Script
            src="https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js"
            strategy="beforeInteractive"
            crossOrigin="anonymous"
          />
        </head>
        <body className="min-h-full bg-gray-950 antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
