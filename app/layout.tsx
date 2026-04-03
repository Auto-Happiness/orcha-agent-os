import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ColorSchemeScript, MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { ConvexClientProvider } from "./providers";
import "@mantine/core/styles.css";
import "@mantine/notifications/styles.css";
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
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <head>
          <ColorSchemeScript defaultColorScheme="dark" />
        </head>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
          suppressHydrationWarning
        >
          <MantineProvider defaultColorScheme="dark">
            <Notifications position="top-right" zIndex={2000} />
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </MantineProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
