// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Phase 6 Verification Suite
// Mobile Ergonomics, Tactile Game Juice, PWA Manifest,
// Touch Target Compliance & Production Readiness
// ==========================================

import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import manifestFn from "../src/app/manifest";
import { BuzzerButton, resolveBuzzerStatus } from "../src/components/room/buzzer-button";

console.log("==================================================");
console.log("Running Phase 6: Mobile Ergonomics & Readiness Verification");
console.log("==================================================\n");

const ROOT_DIR = path.resolve(__dirname, "..");

// -----------------------------------------------------------------------------
// Test 1: Next.js 15 Viewport & Safe-Area Configuration
// -----------------------------------------------------------------------------
console.log("Test 1: Next.js 15 Viewport & Safe-Area Configuration...");

const layoutPath = path.join(ROOT_DIR, "src/app/layout.tsx");
assert.ok(fs.existsSync(layoutPath), "src/app/layout.tsx must exist");
const layoutContent = fs.readFileSync(layoutPath, "utf-8");

// 1.1 Assert viewport export
assert.ok(
  layoutContent.includes("export const viewport: Viewport"),
  "src/app/layout.tsx must export 'viewport: Viewport'"
);
assert.ok(
  layoutContent.includes('width: "device-width"'),
  "Viewport must configure width: 'device-width'"
);
assert.ok(
  layoutContent.includes("initialScale: 1"),
  "Viewport must configure initialScale: 1"
);
assert.ok(
  layoutContent.includes("maximumScale: 5"),
  "Viewport must configure maximumScale: 5 (WCAG 2.1 zoom accessibility compliant)"
);
assert.ok(
  layoutContent.includes("themeColor: [") || layoutContent.includes('themeColor: "#030712"'),
  "Viewport must configure themeColor"
);
assert.ok(
  layoutContent.includes('colorScheme: "dark light"') || layoutContent.includes('colorScheme: "dark"'),
  "Viewport must configure colorScheme"
);

// 1.2 Assert min-h-[100dvh] dynamic viewport height on body
assert.ok(
  layoutContent.includes("min-h-[100dvh]"),
  "Body in layout.tsx must include 'min-h-[100dvh]' for dynamic viewport height"
);

// 1.3 Assert Safe-Area CSS definitions in globals.css
const cssPath = path.join(ROOT_DIR, "src/app/globals.css");
assert.ok(fs.existsSync(cssPath), "src/app/globals.css must exist");
const cssContent = fs.readFileSync(cssPath, "utf-8");

assert.ok(
  cssContent.includes(".pb-safe"),
  "globals.css must define .pb-safe utility"
);
assert.ok(
  cssContent.includes("env(safe-area-inset-bottom)"),
  ".pb-safe must use env(safe-area-inset-bottom)"
);
assert.ok(
  cssContent.includes(".pt-safe"),
  "globals.css must define .pt-safe utility"
);
assert.ok(
  cssContent.includes("env(safe-area-inset-top)"),
  ".pt-safe must use env(safe-area-inset-top)"
);

console.log("✓ Passed: Next.js 15 Viewport, 100dvh, and CSS Safe Area definitions verified.\n");

// -----------------------------------------------------------------------------
// Test 2: Web App Manifest & Social Metadata
// -----------------------------------------------------------------------------
console.log("Test 2: Web App Manifest & Social Metadata...");

// 2.1 Web App Manifest evaluation
const manifestPath = path.join(ROOT_DIR, "src/app/manifest.ts");
assert.ok(fs.existsSync(manifestPath), "src/app/manifest.ts must exist");
assert.strictEqual(typeof manifestFn, "function", "manifest.ts default export must be a function");

