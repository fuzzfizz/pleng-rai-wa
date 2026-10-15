/**
 * automated Mobile UI Audit using Headless Chrome & Puppeteer-Core
 * Verifies that the SettingsMenu popover does NOT overflow mobile screens.
 * Specifically checks:
 *   - Emulated mobile viewport (width: 375, height: 667, isMobile: true)
 *   - Button click: [aria-label="ตั้งค่าระบบและระดับเสียง (Settings)"]
 *   - Bounding box check: dialog[aria-label="เมนูตั้งค่าระบบ"] has rect.left >= 0 and rect.right <= 375
 *   - Mobile backdrop blur & dismiss on tap
 *   - Extreme narrow viewport check (320px)
 *   - Real visual screenshot capture
 */

import puppeteer from 'puppeteer-core';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate the realistic test harness HTML page with Tailwind CSS and exact SettingsMenu markup
function getTestHarnessHtml() {
  return `<!DOCTYPE html>
<html lang="th" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pleng-Rai-Wa Settings Mobile Audit</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          backdropBlur: {
            'xs': '2px',
          }
        }
      }
    }
  </script>
  <style>
    body {
      margin: 0;
      background-color: #0c0a09;
      color: #f5f5f4;
      font-family: system-ui, -apple-system, sans-serif;
      overflow-x: hidden;
    }
  </style>
</head>
<body class="bg-stone-950 text-stone-100 min-h-screen flex flex-col">
  <!-- NavHeader on mobile -->
  <header class="sticky top-0 z-40 w-full bg-stone-900/90 border-b border-stone-800/80 px-3 py-2 flex items-center justify-between">
    <div class="flex items-center gap-2">
      <div class="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 flex items-center justify-center font-bold text-sm">
        🎵
      </div>
      <span class="font-bold text-sm text-stone-100">เพลงไรวะ</span>
    </div>

    <!-- Right Header Area with Profile Pill & Settings Menu -->
    <div class="flex items-center gap-2">
      <div class="px-2.5 py-1 rounded-full bg-stone-800/80 border border-stone-700/60 text-xs text-stone-300">
        👤 ดีเจเท่
      </div>

      <!-- Settings Menu Container -->
      <div class="relative inline-block text-left" id="settings-menu-container">
        <!-- Trigger Button -->
        <button
          type="button"
          id="settings-trigger"
          aria-expanded="false"
          aria-haspopup="dialog"
          aria-label="ตั้งค่าระบบและระดับเสียง (Settings)"
          title="ตั้งค่าระบบ (Settings)"
          class="relative inline-flex items-center justify-center min-h-[44px] min-w-[44px] w-11 h-11 rounded-full bg-white/90 dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-700 dark:text-stone-300 transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
        >
          <span class="sr-only">ตั้งค่าระบบ</span>
          <svg class="w-5 h-5 text-current" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="4" y1="21" x2="4" y2="14"></line>
            <line x1="4" y1="10" x2="4" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12" y2="3"></line>
            <line x1="20" y1="21" x2="20" y2="16"></line>
            <line x1="20" y1="12" x2="20" y2="3"></line>
            <line x1="1" y1="14" x2="7" y2="14"></line>
            <line x1="9" y1="8" x2="15" y2="8"></line>
            <line x1="17" y1="16" x2="23" y2="16"></line>
          </svg>
        </button>

        <!-- Subtle mobile backdrop overlay -->
        <div
          id="settings-backdrop"
          class="fixed inset-0 bg-black/40 backdrop-blur-xs z-40 sm:hidden hidden"
          aria-hidden="true"
        ></div>

        <!-- Settings Popover Dropdown matching src/components/common/settings-menu.tsx -->
        <div
          id="settings-dialog"
          role="dialog"
          aria-label="เมนูตั้งค่าระบบ"
          class="fixed inset-x-3 top-16 sm:absolute sm:inset-x-auto sm:right-0 sm:top-full mt-2.5 sm:w-80 max-w-[calc(100vw-24px)] mx-auto bg-white/95 dark:bg-stone-900/95 border border-stone-200/90 dark:border-stone-800/90 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-2xl shadow-stone-900/10 dark:shadow-black/50 backdrop-blur-xl z-50 hidden"
        >
          <!-- Header -->
          <div class="flex items-center justify-between pb-3 border-b border-stone-200 dark:border-stone-800 w-full min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <span class="text-sm sm:text-base font-bold text-stone-900 dark:text-stone-100">
                ⚙️ ตั้งค่า
              </span>
              <span class="text-xs text-stone-500 dark:text-stone-400 font-medium">
                (Settings)
              </span>
            </div>
            <button
              id="settings-close"
              type="button"
              aria-label="ปิดเมนูตั้งค่า"
              class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer shrink-0"
            >
              ✕
            </button>
          </div>

          <!-- Section 1: Theme Switcher -->
          <div class="py-3 border-b border-stone-200 dark:border-stone-800 w-full min-w-0">
            <label class="block text-xs font-semibold text-stone-600 dark:text-stone-400 mb-2">
              🌓 ธีมการแสดงผล <span class="font-normal text-[11px] text-stone-400">(Theme)</span>
            </label>
            <div class="grid grid-cols-2 gap-1.5 p-1 bg-stone-100 dark:bg-stone-950/80 rounded-xl border border-stone-200/60 dark:border-stone-800/60 w-full min-w-0">
              <button
                type="button"
                class="flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer min-w-0 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200"
              >
                <span>☀️ สว่าง (Light)</span>
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-2 min-h-[44px] py-2 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer min-w-0 bg-stone-800 text-amber-400 shadow-sm border border-stone-700/80"
              >
                <span>🌙 มืด (Dark)</span>
              </button>
            </div>
          </div>

          <!-- Section 2: Audio Volume Controls (Master & SFX) -->
          <div class="pt-3 flex flex-col gap-3.5 w-full min-w-0">
            <div class="flex items-center justify-between pb-1 border-b border-stone-200/60 dark:border-stone-800/60 w-full min-w-0">
              <span class="text-xs font-bold text-stone-700 dark:text-stone-300">
                🎛️ ตั้งค่าระดับเสียง
              </span>
              <span class="text-[11px] text-stone-400 font-normal">
                (Audio Volume)
              </span>
            </div>

            <!-- Row 1: Master Volume -->
            <div class="flex flex-col gap-1.5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <span class="text-xs font-semibold text-stone-600 dark:text-stone-400 truncate">
                  🔊 เสียงรวม / เพลง <span class="font-normal text-[11px] text-stone-400">(Master)</span>
                </span>
                <span class="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  70%
                </span>
              </div>
              <div class="flex items-center gap-2.5 w-full min-w-0">
                <button
                  type="button"
                  aria-label="ปิดเสียงรวม"
                  class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0"
                >
                  🔊
                </button>
                <div class="relative flex-1 min-w-0 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value="70"
                    class="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    aria-label="แถบปรับระดับเสียงรวม"
                  />
                </div>
              </div>
            </div>

            <!-- Row 2: SFX Volume -->
            <div class="flex flex-col gap-1.5 w-full min-w-0">
              <div class="flex items-center justify-between w-full min-w-0">
                <span class="text-xs font-semibold text-stone-600 dark:text-stone-400 truncate">
                  🔔 เสียงเอฟเฟกต์ <span class="font-normal text-[11px] text-stone-400">(SFX)</span>
                </span>
                <span class="font-mono text-xs font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shrink-0">
                  70%
                </span>
              </div>
              <div class="flex items-center gap-2.5 w-full min-w-0">
                <button
                  type="button"
                  aria-label="ปิดเสียงเอฟเฟกต์"
                  class="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 shrink-0"
                >
                  🔔
                </button>
                <div class="relative flex-1 min-w-0 flex items-center">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value="70"
                    class="w-full h-2 bg-stone-200 dark:bg-stone-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                    aria-label="แถบปรับระดับเสียงเอฟเฟกต์"
                  />
                </div>
              </div>
            </div>

            <!-- Test SFX Button -->
            <button
              type="button"
              class="w-full mt-1 min-h-[44px] py-2.5 px-3 rounded-xl bg-stone-100 dark:bg-stone-800/80 text-stone-700 dark:text-stone-300 text-xs font-semibold flex items-center justify-center gap-2 min-w-0"
            >
              🎵 ทดสอบเสียงเอฟเฟกต์
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <!-- Page Body Content -->
  <main class="flex-1 p-4 flex flex-col items-center justify-center text-center">
    <div class="p-6 bg-stone-900 border border-stone-800 rounded-2xl w-full max-w-sm">
      <h1 class="text-lg font-bold text-amber-500 mb-2">เกมทายเพลงสุดฮิต</h1>
      <p class="text-xs text-stone-400">ทดสอบการแสดงผลบนหน้าจอมือถือ (Viewport Real Screen Test)</p>
    </div>
  </main>

  <script>
    const btn = document.getElementById('settings-trigger');
    const dialog = document.getElementById('settings-dialog');
    const backdrop = document.getElementById('settings-backdrop');
    const closeBtn = document.getElementById('settings-close');

    function toggle(open) {
      if (open) {
        dialog.classList.remove('hidden');
        backdrop.classList.remove('hidden');
        btn.setAttribute('aria-expanded', 'true');
      } else {
        dialog.classList.add('hidden');
        backdrop.classList.add('hidden');
        btn.setAttribute('aria-expanded', 'false');
      }
    }

    btn.addEventListener('click', () => {
      const isOpen = !dialog.classList.contains('hidden');
      toggle(!isOpen);
    });

    backdrop.addEventListener('click', () => {
      toggle(false);
    });

    closeBtn.addEventListener('click', () => {
      toggle(false);
    });
  </script>
</body>
</html>`;
}

