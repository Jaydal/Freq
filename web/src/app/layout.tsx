import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import { Providers } from "@/features/auth/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { PP_ICON } from "@/constants/brand";

const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "Paddle Point — Pickleball Court Management",
  description: "Management Portal for Paddle Point Pickleball Courts — Solano, Nueva Vizcaya",
  icons: { icon: PP_ICON },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${outfit.variable} font-sans`}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
