import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "เพลงไรวะ? (Pleng-Rai-Wa) - เว็บเกมทายเพลงออนไลน์",
    short_name: "เพลงไรวะ",
    description: "เกมทายเพลงออนไลน์เล่นกับเพื่อนหรือเดี่ยว ทายเสี้ยววินาที กดกริ่งแย่งตอบ หรือทายเนื้อเพลงด้วยเสียง AI ฟรี 100%",
    start_url: "/",
    display: "standalone",
    background_color: "#030712",
    theme_color: "#030712",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
