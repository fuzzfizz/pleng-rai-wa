import type { Metadata, Viewport } from "next";
import { Kanit, Prompt } from "next/font/google";
import { AuthProvider } from "@/hooks/use-auth";
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
    "เกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเดี่ยว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI ฟรี 100%",
  keywords: ["ทายเพลง", "เกมทายเพลง", "เพลงไรวะ", "เกมปาร์ตี้", "quiz", "music game"],
  openGraph: {
    title: "เพลงไรวะ? (Pleng-Rai-Wa) - เว็บเกมทายเพลงออนไลน์",
    description:
      "เกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเดี่ยว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI ฟรี 100%",
    locale: "th_TH",
    type: "website",
    siteName: "เพลงไรวะ (Pleng-Rai-Wa)",
  },
  twitter: {
    card: "summary_large_image",
    title: "เพลงไรวะ? (Pleng-Rai-Wa) - เว็บเกมทายเพลงออนไลน์",
    description:
      "เกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเดี่ยว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI ฟรี 100%",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#030712",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" className={`${kanit.variable} ${prompt.variable} dark`}>
      <body className="min-h-screen min-h-[100dvh] bg-slate-950 text-slate-100 font-sans antialiased selection:bg-pink-500 selection:text-white">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
