import type { Metadata } from "next";
import { Geist, Geist_Mono, Anton, Bebas_Neue, Noto_Sans_JP, M_PLUS_1p } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const anton = Anton({ variable: "--font-anton", subsets: ["latin"], weight: "400" });
const bebasNeue = Bebas_Neue({ variable: "--font-bebas", subsets: ["latin"], weight: "400" });
const notoSansJP = Noto_Sans_JP({ variable: "--font-noto", subsets: ["latin"], weight: ["700", "900"] });
const mplus = M_PLUS_1p({ variable: "--font-mplus", subsets: ["latin"], weight: ["700", "800"] });

export const metadata: Metadata = {
  title: "大喜利投票アプリ_QOL",
  description: "リアルタイム投票アプリ",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} ${anton.variable} ${bebasNeue.variable} ${notoSansJP.variable} ${mplus.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
