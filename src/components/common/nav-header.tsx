"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Navigation Header
// Shared Navbar with Logo, Navigation Links, Theme Toggle, Auth State & Modals
// Styled with Vinyl Cafe & Warm Lo-Fi Aesthetic
// ==========================================

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogIn,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Disc3,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import { ProfileModal } from "@/components/auth/profile-modal";
import { ThemeToggle } from "@/components/common/theme-toggle";
import { soundEffects } from "@/lib/sound-effects";

export interface NavHeaderProps {
  className?: string;
  showNavigationLinks?: boolean;
}

export function NavHeader({
  className = "",
  showNavigationLinks = true,
}: NavHeaderProps): React.JSX.Element {
  const pathname = usePathname();
  const { user, profile, isLoading, signOut } = useAuth();

  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState<"signin" | "signup">("signin");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  // Close user dropdown when clicking outside
  useEffect(() => {
    if (!isUserMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isUserMenuOpen]);

  const navLinks: { label: string; href: string; icon?: React.ElementType }[] = [
    { label: "หน้าแรก", href: "/" },
    { label: "ซ้อมเดี่ยว", href: "/play/solo" },
  ];

  const handleOpenAuth = (tab: "signin" | "signup" = "signin") => {
    try {
      soundEffects.click();
    } catch {}
    setAuthModalTab(tab);
    setIsAuthModalOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleOpenProfile = () => {
    try {
      soundEffects.click();
    } catch {}
    setIsUserMenuOpen(false);
    setIsProfileModalOpen(true);
    setIsMobileNavOpen(false);
  };

  const handleSignOut = async () => {
    try {
      soundEffects.click();
    } catch {}
    setIsUserMenuOpen(false);
    setIsMobileNavOpen(false);
    await signOut();
  };

  return (
    <>
      <header
        className={`w-full flex items-center justify-between z-20 transition-colors duration-200 py-3 sm:py-3.5 lg:py-5 lg:px-2 ${className}`}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-3 group cursor-pointer"
          onClick={() => {
            try {
              soundEffects.click();
            } catch {}
          }}
        >
          <div className="w-11 h-11 sm:w-12 sm:h-12 lg:w-14 lg:h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-amber-500 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/20 group-hover:scale-105 transition-transform">
            <Disc3 className="w-6 h-6 lg:w-7.5 lg:h-7.5 text-stone-950 animate-[spin_8s_linear_infinite]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100 font-sans group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                เพลงไรวะ?
              </span>
            </div>
            <p className="text-[11px] sm:text-xs lg:text-sm text-stone-500 dark:text-stone-400 font-sans tracking-wide">
              Vinyl & Music Quiz
            </p>
          </div>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        {showNavigationLinks && (
          <nav className="hidden md:flex items-center gap-2 bg-stone-100/90 dark:bg-stone-900/80 border border-stone-200 dark:border-stone-800/80 px-3.5 py-1.5 lg:px-5 lg:py-2 rounded-full backdrop-blur-md shadow-sm">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-2 text-xs sm:text-sm lg:text-base font-semibold px-3.5 py-1.5 lg:px-5 lg:py-2.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 font-bold"
                      : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-200 hover:bg-stone-200/50 dark:hover:bg-stone-800/50"
                  }`}
                  onClick={() => {
                    try {
                      soundEffects.click();
                    } catch {}
                  }}
                >
                  {Icon && <Icon className="w-4 h-4 lg:w-4.5 lg:h-4.5" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Auth Area & Theme Toggle */}
        <div className="flex items-center gap-2.5 sm:gap-3 lg:gap-3.5">
          {/* Theme Toggle Button */}
          <ThemeToggle />

          {isLoading ? (
            // Loading Skeleton
            <div className="h-9 sm:h-10 lg:h-12 w-28 lg:w-44 bg-stone-200 dark:bg-stone-800/60 border border-stone-300 dark:border-stone-700/40 rounded-full animate-pulse" />
          ) : user && profile ? (
            // Authenticated User Pill
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => {
                  try {
                    soundEffects.click();
                  } catch {}
                  setIsUserMenuOpen((prev) => !prev);
                }}
                className="flex items-center gap-2.5 py-2 lg:py-2.5 px-3.5 lg:px-5 text-xs sm:text-sm lg:text-base rounded-full bg-stone-100 dark:bg-stone-900/80 hover:bg-stone-200 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                aria-expanded={isUserMenuOpen}
              >
                <span className="w-7 h-7 sm:w-8 sm:h-8 lg:w-9.5 lg:h-9.5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-sm sm:text-base lg:text-lg">
                  {profile.avatar || "🦊"}
                </span>
                <span className="font-semibold text-stone-800 dark:text-stone-200 max-w-[110px] sm:max-w-[140px] lg:max-w-[200px] truncate">
                  {profile.displayName || "นักฟังเพลง"}
                </span>
                <ChevronDown
                  className={`w-4 h-4 lg:w-5 lg:h-5 text-stone-500 dark:text-stone-400 transition-transform ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 sm:w-64 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-2 shadow-xl backdrop-blur-xl z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-stone-200 dark:border-stone-800/80">
                    <p className="text-xs sm:text-sm font-semibold text-stone-900 dark:text-white truncate flex items-center gap-1.5">
                      <span>{profile.avatar}</span>
                      <span>{profile.displayName}</span>
                    </p>
                    <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs sm:text-sm text-stone-700 dark:text-stone-300 hover:text-stone-900 dark:hover:text-white hover:bg-stone-100 dark:hover:bg-stone-800/70 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <User className="w-4 h-4 text-amber-500" />
                      <span>จัดการโปรไฟล์</span>
                    </button>
                  </div>

                  <div className="pt-1 border-t border-stone-200 dark:border-stone-800/80">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs sm:text-sm text-rose-500 hover:text-rose-600 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>ออกจากระบบ</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Guest User: Sign In / Sign Up Button
            <button
              type="button"
              onClick={() => handleOpenAuth("signin")}
              className="flex items-center gap-2 px-4 py-2 sm:px-4.5 sm:py-2.5 lg:px-6 lg:py-3.5 text-xs sm:text-sm lg:text-base font-bold rounded-full bg-white dark:bg-stone-900/90 hover:bg-stone-100 dark:hover:bg-stone-800 border border-stone-200 dark:border-stone-800 text-stone-800 dark:text-stone-200 hover:text-amber-600 dark:hover:text-amber-400 transition-all shadow-sm cursor-pointer active:scale-95 min-h-[44px] lg:min-h-[52px]"
            >
              <LogIn className="w-4 h-4 lg:w-5 lg:h-5 text-amber-500" />
              <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          {showNavigationLinks && (
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl bg-stone-100 dark:bg-stone-900 border border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-white cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="เมนู"
            >
              {isMobileNavOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Menu className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </header>

      {/* Mobile Navigation Drawer */}
      {showNavigationLinks && isMobileNavOpen && (
        <div className="md:hidden w-full bg-white/95 dark:bg-stone-900/95 border border-stone-200 dark:border-stone-800 rounded-2xl p-3 my-2 z-20 backdrop-blur-xl shadow-lg animate-in fade-in slide-in-from-top-1">
          <nav className="flex flex-col gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMobileNavOpen(false)}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                    isActive
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 font-semibold"
                      : "text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-900 dark:hover:text-white"
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      )}

      {/* Render Authentication & Profile Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTab={authModalTab}
        onSuccess={() => {
          setIsAuthModalOpen(false);
        }}
      />

      <ProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </>
  );
}
