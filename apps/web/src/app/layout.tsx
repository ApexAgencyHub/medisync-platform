import type { Metadata } from "next";
import {
  DM_Sans,
  IBM_Plex_Sans_Arabic,
  Plus_Jakarta_Sans,
} from "next/font/google";
import { ImageLightboxProvider } from "@/shared/ui/ImageLightboxProvider";
import { ToastProvider } from "@/shared/ui/ToastProvider";
import { TopProgressBar } from "@/shared/ui/TopProgressBar";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const ibmPlexArabic = IBM_Plex_Sans_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-arabic",
  display: "swap",
  preload: false,
});

export const metadata: Metadata = {
  title: "MediSync Global — Medical Care & Health Network",
  description:
    "Find verified hospitals, clinics, doctors, and 24/7 duty pharmacies, book consultations, manage QR prescriptions, and request 141 medical transport.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${dmSans.variable} ${ibmPlexArabic.variable}`}
    >
      <body className="min-h-screen bg-[#F3F8FD] text-[#0F243E] antialiased selection:bg-[#0066CC]/15 selection:text-[#0F243E]">
        <TopProgressBar />
        <ToastProvider>
          <ImageLightboxProvider>{children}</ImageLightboxProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
