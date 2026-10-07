// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Seed Songs Script
// Seeds 24+ classic and modern Thai hits across 4 eras and multiple genres
// ==========================================

import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

// Parse .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const envVars = {};
for (const line of envContent.split('\n')) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx !== -1) {
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    envVars[key] = val;
  }
}

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seed() {
  console.log("Fetching genres from Supabase...");
  const { data: genres, error: gError } = await supabase.from('genres').select('*');
  if (gError || !genres) {
    console.error("Error fetching genres:", gError);
    process.exit(1);
  }

  const genreMap = {};
  for (const g of genres) {
    genreMap[g.slug] = g.id;
  }
  console.log("Found genres:", Object.keys(genreMap));

  const songsToInsert = [
    // ----------------- ROCK -----------------
    {
      title: "วัดใจ",
      artist: "Silly Fools",
      aliases: ["wat jai", "watjai", "วัดจัย", "มีแค่ใจดวงเดียวดวงนี้", "เพลงวัดใจ"],
      release_year: 2004,
      genre_id: genreMap["rock"],
      era: "2000s",
      audio_url: "/audio/uploads/demo-1.mp3",
      hook_start_sec: 68,
      hook_end_sec: 94,
      duration_sec: 260,
      lyrics_intro: "แม้ทั้งชีวิตพังทลาย แต่ว่าใจดวงนี้ไม่เคยสลาย",
      lyrics_chorus: "มีแค่ใจดวงเดียวดวงนี้ จะทุ่มเทให้ถึงที่สุด จะล้มกี่ครั้งก็ไม่เคยหยุด จะไปให้สุดขอบฟ้า",
    },
    {
      title: "จิ๊จ๊ะ",
      artist: "Silly Fools",
      aliases: ["ji ja", "ji jah", "อย่ามาทำจิ๊จ๊ะ", "silly fools จิ๊จ๊ะ"],
      release_year: 2002,
      genre_id: genreMap["rock"],
      era: "2000s",
      audio_url: "/audio/uploads/silly-fools-jija.mp3",
      hook_start_sec: 55,
      hook_end_sec: 85,
      duration_sec: 250,
      lyrics_intro: "ทำไมต้องมองอย่างนั้น ทำไมต้องทำหน้าเฉย",
      lyrics_chorus: "อย่ามาทำจิ๊จ๊ะ ให้มันมากไปนัก เดี๋ยวจะโดนไม่ใช่น้อย",
    },
    {
      title: "แสงสุดท้าย",
      artist: "Bodyslam",
      aliases: ["saeng sud thai", "sang sood tai", "bodyslam แสงสุดท้าย", "เพลงแสงสุดท้าย"],
      release_year: 2010,
      genre_id: genreMap["rock"],
      era: "2010s",
      audio_url: "/audio/uploads/bodyslam-saeng-sud-thai.mp3",
      hook_start_sec: 75,
      hook_end_sec: 105,
      duration_sec: 280,
      lyrics_intro: "รอนแรมมานานข้างในใจคิดถึงบ้าน รอนานเพียงใดจะกลับไปหาเธอ",
      lyrics_chorus: "ในค่ำคืนที่ฟ้าท้าทายใจคนอยู่ ยิ้มสู้ไปก่อนแม้ว่ามองไม่เห็นทาง",
    },
    {
      title: "ยาพิษ",
      artist: "Bodyslam",
      aliases: ["ya pit", "ya phit", "bodyslam ยาพิษ", "คำพูดที่หวานหู"],
      release_year: 2007,
      genre_id: genreMap["rock"],
      era: "2000s",
      audio_url: "/audio/uploads/bodyslam-ya-pit.mp3",
      hook_start_sec: 80,
      hook_end_sec: 110,
      duration_sec: 260,
      lyrics_intro: "คำหวานที่เธอพร่ำบอก ที่แท้มันคือภาพลวงตา",
      lyrics_chorus: "เหมือนยาพิษที่เคลือบน้ำตาล ช่างหอมหวานและดูเย้ายวน",
    },
    {
      title: "ขอบคุณที่รักกัน",
      artist: "Potato",
      aliases: ["kob koon tee ruk gun", "ขอบคุนที่รักกัน", "เพลงขอบคุณที่รักกัน", "โปเตโต้"],
      release_year: 2006,
      genre_id: genreMap["rock"],
      era: "2000s",
      audio_url: "/audio/uploads/demo-3.mp3",
      hook_start_sec: 72,
      hook_end_sec: 98,
      duration_sec: 245,
      lyrics_intro: "เคยเกือบหมดหวัง และเคยเกือบถอดใจ",
      lyrics_chorus: "ขอบคุณที่รักกัน ขอบคุณทุกรอยยิ้มที่มีให้กัน ขอบคุณความรักที่เธอส่งมา",
    },
    {
      title: "ซมซาน",
      artist: "Loso",
      aliases: ["som san", "somsan", "โลโซ ซมซาน", "เสก โลโซ ซมซาน"],
      release_year: 1998,
      genre_id: genreMap["rock"],
      era: "90s",
      audio_url: "/audio/uploads/loso-somsan.mp3",
      hook_start_sec: 50,
      hook_end_sec: 80,
      duration_sec: 235,
      lyrics_intro: "เกิดมาไม่เคยเจอใครเหมือนเธอ ช่างดูเลิศเลองามผุดผ่อง",
      lyrics_chorus: "หากเธอเปรียบเป็นดอกไม้ ฉันก็เป็นดั่งแมลงบินตอม",
    },
    {
      title: "ใจสั่งมา",
      artist: "Loso",
      aliases: ["jai sung ma", "jai sung mah", "โลโซ ใจสั่งมา", "หากว่าเธอผ่านมาได้ยิน"],
      release_year: 1999,
      genre_id: genreMap["rock"],
      era: "90s",
      audio_url: "/audio/uploads/loso-jai-sung-ma.mp3",
      hook_start_sec: 62,
      hook_end_sec: 92,
      duration_sec: 220,
      lyrics_intro: "หากว่าเธอผ่านมาได้ยิน เพลงนี้ อยากให้รู้ว่ามี คนที่ห่วงใย",
      lyrics_chorus: "ก็ใจมันสั่งมา ให้รักเธอคนนี้ ก็ใจมันอยากมีเธอไว้ในใจตลอดกาล",
    },

    // ----------------- POP -----------------
    {
      title: "ซ่อนกลิ่น",
      artist: "Palmy",
      aliases: ["son klin", "sorn klin", "คงไว้ได้แค่กลิ่น", "ปาล์มมี่ ซ่อนกลิ่น", "เพลงซ่อนกลิ่น"],
      release_year: 2018,
      genre_id: genreMap["pop"],
      era: "2010s",
      audio_url: "/audio/uploads/demo-2.mp3",
      hook_start_sec: 65,
      hook_end_sec: 90,
      duration_sec: 250,
      lyrics_intro: "ลืมตาตื่นมาพร้อมหยาดน้ำตา กับความทรงจำที่ยังไม่จาง",
      lyrics_chorus: "คงไว้ได้แค่กลิ่นที่ไม่เคยเลือนลา ยังหอมดังวันเก่ายามเมื่อลมพัดมา",
    },
    {
      title: "Tick Tock",
      artist: "Palmy",
      aliases: ["ติ๊กต่อก", "tick tock palmy", "ปาล์มมี่ ติ๊กต่อก"],
      release_year: 2003,
      genre_id: genreMap["pop"],
      era: "2000s",
      audio_url: "/audio/uploads/palmy-tick-tock.mp3",
      hook_start_sec: 45,
      hook_end_sec: 75,
      duration_sec: 215,
      lyrics_intro: "เข็มนาฬิกาเดินไปช้าๆ หัวใจบอกว่าคิดถึงเธอ",
      lyrics_chorus: "Tick tock tick tock เมื่อไหร่จะพบกัน เวลาหมุนไปทุกวันหัวใจสั่นไหว",
    },
    {
      title: "คู่แท้",
      artist: "Bird Thongchai",
      aliases: ["koo tae", "เบิร์ด ธงไชย คู่แท้", "พี่เบิร์ด คู่แท้"],
      release_year: 2001,
      genre_id: genreMap["pop"],
      era: "2000s",
      audio_url: "/audio/uploads/bird-koo-tae.mp3",
      hook_start_sec: 60,
      hook_end_sec: 90,
      duration_sec: 240,
      lyrics_intro: "คนบางคนเกิดมาเพื่อรักกัน ไม่ว่าวันไหนก็ผูกพัน",
      lyrics_chorus: "อาจเป็นเธอคือคนนั้น ที่เกิดมาเพื่อเป็นคู่แท้ มีรักแท้ที่ไม่มีวันเปลี่ยนไป",
    },
    {
      title: "หมอกหรือควัน",
      artist: "Bird Thongchai",
      aliases: ["mok reu kwan", "หมอกหรือควัน เบิร์ด", "พี่เบิร์ด หมอกหรือควัน"],
      release_year: 1996,
      genre_id: genreMap["pop"],
      era: "90s",
      audio_url: "/audio/uploads/bird-mok-kwan.mp3",
      hook_start_sec: 55,
      hook_end_sec: 85,
      duration_sec: 220,
      lyrics_intro: "มองเห็นหมอกบางๆ ที่จางหายไปในสายลม",
      lyrics_chorus: "บอกได้ไหมว่ามันคือหมอกหรือควัน ที่ลอยมาบังตาฉันทำให้มองไม่เห็นเธอ",
    },

    // ----------------- T-POP -----------------
    {
      title: "สายตาหลอกกันไม่ได้",
      artist: "Ink Waruntorn",
      aliases: ["eyes don't lie", "สายตาหลอกกันไม่ได้ ink", "อิ้งค์ วรันธร สายตาหลอกกันไม่ได้"],
      release_year: 2021,
      genre_id: genreMap["t-pop"],
      era: "2020s",
      audio_url: "/audio/uploads/ink-eyes-dont-lie.mp3",
      hook_start_sec: 50,
      hook_end_sec: 80,
      duration_sec: 210,
      lyrics_intro: "เธอซ่อนความรู้สึกไว้อย่างไร แต่แววตามันฟ้องออกมา",
      lyrics_chorus: "สายตาหลอกกันไม่ได้หรอกนะ เธอกำลังคิดอะไรบอกมาตรงๆ ดีกว่า",
    },
    {
      title: "ดีใจด้วยนะ",
      artist: "Ink Waruntorn",
      aliases: ["glad", "ดีใจด้วยนะ ink", "อิ้งค์ ดีใจด้วยนะ"],
      release_year: 2019,
      genre_id: genreMap["t-pop"],
      era: "2010s",
      audio_url: "/audio/uploads/ink-glad.mp3",
      hook_start_sec: 58,
      hook_end_sec: 88,
      duration_sec: 230,
      lyrics_intro: "ยินดีที่เธอได้เจอคนที่ดีกว่า และพร้อมจะเดินเคียงข้างเธอ",
      lyrics_chorus: "ดีใจด้วยนะที่เธอมีความสุข แม้ในวันที่ตรงนั้นไม่มีฉันอีกต่อไป",
    },
    {
      title: "วาดไว้",
      artist: "Bowkylion",
      aliases: ["recall", "โบกี้ไลออน วาดไว้", "bowkylion วาดไว้", "ที่เธอเคยวาดไว้"],
      release_year: 2022,
      genre_id: genreMap["t-pop"],
      era: "2020s",
      audio_url: "/audio/uploads/bowkylion-recall.mp3",
      hook_start_sec: 64,
      hook_end_sec: 95,
      duration_sec: 250,
      lyrics_intro: "ภาพความฝันที่เราเคยสร้างร่วมกัน บัดนี้เหลือเพียงความทรงจำสีจาง",
      lyrics_chorus: "ที่เธอเคยวาดไว้ให้สวยงาม ในวันนี้ทำไมเหลือเพียงรอยน้ำตา",
    },
    {
      title: "บานปลาย",
      artist: "Bowkylion",
      aliases: ["best wishes", "โบกี้ไลออน บานปลาย", "เรื่องเล็กๆ ที่บานปลาย"],
      release_year: 2021,
      genre_id: genreMap["t-pop"],
      era: "2020s",
      audio_url: "/audio/uploads/bowkylion-ban-plai.mp3",
      hook_start_sec: 48,
      hook_end_sec: 78,
      duration_sec: 215,
      lyrics_intro: "เริ่มจากความรู้สึกเพียงนิดเดียว แต่ตอนนี้มันล้นเอ่อหัวใจ",
      lyrics_chorus: "ยิ่งพยายามห้ามใจ ยิ่งบานปลายไปทุกที ยิ่งคิดถึงเธอมากขึ้นทุกนาที",
    },

    // ----------------- INDIE-ALT -----------------
    {
      title: "เพื่อนเล่น ไม่เล่นเพื่อน",
      artist: "Tilly Birds",
      aliases: ["just being friendly", "เพื่อนเล่นไม่เล่นเพื่อน", "tilly birds เพื่อนเล่น"],
      release_year: 2021,
      genre_id: genreMap["indie-alt"],
      era: "2020s",
      audio_url: "/audio/uploads/tilly-birds-friends.mp3",
      hook_start_sec: 52,
      hook_end_sec: 82,
      duration_sec: 225,
      lyrics_intro: "เราคุยกันทุกวันเหมือนคนพิเศษ แต่เธอก็บอกว่าเป็นแค่เพื่อนกัน",
      lyrics_chorus: "ก็เพื่อนเล่น ไม่เล่นเพื่อน เข้าใจไหม อย่ามาทำให้หวั่นไหวแล้วจากไป",
    },
    {
      title: "ถ้าเราเจอกันอีก",
      artist: "Tilly Birds",
      aliases: ["until then", "ถ้าเราเจอกันอีก tilly birds", "หากวันหนึ่งเราได้เจอกัน"],
      release_year: 2021,
      genre_id: genreMap["indie-alt"],
      era: "2020s",
      audio_url: "/audio/uploads/tilly-birds-until-then.mp3",
      hook_start_sec: 70,
      hook_end_sec: 100,
      duration_sec: 270,
      lyrics_intro: "โลกใบนี้กว้างใหญ่เหลือเกิน เราแยกย้ายกันไปตามทางเดิน",
      lyrics_chorus: "ถ้าเราเจอกันอีกในสักวัน อยากถามว่าเธอยังจำฉันได้ไหม",
    },
    {
      title: "ฝนตกไหม",
      artist: "Three Man Down",
      aliases: ["three man down ฝนตกไหม", "fon tok mai", "แถวที่เธออยู่ฝนตกไหม"],
      release_year: 2019,
      genre_id: genreMap["indie-alt"],
      era: "2010s",
      audio_url: "/audio/uploads/three-man-down-rain.mp3",
      hook_start_sec: 62,
      hook_end_sec: 92,
      duration_sec: 240,
      lyrics_intro: "ท้องฟ้าครึ้มฝนเริ่มโปรยปราย ใจคนไกลคิดถึงเหลือเกิน",
      lyrics_chorus: "ฝนตกไหม ที่ตรงนั้นหนาวหรือเปล่า ห่มผ้าหนาๆ นะคนดี",
    },
    {
      title: "ถ้าเธอรักฉันจริง",
      artist: "Three Man Down",
      aliases: ["tha ter rak chan jing", "three man down ถ้าเธอรักฉันจริง", "หวังว่าเธอคงไม่โกหก"],
      release_year: 2020,
      genre_id: genreMap["indie-alt"],
      era: "2020s",
      audio_url: "/audio/uploads/three-man-down-true-love.mp3",
      hook_start_sec: 55,
      hook_end_sec: 85,
      duration_sec: 235,
      lyrics_intro: "คำว่ารักที่เธอพูดออกมา ช่างฟังดูหนักแน่นและจริงใจ",
      lyrics_chorus: "ถ้าเธอรักฉันจริง ได้โปรดอย่าทิ้งกันไปในวันที่มืดมน",
    },

    // ----------------- PHUA CHEEWIT -----------------
    {
      title: "ทะเลใจ",
      artist: "Carabao",
      aliases: ["ta lay jai", "คาราบาว ทะเลใจ", "แอ๊ด คาราบาว ทะเลใจ", "ทุกข์หรือสุขอยู่ที่ใจ"],
      release_year: 1996,
      genre_id: genreMap["phua-cheewit"],
      era: "90s",
      audio_url: "/audio/uploads/carabao-talay-jai.mp3",
      hook_start_sec: 65,
      hook_end_sec: 95,
      duration_sec: 260,
      lyrics_intro: "แม้ชีวิตต้องเผชิญกับคลื่นลมแรง จงเข้มแข็งและก้าวต่อไป",
      lyrics_chorus: "ทะเลใจกว้างใหญ่ดั่งสายน้ำ ทุกลมปราณมีความหมายที่ลึกซึ้ง",
    },
    {
      title: "วณิพก",
      artist: "Carabao",
      aliases: ["wanipok", "คาราบาว วณิพก", "วณิพกพเนจร", "วณิพกตาบอด"],
      release_year: 1996,
      genre_id: genreMap["phua-cheewit"],
      era: "90s",
      audio_url: "/audio/uploads/carabao-wanipok.mp3",
      hook_start_sec: 45,
      hook_end_sec: 75,
      duration_sec: 250,
      lyrics_intro: "เดินตามถนนหนทาง มีเสียงเพลงเป็นเพื่อนใจ",
      lyrics_chorus: "วณิพกพเนจร ร้องเพลงเพื่อแลกเศษเงินประทังชีวิต",
    },
    {
      title: "บัวลอย",
      artist: "Carabao",
      aliases: ["bua loy", "คาราบาว บัวลอย", "บัวลอยเจ้าเพื่อนยาก"],
      release_year: 1996,
      genre_id: genreMap["phua-cheewit"],
      era: "90s",
      audio_url: "/audio/uploads/carabao-bualoy.mp3",
      hook_start_sec: 50,
      hook_end_sec: 80,
      duration_sec: 270,
      lyrics_intro: "เรื่องเล่าขานตำนานเพื่อนรัก ที่ร่วมทุกข์ร่วมสุขกันมา",
      lyrics_chorus: "บัวลอยเจ้าเพื่อนยาก ทำไมจากข้าไปเร็วเหลือเกิน",
    },

    // ----------------- LUKTHUNG -----------------
    {
      title: "ดอกหญ้าในป่าปูน",
      artist: "Tai Orathai",
      aliases: ["dok ya nai pa poon", "ต่าย อรทัย ดอกหญ้าในป่าปูน", "ดอกหญ้าต่าย"],
      release_year: 2002,
      genre_id: genreMap["lukthung"],
      era: "2000s",
      audio_url: "/audio/uploads/tai-orathai-dok-ya.mp3",
      hook_start_sec: 58,
      hook_end_sec: 88,
      duration_sec: 245,
      lyrics_intro: "จากบ้านนามาสู้ชีวิตในเมืองใหญ่ ท่ามกลางตึกรามบ้านช่อง",
      lyrics_chorus: "ดั่งดอกหญ้าที่เบ่งบานในป่าปูน แม้ไร้คนเหลียวแลยังคงสู้อดทน",
    },
    {
      title: "โทรหาแหน่เด๊อ",
      artist: "Tai Orathai",
      aliases: ["tho ha nae der", "ต่าย อรทัย โทรหาแหน่เด๊อ", "โทรหาแนเด้อ"],
      release_year: 2003,
      genre_id: genreMap["lukthung"],
      era: "2000s",
      audio_url: "/audio/uploads/tai-orathai-tho-ha.mp3",
      hook_start_sec: 50,
      hook_end_sec: 80,
      duration_sec: 230,
      lyrics_intro: "อยู่ไกลกันคิดฮอดหลาย ยามแลงแลงใจลอยไปหา",
      lyrics_chorus: "โทรหาแหน่เด๊อ คนดี อย่าลืมคนทางนี้ที่คอยเธออยู่เสมอ",
    },
    {
      title: "ขอใจเธอแลกเบอร์โทร",
      artist: "Yinglee Srijumpol",
      aliases: ["yinglee", "หญิงลี ขอใจเธอแลกเบอร์โทร", "ขอใจแลกเบอร์โทร", "หญิงลี ศรีจุมพล"],
      release_year: 2012,
      genre_id: genreMap["lukthung"],
      era: "2010s",
      audio_url: "/audio/uploads/yinglee-kho-jai.mp3",
      hook_start_sec: 45,
      hook_end_sec: 75,
      duration_sec: 260,
      lyrics_intro: "แอบมองเธออยู่นาน อยากเข้าไปทักทาย",
      lyrics_chorus: "ท่านกำลังเข้าสู่บริการรับฝาก หัวใจ ลงทะเบียนฝากไว้ตัวและหัวใจ",
    },
  ];

  console.log(`Inserting ${songsToInsert.length} songs...`);
  // Check if any existing songs with matching title/artist exist to avoid duplicates
  for (const song of songsToInsert) {
    const { data: existing } = await supabase
      .from('songs')
      .select('id')
      .eq('title', song.title)
      .eq('artist', song.artist)
      .maybeSingle();

    if (existing) {
      console.log(`Song "${song.title}" - ${song.artist} already exists, updating...`);
      const { error: updateErr } = await supabase
        .from('songs')
        .update(song)
        .eq('id', existing.id);
      if (updateErr) {
        console.error(`Failed to update ${song.title}:`, updateErr);
      }
    } else {
      console.log(`Inserting "${song.title}" - ${song.artist}...`);
      const { error: insertErr } = await supabase
        .from('songs')
        .insert(song);
      if (insertErr) {
        console.error(`Failed to insert ${song.title}:`, insertErr);
      }
    }
  }

  const { count: finalCount } = await supabase.from('songs').select('*', { count: 'exact', head: true });
  console.log(`Seeding complete! Total songs in database: ${finalCount}`);
}

seed().catch(console.error);
