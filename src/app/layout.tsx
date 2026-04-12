import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Dashboard Electoral Perú 2026 | Resultados en Vivo",
  description: "Seguimiento en tiempo real de los resultados electorales de Perú 2026 con datos oficiales de la ONPE.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body className={`${inter.variable} antialiased selection:bg-red-500/30`}>
        {children}
      </body>
    </html>
  );
}
