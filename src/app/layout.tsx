import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import NetworkBackground from "./NetworkBackground";

// JetBrains Mono — headers, labels, skill names, technical/instruction text only.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// IBM Plex Sans — body text, chat messages, descriptions.
const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Skillsmith — forge a Mantle skill",
  description:
    "A self-growing library of Mantle skills. Ask a question; if none fits, a new skill is forged.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0A1712",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetbrainsMono.variable} ${ibmPlexSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NetworkBackground />
        {children}
      </body>
    </html>
  );
}
