import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/features/auth/components/providers";
import { Toaster } from "@/components/ui/sonner";
import { PP_ICON } from "@/constants/brand";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Paddle Point — Pickleball Court Management",
  description: "Management Portal for Paddle Point Pickleball Courts — Solano, Nueva Vizcaya",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href={PP_ICON} />
      </head>
      <body className={inter.className}>
        <Providers>{children}</Providers>
        <Toaster />
      </body>
    </html>
  );
}