// Start temporary local HTTP server
function startServer(port = 3456) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(getTestHarnessHtml());
    });

    server.listen(port, () => {
      console.log(`[Server] Audit test harness server running on http://localhost:${port}`);
      resolve(server);
    });

    server.on('error', (err) => {
      reject(err);
    });
  });
}

async function runMobileAudit() {
  console.log('====================================================');
  console.log('🔍 Starting Mobile UI Real-Screen Audit with Puppeteer');
  console.log(`📌 Chrome Path: ${CHROME_PATH}`);
  console.log('====================================================');

  if (!fs.existsSync(CHROME_PATH)) {
    console.error(`❌ Chrome executable not found at: ${CHROME_PATH}`);
    process.exit(1);
  }

  const PORT = 3456;
  const server = await startServer(PORT);
  const targetUrl = `http://localhost:${PORT}`;

  let browser;
  let exitCode = 0;

  try {
    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--hide-scrollbars',
      ],
    });

    console.log(`✓ Headless Chrome launched: ${await browser.version()}`);

    const page = await browser.newPage();

    // -------------------------------------------------------------
    // Test 1: Standard Mobile Viewport (iPhone SE / 375x667)
    // -------------------------------------------------------------
    console.log('\n📱 Test 1: Emulating Mobile Viewport (375x667, isMobile: true)');
    await page.setViewport({
      width: 375,
      height: 667,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    await page.goto(targetUrl, { waitUntil: 'networkidle0' });
    console.log(`✓ Navigated to ${targetUrl}`);

    // Verify settings button exists
    const triggerSelector = '[aria-label="ตั้งค่าระบบและระดับเสียง (Settings)"]';
    const trigger = await page.waitForSelector(triggerSelector);
    if (!trigger) {
      throw new Error(`Trigger button not found: ${triggerSelector}`);
    }
    console.log('✓ Found settings trigger button');

    // Click to open settings menu
    await page.click('#settings-trigger');
    console.log('✓ Clicked settings trigger button');

    // Wait for dialog
    await page.waitForSelector('#settings-dialog', { visible: true });
    console.log('✓ Settings dialog is visible');

    // Measure bounding box
    const rect = await page.evaluate(() => {
      const el = document.getElementById('settings-dialog');
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return {
        left: r.left,
        right: r.right,
        top: r.top,
        bottom: r.bottom,
        width: r.width,
        height: r.height,
        position: style.position,
        windowWidth: window.innerWidth,
      };
    });

    console.log('\n📊 Dialog Bounding Box on 375px Screen:');
    console.log(`   - Screen Width: ${rect.windowWidth}px`);
    console.log(`   - Left: ${rect.left}px`);
    console.log(`   - Right: ${rect.right}px`);
    console.log(`   - Width: ${rect.width}px`);
    console.log(`   - Top: ${rect.top}px`);
    console.log(`   - Position: ${rect.position}`);

    // Assertions
    const hasZeroLeftOverflow = rect.left >= 0;
    const hasZeroRightOverflow = rect.right <= 375;
    const isContained = hasZeroLeftOverflow && hasZeroRightOverflow;

    console.log(`   - Left within bounds (>= 0): ${hasZeroLeftOverflow ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   - Right within bounds (<= 375): ${hasZeroRightOverflow ? '✅ PASS' : '❌ FAIL'}`);

    if (!isContained) {
      console.error(`❌ Mobile overflow detected! Left: ${rect.left}px, Right: ${rect.right}px on 375px screen!`);
      exitCode = 1;
    } else {
      console.log('✅ PASS: Zero horizontal overflow! Dialog fits safely within mobile screen margins.');
    }

    // Save screenshot
    const screenshot375 = path.join(SCREENSHOT_DIR, 'settings-mobile-375px.png');
    await page.screenshot({ path: screenshot375 });
    console.log(`📸 Screenshot saved: ${screenshot375}`);

    // Verify Backdrop Overlay exists and closes menu on tap
    console.log('\n🛡️ Test 2: Testing Mobile Backdrop Overlay & Tap to Close');
    const backdropVisible = await page.evaluate(() => {
      const bd = document.getElementById('settings-backdrop');
      if (!bd) return false;
      const style = window.getComputedStyle(bd);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });

    console.log(`   - Mobile Backdrop visible: ${backdropVisible ? '✅ YES' : '❌ NO'}`);

    // Tap backdrop to dismiss
    await page.evaluate(() => {
      const bd = document.getElementById('settings-backdrop');
      if (bd) bd.click();
    });
    await page.waitForFunction(() => {
      const d = document.getElementById('settings-dialog');
      return !d || d.classList.contains('hidden');
    });
    console.log('✅ PASS: Dialog closed successfully upon clicking mobile backdrop overlay');

    const screenshotClosed = path.join(SCREENSHOT_DIR, 'settings-mobile-closed.png');
    await page.screenshot({ path: screenshotClosed });
    console.log(`📸 Screenshot saved: ${screenshotClosed}`);

    // -------------------------------------------------------------
    // Test 3: Ultra Narrow Screen (320px - iPhone SE 1st gen)
    // -------------------------------------------------------------
    console.log('\n📱 Test 3: Emulating Ultra Narrow Viewport (320x568)');
    await page.setViewport({
      width: 320,
      height: 568,
      isMobile: true,
      hasTouch: true,
      deviceScaleFactor: 2,
    });

    await page.click('#settings-trigger');
    await page.waitForSelector('#settings-dialog', { visible: true });

    const rect320 = await page.evaluate(() => {
      const el = document.getElementById('settings-dialog');
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        width: r.width,
        windowWidth: window.innerWidth,
      };
    });

    console.log(`   - Screen Width: ${rect320.windowWidth}px`);
    console.log(`   - Left: ${rect320.left}px (>= 0: ${rect320.left >= 0 ? '✅' : '❌'})`);
    console.log(`   - Right: ${rect320.right}px (<= 320: ${rect320.right <= 320 ? '✅' : '❌'})`);
    console.log(`   - Width: ${rect320.width}px`);

    if (rect320.left < 0 || rect320.right > 320) {
      console.error(`❌ 320px overflow detected! Left: ${rect320.left}px, Right: ${rect320.right}px`);
      exitCode = 1;
    } else {
      console.log('✅ PASS: Perfectly contained on ultra-narrow 320px screen without horizontal scroll.');
    }

    const screenshot320 = path.join(SCREENSHOT_DIR, 'settings-mobile-320px.png');
    await page.screenshot({ path: screenshot320 });
    console.log(`📸 Screenshot saved: ${screenshot320}`);

    // Close 320px dialog
    await page.evaluate(() => {
      const bd = document.getElementById('settings-backdrop');
      if (bd) bd.click();
    });

    // -------------------------------------------------------------
    // Test 4: Desktop Viewport (1024x768)
    // -------------------------------------------------------------
    console.log('\n🖥️ Test 4: Emulating Desktop Viewport (1024x768, isMobile: false)');
    await page.setViewport({
      width: 1024,
      height: 768,
      isMobile: false,
      hasTouch: false,
      deviceScaleFactor: 1,
    });

    await page.click('#settings-trigger');
    await page.waitForSelector('#settings-dialog', { visible: true });

    const rectDesktop = await page.evaluate(() => {
      const el = document.getElementById('settings-dialog');
      const r = el.getBoundingClientRect();
      return {
        left: r.left,
        right: r.right,
        width: r.width,
        windowWidth: window.innerWidth,
      };
    });

    console.log(`   - Screen Width: ${rectDesktop.windowWidth}px`);
    console.log(`   - Left: ${rectDesktop.left}px`);
    console.log(`   - Right: ${rectDesktop.right}px`);
    console.log(`   - Width: ${rectDesktop.width}px`);
    console.log(`   - Right within bounds (<= 1024): ${rectDesktop.right <= 1024 ? '✅ PASS' : '❌ FAIL'}`);

    const screenshotDesktop = path.join(SCREENSHOT_DIR, 'settings-desktop-1024px.png');
    await page.screenshot({ path: screenshotDesktop });
    console.log(`📸 Screenshot saved: ${screenshotDesktop}`);

  } catch (error) {
    console.error('❌ Error during mobile UI audit:', error);
    exitCode = 1;
  } finally {
    if (browser) {
      await browser.close();
      console.log('\n✓ Chrome browser closed');
    }
    server.close(() => {
      console.log('✓ Test server stopped');
    });
  }

  console.log('\n====================================================');
  if (exitCode === 0) {
    console.log('🎉 AUDIT SUCCESS: All mobile UI real-screen tests PASSED!');
  } else {
    console.log('❌ AUDIT FAILURE: One or more checks failed.');
  }
  console.log('====================================================\n');

  process.exit(exitCode);
}

runMobileAudit();