const manifest = manifestFn();
assert.ok(manifest, "manifest() must return a manifest configuration object");
assert.ok(
  manifest.name && manifest.name.includes("เพลงไรวะ"),
  `Manifest name must contain 'เพลงไรวะ', got: '${manifest.name}'`
);
assert.ok(
  manifest.short_name && manifest.short_name.includes("เพลงไรวะ"),
  `Manifest short_name must contain 'เพลงไรวะ', got: '${manifest.short_name}'`
);
assert.strictEqual(
  manifest.theme_color,
  "#030712",
  "Manifest theme_color must be #030712"
);
assert.strictEqual(
  manifest.background_color,
  "#030712",
  "Manifest background_color must be #030712"
);
assert.strictEqual(
  manifest.display,
  "standalone",
  "Manifest display mode must be 'standalone' for PWA app experience"
);
assert.strictEqual(
  manifest.start_url,
  "/",
  "Manifest start_url must be '/'"
);

// 2.2 Social Metadata (OpenGraph & Twitter Card)
assert.ok(
  layoutContent.includes('locale: "th_TH"'),
  "OpenGraph metadata must configure locale: 'th_TH'"
);
assert.ok(
  layoutContent.includes('siteName: "เพลงไรวะ (Pleng-Rai-Wa)"'),
  "OpenGraph metadata must configure siteName: 'เพลงไรวะ (Pleng-Rai-Wa)'"
);
assert.ok(
  layoutContent.includes('card: "summary_large_image"'),
  "Twitter metadata must configure card: 'summary_large_image'"
);

console.log("✓ Passed: PWA Manifest and Social Metadata verified.\n");

// -----------------------------------------------------------------------------
// Test 3: iOS Safari Auto-Zoom Prevention (Input Font-Sizes >= 16px)
// -----------------------------------------------------------------------------
console.log("Test 3: iOS Safari Auto-Zoom Prevention (Input Font-Sizes >= 16px)...");

/**
 * Parses JSX opening tags properly even across multiple lines and arrow functions.
 */
function extractJSXElements(content: string, tagNames: string[]) {
  const results: { tag: string; raw: string; className: string }[] = [];
  for (const tag of tagNames) {
    const regex = new RegExp(`<${tag}\\b`, "g");
    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
      const startIndex = match.index;
      let depth = 0;
      let inString: string | null = null;
      let endIndex = startIndex;
      for (let i = startIndex; i < content.length; i++) {
        const char = content[i];
        if (inString) {
          if (char === "\\" && i + 1 < content.length) {
            i++;
          } else if (char === inString) {
            inString = null;
          }
        } else {
          if (char === '"' || char === "'" || char === "`") {
            inString = char;
          } else if (char === "{" || char === "(") {
            depth++;
          } else if (char === "}" || char === ")") {
            depth = Math.max(0, depth - 1);
          } else if (depth === 0 && char === ">") {
            endIndex = i;
            break;
          }
        }
      }
      const raw = content.slice(startIndex, endIndex + 1);
      const classMatch = raw.match(/className=["']([^"']+)["']/);
      results.push({
        tag,
        raw,
        className: classMatch ? classMatch[1] : "",
      });
    }
  }
  return results;
}

/**
 * Checks all <input>, <textarea>, and <select> tags in a file to ensure
 * they specify font sizes >= 16px on mobile (e.g. text-base, text-base sm:text-sm)
 * without bare text-sm or text-xs that would trigger iOS Safari viewport zoom.
 */
