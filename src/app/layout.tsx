import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SupabaseStorageProvider from "@/components/SupabaseStorageProvider";
import EnvDiagnostic from "@/components/EnvDiagnostic";
import SyncProvider from "@/components/SyncProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MikroPanel",
  description: "Sistema de gestión empresarial",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SupabaseStorageProvider>
          <SyncProvider>
            <EnvDiagnostic />
            {children}
          </SyncProvider>
        </SupabaseStorageProvider>
      </body>
    </html>
  );
}
