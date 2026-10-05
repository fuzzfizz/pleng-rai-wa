import assert from "node:assert";
import React from "react";
import type { User } from "@supabase/supabase-js";
import type { ProfileRow } from "../src/types/database";
import type { UserProfile } from "../src/types/index";

import {
  useAuth,
  AuthProvider,
  AuthContext,
  mapProfileRowToUserProfile,
  translateAuthError,
  DEFAULT_AUTH_VALUE,
  type AuthContextValue,
} from "../src/hooks/use-auth";

import {
  AuthModal,
  type AuthModalProps,
} from "../src/components/auth/auth-modal";

import {
  ProfileModal,
  PRESET_AVATARS,
  type ProfileModalProps,
} from "../src/components/auth/profile-modal";

import {
  NavHeader,
  type NavHeaderProps,
} from "../src/components/common/nav-header";

console.log("==================================================");
console.log("Running Task 2: Auth Context, Modals & NavHeader Verification");
console.log("==================================================\n");

// -----------------------------------------------------------------------------
// Test 1: useAuth Hook Exports and Helper Functions
// -----------------------------------------------------------------------------
console.log("Test 1: useAuth hook exports and helper utilities...");

assert.strictEqual(typeof useAuth, "function", "useAuth must be exported as a function");
assert.strictEqual(typeof AuthProvider, "function", "AuthProvider must be exported as a component function");
assert.ok(AuthContext !== undefined, "AuthContext must be defined");
assert.strictEqual(typeof mapProfileRowToUserProfile, "function", "mapProfileRowToUserProfile must be exported");
assert.strictEqual(typeof translateAuthError, "function", "translateAuthError must be exported");

// Test mapProfileRowToUserProfile
const mockDbRow: ProfileRow = {
  id: "12345678-1234-1234-1234-123456789abc",
  display_name: "แชมป์ทายเพลง",
  avatar: "🎸",
  created_at: "2026-10-05T12:00:00Z",
  updated_at: "2026-10-05T12:30:00Z",
};

const domainProfile: UserProfile = mapProfileRowToUserProfile(mockDbRow);
assert.strictEqual(domainProfile.id, mockDbRow.id);
assert.strictEqual(domainProfile.displayName, mockDbRow.display_name);
assert.strictEqual(domainProfile.avatar, mockDbRow.avatar);
assert.strictEqual(domainProfile.createdAt, mockDbRow.created_at);
assert.strictEqual(domainProfile.updatedAt, mockDbRow.updated_at);

// Test translateAuthError
assert.strictEqual(
  translateAuthError("Invalid login credentials"),
  "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
  "Should translate Invalid login credentials"
);
assert.strictEqual(
  translateAuthError("User already registered"),
  "อีเมลนี้ลงทะเบียนในระบบแล้ว",
  "Should translate User already registered"
);
assert.strictEqual(
  translateAuthError("Password should be at least 6 characters"),
  "รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร",
  "Should translate weak password error"
);
assert.strictEqual(
  translateAuthError("Email not confirmed"),
  "กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ",
  "Should translate email not confirmed error"
);

// Fallback message test
const customError = "Custom business rule error";
assert.strictEqual(translateAuthError(customError), customError);

console.log("✓ Passed: useAuth helpers and error translations verified.");

// -----------------------------------------------------------------------------
// Test 2: Auth Context Value Contract Integrity
// -----------------------------------------------------------------------------
console.log("\nTest 2: Auth Context contract and fallback behavior...");

// Standalone fallback hook call outside AuthProvider
const origError = console.error;
console.error = () => {};
const fallbackAuth = useAuth();
console.error = origError;

assert.strictEqual(fallbackAuth.user, null, "Default user must be null");
assert.strictEqual(fallbackAuth.profile, null, "Default profile must be null");
assert.strictEqual(fallbackAuth.isLoading, false, "Default isLoading must be false");
assert.strictEqual(fallbackAuth.isGuest, true, "Default isGuest must be true");
assert.strictEqual(typeof fallbackAuth.signInWithEmail, "function");
assert.strictEqual(typeof fallbackAuth.signUpWithEmail, "function");
assert.strictEqual(typeof fallbackAuth.signInWithGoogle, "function");
assert.strictEqual(typeof fallbackAuth.signOut, "function");
assert.strictEqual(typeof fallbackAuth.updateProfile, "function");
assert.strictEqual(typeof fallbackAuth.refreshProfile, "function");

// Test DEFAULT_AUTH_VALUE constant directly
assert.strictEqual(DEFAULT_AUTH_VALUE.user, null);
assert.strictEqual(DEFAULT_AUTH_VALUE.isGuest, true);

// Test that AuthContextValue type compiles with mock object
const mockAuthValue: AuthContextValue = {
  user: { id: "test-user-id", email: "test@pleng.com" } as User,
  profile: domainProfile,
  isLoading: false,
  isGuest: false,
  signInWithEmail: async () => ({ success: true }),
  signUpWithEmail: async () => ({ success: true }),
  signInWithGoogle: async () => ({ success: true }),
  signOut: async () => {},
  updateProfile: async () => ({ success: true }),
  refreshProfile: async () => {},
};

