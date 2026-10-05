"use client";

// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Navigation Header
// Shared Navbar with Logo, Navigation Links, Auth State & Modals
// ==========================================

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Music,
  ListMusic,
  Play,
  Shield,
  LogIn,
  User,
  LogOut,
  ChevronDown,
  Menu,
  X,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { AuthModal } from "@/components/auth/auth-modal";
import { ProfileModal } from "@/components/auth/profile-modal";
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
  const { user, profile, isLoading, isGuest, signOut } = useAuth();

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

  const navLinks = [
    { label: "หน้าแรก", href: "/" },
    { label: "เพลย์ลิสต์", href: "/playlists" },
    { label: "ซ้อมเดี่ยว", href: "/play/solo" },
    { label: "Admin", href: "/admin", icon: Shield },
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
        className={`w-full flex items-center justify-between z-20 ${className}`}
      >
        {/* Brand Logo */}
        <Link
          href="/"
          className="flex items-center gap-2.5 group cursor-pointer"
          onClick={() => {
            try {
              soundEffects.click();
            } catch {}
          }}
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-pink-500 to-violet-600 flex items-center justify-center shadow-lg shadow-pink-500/20 group-hover:scale-105 transition-transform">
            <Music className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="text-xl font-bold tracking-tight text-white font-sans group-hover:text-pink-300 transition-colors">
                เพลงไรวะ?
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-sans tracking-wide">
              Pleng-Rai-Wa Music Quiz
            </p>
          </div>
        </Link>

        {/* Center Navigation Links (Desktop) */}
        {showNavigationLinks && (
          <nav className="hidden md:flex items-center gap-1.5 bg-slate-900/60 border border-slate-800/80 px-3 py-1.5 rounded-full backdrop-blur-md">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center gap-1.5 text-xs font-medium px-3.5 py-1.5 rounded-full transition-all cursor-pointer ${
                    isActive
                      ? "bg-pink-500/15 text-pink-400 border border-pink-500/30"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                  }`}
                  onClick={() => {
                    try {
                      soundEffects.click();
                    } catch {}
                  }}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        {/* Right Auth Area */}
        <div className="flex items-center gap-2.5">
          {isLoading ? (
            // Loading Skeleton
            <div className="h-9 w-28 bg-slate-800/60 border border-slate-700/40 rounded-full animate-pulse" />
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
                className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 transition-all cursor-pointer shadow-sm active:scale-[0.98]"
                aria-expanded={isUserMenuOpen}
              >
                <span className="w-7 h-7 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center text-sm">
                  {profile.avatar || "🦊"}
                </span>
                <span className="text-xs font-semibold text-slate-200 max-w-[110px] truncate">
                  {profile.displayName || "นักฟังเพลง"}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 text-slate-400 transition-transform ${
                    isUserMenuOpen ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* User Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl p-2 shadow-2xl backdrop-blur-xl z-30 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-2 border-b border-slate-800/80">
                    <p className="text-xs font-semibold text-white truncate flex items-center gap-1.5">
                      <span>{profile.avatar}</span>
                      <span>{profile.displayName}</span>
                    </p>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {user.email}
                    </p>
                  </div>

                  <div className="py-1">
                    <button
                      type="button"
                      onClick={handleOpenProfile}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <User className="w-4 h-4 text-pink-400" />
                      <span>จัดการโปรไฟล์</span>
                    </button>

                    <Link
                      href="/playlists?tab=my"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-slate-300 hover:text-white hover:bg-slate-800/70 rounded-xl transition-colors cursor-pointer text-left"
                    >
                      <ListMusic className="w-4 h-4 text-purple-400" />
                      <span>เพลย์ลิสต์ของฉัน</span>
                    </Link>
                  </div>

                  <div className="pt-1 border-t border-slate-800/80">
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 rounded-xl transition-colors cursor-pointer text-left"
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
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/80 hover:bg-slate-800 border border-slate-800 hover:border-pink-500/40 text-slate-200 hover:text-pink-300 text-xs font-semibold transition-all shadow-sm cursor-pointer active:scale-95"
            >
              <LogIn className="w-3.5 h-3.5 text-pink-400" />
              <span>เข้าสู่ระบบ / สมัครสมาชิก</span>
            </button>
          )}

          {/* Mobile Menu Toggle Button */}
          {showNavigationLinks && (
            <button
              type="button"
              onClick={() => setIsMobileNavOpen((prev) => !prev)}
              className="md:hidden p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white cursor-pointer"
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
        <div className="md:hidden w-full bg-slate-900/95 border border-slate-800 rounded-2xl p-3 my-2 z-20 backdrop-blur-xl animate-in fade-in slide-in-from-top-1">
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
                      ? "bg-pink-500/15 text-pink-400 font-semibold"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
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
