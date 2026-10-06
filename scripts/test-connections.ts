import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { S3Client, PutObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { GoogleGenAI } from "@google/genai";

// Parse .env.local manually
function loadEnv() {
  const envPath = path.resolve(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf-8");
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx !== -1) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function runTests() {
  console.log("==========================================");
  console.log("Testing Production Service Connections");
  console.log("==========================================\n");

  let allPassed = true;

  // 1. Test Supabase
  try {
    process.stdout.write("1. Testing Supabase connection & genres query... ");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from("genres").select("slug, name_th").limit(3);
    if (error) throw error;
    console.log(`✓ SUCCESS (Found ${data.length} genres: ${data.map(g => g.name_th).join(", ")})`);
  } catch (err: any) {
    allPassed = false;
    console.log(`✗ FAILED: ${err.message}`);
  }

  // 2. Test Cloudflare R2
  try {
    process.stdout.write("2. Testing Cloudflare R2 upload/check/delete... ");
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID!;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID!;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY!;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME!;

    const s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });

    const testKey = `test-connection-${Date.now()}.txt`;
    await s3.send(new PutObjectCommand({
      Bucket: bucketName,
      Key: testKey,
      Body: Buffer.from("hello pleng-rai-wa"),
      ContentType: "text/plain",
    }));

    await s3.send(new HeadObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));

    await s3.send(new DeleteObjectCommand({
      Bucket: bucketName,
      Key: testKey,
    }));

    console.log(`✓ SUCCESS (Bucket '${bucketName}' read/write verified)`);
  } catch (err: any) {
    allPassed = false;
    console.log(`✗ FAILED: ${err.message}`);
  }

  // 3. Test Google Gemini API
  try {
    process.stdout.write("3. Testing Google Gemini API... ");
    const apiKey = process.env.GEMINI_API_KEY!;
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: "Reply with the word 'OK' only.",
    });
    console.log(`✓ SUCCESS (Response: ${res.text?.trim()})`);
  } catch (err: any) {
    allPassed = false;
    console.log(`✗ FAILED: ${err.message}`);
  }

  console.log("\n==========================================");
  if (allPassed) {
    console.log("ALL SERVICES CONNECTED & VERIFIED 100% GREEN!");
  } else {
    console.log("SOME SERVICES ENCOUNTERED ISSUES. CHECK LOGS ABOVE.");
  }
  console.log("==========================================");
}

runTests();
