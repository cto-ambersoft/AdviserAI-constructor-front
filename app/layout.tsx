import type { Metadata } from "next";
import { Geist, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthBootstrap } from "@/components/auth/auth-bootstrap";
import { TradingStoreProvider } from "@/providers/trading-store-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Tradex",
  description: "Tradex is a AI-powered trading service frontend scaffold",
  icons: {
    icon: "/ai-trader.svg",
    shortcut: "/ai-trader.svg",
    apple: "/ai-trader.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${jetBrainsMono.variable} antialiased`}
      >
        <TradingStoreProvider>
          <AuthBootstrap />
          {children}
        </TradingStoreProvider>
      </body>
    </html>
  );
}
