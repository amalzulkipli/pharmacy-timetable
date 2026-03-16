import type { Metadata, Viewport } from "next";
import { Nunito, Nunito_Sans, Geist } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans" });
const nunito = Nunito({ subsets: ["latin"], variable: "--font-nunito" });

export const metadata: Metadata = {
  title: "Farmasi Alde | Staff Timetable",
  description: "Farmasi Alde staff scheduling and timetable system",
  manifest: "/timetable/manifest.json",
  icons: {
    icon: "/timetable/icon.svg",
    apple: "/timetable/apple-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={cn("font-sans", geist.variable)}>
      <body className={`${nunitoSans.variable} ${nunito.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
