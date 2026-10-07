import type { Metadata, Viewport } from "next";
import { Kanit, Prompt } from "next/font/google";
import { AuthProvider } from "@/hooks/use-auth";
import { ThemeProvider } from "@/contexts/theme-context";
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF7F2" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
  colorScheme: "dark light",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning className={`${kanit.variable} ${prompt.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Playpen+Sans+Thai:wght@100..800&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('pleng_theme');
                  var isDark = saved === 'dark' || (!saved && window.matchMedia('(prefers-color-scheme: dark)').matches) || !saved;
                  if (saved === 'light') {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="min-h-screen min-h-[100dvh] bg-[#FAF7F2] dark:bg-[#0c0a09] text-stone-900 dark:text-stone-100 font-sans antialiased selection:bg-amber-500 selection:text-stone-950 transition-colors duration-200">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
