// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Built-in Demo Songs
// Seed songs for immediate offline play and instant autocomplete fallback
// ==========================================

import type { Song } from "@/types";

export const DEMO_SONGS: Song[] = [
  {
    id: "3c1e4d89-a37e-4eff-9cbe-cdc08ebb6a57",
    title: "วัดใจ",
    artist: "Silly Fools",
    aliases: ["wat jai", "watjai", "วัดจัย", "มีแค่ใจดวงเดียวดวงนี้", "เพลงวัดใจ"],
    releaseYear: 2004,
    era: "2000s",
    audioUrl: "https://pub-5d7ceb85b5354c3f916539f58a320c3a.r2.dev/songs/3c1e4d89-a37e-4eff-9cbe-cdc08ebb6a57/full.mp3",
    hookStartSec: 68,
    hookEndSec: 94,
    durationSec: 260,
    lyricsIntro: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย",
    lyricsChorus: "มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า",
  },
  {
    id: "f077a3de-8057-4508-932a-d566f34227bd",
    title: "ซ่อนกลิ่น",
    artist: "Palmy",
    aliases: ["son klin", "sorn klin", "คงไว้ได้แค่กลิ่น", "ปาล์มมี่ ซ่อนกลิ่น", "เพลงซ่อนกลิ่น"],
    releaseYear: 2018,
    era: "2010s",
    audioUrl: "https://pub-5d7ceb85b5354c3f916539f58a320c3a.r2.dev/songs/f077a3de-8057-4508-932a-d566f34227bd/full.mp3",
    hookStartSec: 65,
    hookEndSec: 90,
    durationSec: 250,
    lyricsIntro: "ลืมตาตื่นมาพร้อมหยาดน้ำตา กับความทรงจำที่ยังไม่จาง",
    lyricsChorus: "คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา ยังหอมดังวันเก่ายามเมื่อลมพัดมา",
  },
  {
    id: "d9bc9f47-626c-4141-9a4b-b3d3aa428012",
    title: "ขอบคุณที่รักกัน",
    artist: "Potato",
    aliases: ["kob koon tee ruk gun", "ขอบคุนที่รักกัน", "เพลงขอบคุณที่รักกัน"],
    releaseYear: 2006,
    era: "2000s",
    audioUrl: "https://pub-5d7ceb85b5354c3f916539f58a320c3a.r2.dev/songs/d9bc9f47-626c-4141-9a4b-b3d3aa428012/full.mp3",
    hookStartSec: 72,
    hookEndSec: 98,
    durationSec: 245,
    lyricsIntro: "เคยเกือบหมดหวัง และเคยเกือบถอดใจ",
    lyricsChorus: "ขอบคุณที่รักกัน ขอบคุณทุกรอยยิ้มที่มีให้กัน ขอบคุณความรักที่เธอส่งมา",
  },
];
