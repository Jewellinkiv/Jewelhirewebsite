import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// JewelLink brand font (matched to jewellink.com)
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "JewelHire",
  description: "JewelHire v2 — jewelry hiring & JewelCert",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
