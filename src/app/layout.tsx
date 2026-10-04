import type { Metadata } from "next";
import { Kanit, Prompt } from "next/font/google";
import "./globals.css";

const kanit = Kanit({
  weight: ["300", "400", "500", "600", "700", "800"],
  subsets: ["thai", "latin"],
  variable: "--font-kanit",
  display: "swap",
});

const prompt = Prompt({
  weight: ["300", "400", "500", "600"],
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
  display: "swap",
});

export const metadata: Metadata = {
  title: "เพลงไรวะ? (Pleng-Rai-Wa) - เว็บเกมทายเพลงออนไลน์",
  description:
    "เว็บเกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเล่นคนเดียว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI สไตล์ชิวๆ สนุกๆ",
  keywords: ["ทายเพลง", "เกมทายเพลง", "เพลงไรวะ", "เกมปาร์ตี้", "quiz", "music game"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${kanit.variable} ${prompt.variable} dark`}>
      <body className="min-h-screen bg-slate-950 text-slate-100 font-sans antialiased selection:bg-pink-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