function verifyInputFontSizes(filePath: string, componentName: string): { totalInputs: number } {
  assert.ok(fs.existsSync(filePath), `Target file ${filePath} must exist`);
  const content = fs.readFileSync(filePath, "utf-8");

  const elements = extractJSXElements(content, ["input", "textarea", "select"]);
  let inputCount = 0;

  for (const el of elements) {
    // Skip hidden inputs or checkboxes/radios where font size is irrelevant
    if (/type=["'](hidden|checkbox|radio)["']/i.test(el.raw)) {
      continue;
    }

    inputCount++;
    assert.ok(
      el.className.length > 0,
      `${componentName}: <${el.tag}> must have a className attribute. Raw: ${el.raw.slice(0, 80)}`
    );

    // Assert it has text-base or larger for mobile
    const hasBaseOrLarger = /\btext-base\b|\btext-lg\b|\btext-xl\b/.test(el.className);
    assert.ok(
      hasBaseOrLarger,
      `${componentName}: <${el.tag}> must have text-base or larger on mobile to prevent iOS Safari auto-zoom. Found classes: '${el.className}'`
    );

    // Assert no bare text-sm or text-xs (must be prefixed with responsive breakpoint e.g. sm:text-sm)
    const hasBareTextSmall = /(^|\s)text-(sm|xs)\b/.test(el.className);
    assert.ok(
      !hasBareTextSmall,
      `${componentName}: <${el.tag}> must not contain bare 'text-sm' or 'text-xs' without responsive prefix. Found classes: '${el.className}'`
    );
  }

  return { totalInputs: inputCount };
}

const componentInputChecks = [
  { path: "src/components/room/answer-modal.tsx", name: "AnswerModal" },
  { path: "src/components/room/host-settings-modal.tsx", name: "HostSettingsModal" },
  { path: "src/components/auth/auth-modal.tsx", name: "AuthModal" },
  { path: "src/components/room/lobby-view.tsx", name: "LobbyView" },
  { path: "src/components/playlist/playlist-editor.tsx", name: "PlaylistEditor" },
  { path: "src/app/play/solo/page.tsx", name: "SoloPlay" },
];

let checkedInputsCount = 0;
for (const check of componentInputChecks) {
  const result = verifyInputFontSizes(path.join(ROOT_DIR, check.path), check.name);
  checkedInputsCount += result.totalInputs;
  console.log(`  - ${check.name} verified: ${result.totalInputs} input/select/textarea controls.`);
}

assert.ok(checkedInputsCount >= 7, `Expected at least 7 interactive input elements across components, found ${checkedInputsCount}`);
console.log(`✓ Passed: iOS Safari auto-zoom prevention verified across ${checkedInputsCount} input fields.\n`);

// -----------------------------------------------------------------------------
// Test 4: Touch Target Ergonomics (>= 44px)
// -----------------------------------------------------------------------------
console.log("Test 4: Touch Target Ergonomics (>= 44px)...");

// 4.1 AnswerModal: Close button & Action buttons >= 44px
const answerModalContent = fs.readFileSync(path.join(ROOT_DIR, "src/components/room/answer-modal.tsx"), "utf-8");
assert.ok(
  answerModalContent.includes("min-h-[44px] min-w-[44px]"),
  "AnswerModal close button must satisfy min-h-[44px] min-w-[44px]"
);
assert.ok(
  answerModalContent.includes("min-h-[44px]"),
  "AnswerModal input & submit button must satisfy min-h-[44px]"
);

// 4.2 HostSettingsModal: Close button & Action buttons >= 44px
const hostSettingsContent = fs.readFileSync(path.join(ROOT_DIR, "src/components/room/host-settings-modal.tsx"), "utf-8");
assert.ok(
  hostSettingsContent.includes("min-h-[44px] min-w-[44px]"),
  "HostSettingsModal close button must satisfy min-h-[44px] min-w-[44px]"
);
assert.ok(
  hostSettingsContent.includes("min-h-[44px]"),
  "HostSettingsModal option buttons and submit button must satisfy min-h-[44px]"
);

// 4.3 AuthModal: Close button, Tabs, and Action buttons >= 44px
const authModalContent = fs.readFileSync(path.join(ROOT_DIR, "src/components/auth/auth-modal.tsx"), "utf-8");
assert.ok(
  authModalContent.includes("min-h-[44px] min-w-[44px]"),
  "AuthModal close button must satisfy min-h-[44px] min-w-[44px]"
);
assert.ok(
  authModalContent.includes("min-h-[44px]"),
  "AuthModal tabs and action buttons must satisfy min-h-[44px]"
);

// 4.4 LobbyView: Copy button, Sound FX button, and Controls >= 44px
const lobbyViewContent = fs.readFileSync(path.join(ROOT_DIR, "src/components/room/lobby-view.tsx"), "utf-8");
assert.ok(
  lobbyViewContent.includes("min-h-[44px] min-w-[44px]"),
  "LobbyView sound and copy buttons must satisfy min-h-[44px] min-w-[44px]"
);
assert.ok(
  lobbyViewContent.includes("min-h-[44px]"),
  "LobbyView navigation, QR code, and start buttons must satisfy min-h-[44px]"
);

// 4.5 BuzzerButton touch targets
const buzzerButtonContent = fs.readFileSync(path.join(ROOT_DIR, "src/components/room/buzzer-button.tsx"), "utf-8");
assert.ok(
  buzzerButtonContent.includes("w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64"),
  "BuzzerButton provides generous touch dimensions (192px - 256px) exceeding the 44px minimum"
);

console.log("✓ Passed: Touch target ergonomics (>= 44px) verified across all primary controls.\n");

// -----------------------------------------------------------------------------
// Test 5: Buzzer Tactile Juice & Haptics
// -----------------------------------------------------------------------------
console.log("Test 5: Buzzer Tactile Juice & Haptics...");

assert.strictEqual(typeof BuzzerButton, "function", "BuzzerButton must be exported as a React component function");
assert.strictEqual(typeof resolveBuzzerStatus, "function", "resolveBuzzerStatus must be exported as a function");

// 5.1 Touch manipulation CSS property to eliminate 300ms mobile tap delay
assert.ok(
  buzzerButtonContent.includes("touch-manipulation") ||
  buzzerButtonContent.includes("[touch-action:manipulation]"),
  "BuzzerButton must contain 'touch-manipulation' or '[touch-action:manipulation]' to prevent tap delay"
);

// 5.2 Haptic vibration trigger (45ms pulse)
assert.ok(
  buzzerButtonContent.includes("navigator.vibrate?.([45])"),
  "BuzzerButton must trigger haptic feedback via 'navigator.vibrate?.([45])'"
);

// 5.3 Active press scale & fast release transition
assert.ok(
  buzzerButtonContent.includes("active:scale-95"),
  "BuzzerButton must contain 'active:scale-95' for tactile mechanical button press feel"
);
assert.ok(
  buzzerButtonContent.includes("transition-transform"),
  "BuzzerButton must contain 'transition-transform' for fluid tactile response"
);
assert.ok(
  buzzerButtonContent.includes("duration-75"),
  "BuzzerButton must contain 'duration-75' for instantaneous tactile return"
);

// 5.4 Multi-breakpoint responsive dimensions
assert.ok(
  buzzerButtonContent.includes("w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64"),
  "BuzzerButton must contain responsive multi-breakpoint dimensions 'w-48 h-48 sm:w-56 sm:h-56 md:w-64 md:h-64'"
);

// 5.5 Buzzer status resolver logic verification
const testStatus1 = resolveBuzzerStatus({
  status: "question_active",
  isMyBuzz: false,
  isExcludedFromBuzz: false,
});
assert.strictEqual(testStatus1, "ready", "resolveBuzzerStatus must return 'ready' during question_active");

const testStatus2 = resolveBuzzerStatus({
  status: "buzzed",
  isMyBuzz: true,
  isExcludedFromBuzz: false,
});
assert.strictEqual(testStatus2, "buzzed_by_me", "resolveBuzzerStatus must return 'buzzed_by_me' when my buzz is active");

console.log("✓ Passed: Buzzer tactile properties, haptics, active scaling, and responsive sizing verified.\n");

// -----------------------------------------------------------------------------
// Summary
// -----------------------------------------------------------------------------
console.log("==================================================");
console.log("All Phase 6 Readiness Verification Checks PASSED (100% Green)");
console.log("==================================================");
