import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Guionizator Pro",
  description:
    "Crea guiones de Instagram (Reels y carruseles) por cliente, con el cerebro de guionista de Paco Cuevas.",
  icons: {
    icon: [
      {
        url: "https://res.cloudinary.com/dghuokhlw/image/upload/v1781072303/favicon1_dkjxxm.jpg",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "https://res.cloudinary.com/dghuokhlw/image/upload/v1781072303/favicon2_tljxof.jpg",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: {
      url: "https://res.cloudinary.com/dghuokhlw/image/upload/v1781072374/instagram1_fjly5c.jpg",
      sizes: "180x180",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${spaceGrotesk.variable} ${dmSans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
