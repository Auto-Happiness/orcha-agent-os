import type { Metadata } from "next";
import { Space_Grotesk, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { MantineUiProvider } from "@/lib/mantine-provider";
import { ConvexClientProvider } from "./providers";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orcha Agent OS",
  description:
    "Orcha Agent OS: Autonomous agents, orchestrated. Connect your data, define your agents, and let Orcha handle the rest — in natural language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" data-mantine-color-scheme="dark" suppressHydrationWarning>
      <head />
      <body
        className={`${spaceGrotesk.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ClerkProvider>
          <MantineUiProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </MantineUiProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