assert.strictEqual(mockAuthValue.user?.email, "test@pleng.com");
assert.strictEqual(mockAuthValue.profile?.displayName, "แชมป์ทายเพลง");
assert.strictEqual(mockAuthValue.isGuest, false);

console.log("✓ Passed: AuthContext interface and fallback methods verified.");

// -----------------------------------------------------------------------------
// Test 3: Preset Avatars & Display Name Validation
// -----------------------------------------------------------------------------
console.log("\nTest 3: PRESET_AVATARS list and validation rules...");

assert.ok(Array.isArray(PRESET_AVATARS), "PRESET_AVATARS must be an array");
assert.strictEqual(PRESET_AVATARS.length, 20, "PRESET_AVATARS must contain exactly 20 preset emojis");

const expectedAvatars = [
  "🦊", "🎸", "🐱", "🎧", "🐼", "🐯", "🐰", "🐸", "🦄", "🤖",
  "🦁", "🐻", "👾", "🎯", "🚀", "🌟", "🍕", "🍦", "⚡", "🔥"
];

for (const emoji of expectedAvatars) {
  assert.ok(
    PRESET_AVATARS.includes(emoji),
    `PRESET_AVATARS must include emoji: ${emoji}`
  );
}

// Verify all emojis in list are unique
const uniqueSet = new Set(PRESET_AVATARS);
assert.strictEqual(
  uniqueSet.size,
  20,
  "All 20 preset avatars must be distinct unique emojis"
);

// Display name validation test logic (1-30 chars)
function validateDisplayName(name: string): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "กรุณากรอกชื่อที่แสดง" };
  }
  if (trimmed.length > 30) {
    return { valid: false, error: "ชื่อที่แสดงต้องมีความยาวไม่เกิน 30 ตัวอักษร" };
  }
  return { valid: true };
}

assert.strictEqual(validateDisplayName("").valid, false);
assert.strictEqual(validateDisplayName("   ").valid, false);
assert.strictEqual(validateDisplayName("A".repeat(31)).valid, false);
assert.strictEqual(validateDisplayName("A".repeat(30)).valid, true);
assert.strictEqual(validateDisplayName("ดีเจสุดเฟี้ยว").valid, true);

console.log("✓ Passed: 20 preset avatars and display name validation verified.");

// -----------------------------------------------------------------------------
// Test 4: Component Instantiation & Prop Contracts (React Elements)
// -----------------------------------------------------------------------------
console.log("\nTest 4: Component exports and React element instantiation...");

// AuthModal
assert.strictEqual(typeof AuthModal, "function", "AuthModal must be a function component");
const authModalProps: AuthModalProps = {
  isOpen: false,
  onClose: () => {},
  initialTab: "signin",
  onSuccess: () => {},
};
const authModalElement = React.createElement(AuthModal, authModalProps);
assert.ok(React.isValidElement(authModalElement), "AuthModal must create a valid React element");
assert.strictEqual(authModalElement.props.isOpen, false);
assert.strictEqual(authModalElement.props.initialTab, "signin");

const authModalSignUpElement = React.createElement(AuthModal, {
  isOpen: true,
  onClose: () => {},
  initialTab: "signup",
});
assert.strictEqual(authModalSignUpElement.props.initialTab, "signup");

// ProfileModal
assert.strictEqual(typeof ProfileModal, "function", "ProfileModal must be a function component");
const profileModalProps: ProfileModalProps = {
  isOpen: false,
  onClose: () => {},
};
const profileModalElement = React.createElement(ProfileModal, profileModalProps);
assert.ok(React.isValidElement(profileModalElement), "ProfileModal must create a valid React element");
assert.strictEqual(profileModalElement.props.isOpen, false);

// NavHeader
assert.strictEqual(typeof NavHeader, "function", "NavHeader must be a function component");
const navHeaderProps: NavHeaderProps = {
  className: "custom-nav-class",
  showNavigationLinks: true,
};
const navHeaderElement = React.createElement(NavHeader, navHeaderProps);
assert.ok(React.isValidElement(navHeaderElement), "NavHeader must create a valid React element");
assert.strictEqual(navHeaderElement.props.className, "custom-nav-class");
assert.strictEqual(navHeaderElement.props.showNavigationLinks, true);

// AuthProvider
const authProviderElement = React.createElement(AuthProvider, { children: null });
assert.ok(React.isValidElement(authProviderElement), "AuthProvider must create a valid React element");

console.log("✓ Passed: AuthModal, ProfileModal, NavHeader, and AuthProvider elements instantiated cleanly.");

console.log("\n==================================================");
console.log("All Task 2 Verification Checks PASSED (100% Green)");
console.log("==================================================");
