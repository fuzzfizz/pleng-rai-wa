import React from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowLeft, Shield, Lock, Eye, FileText, CheckCircle2 } from "lucide-react";
import { NavHeader } from "@/components/common/nav-header";

export const metadata: Metadata = {
  title: "นโยบายความเป็นส่วนตัว (Privacy Policy) - เพลงไรวะ?",
  description:
    "นโยบายความเป็นส่วนตัวและการคุ้มครองข้อมูลส่วนบุคคลสำหรับผู้ใช้งานเกมเพลงไรวะ (Pleng-Rai-Wa)",
};

export default function PrivacyPolicyPage(): React.JSX.Element {
  return (
    <div className="min-h-screen bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 flex flex-col font-sans transition-colors duration-200">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-amber-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] rounded-full bg-orange-500/10 blur-[120px]" />
      </div>

      <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col">
        {/* Navigation Header */}
        <NavHeader />

        <main className="py-8 sm:py-12 flex-1">
          {/* Breadcrumb / Back button */}
          <div className="mb-6">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-stone-600 dark:text-stone-400 hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับหน้าแรก</span>
            </Link>
          </div>

          {/* Page Header */}
          <div className="border-b border-stone-200 dark:border-stone-800 pb-8 mb-8">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shadow-sm">
                <Shield className="w-5 h-5 sm:w-6 sm:h-6" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900 dark:text-stone-100">
                  นโยบายความเป็นส่วนตัว (Privacy Policy)
                </h1>
                <p className="text-xs sm:text-sm text-stone-500 dark:text-stone-400 mt-0.5">
                  เกมทายเพลง เพลงไรวะ? (Pleng-Rai-Wa) • อัปเดตล่าสุด: 15 ตุลาคม 2026
                </p>
              </div>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-300 leading-relaxed mt-4">
              เกมเพลงไรวะ? (Pleng-Rai-Wa) ให้ความสำคัญกับการคุ้มครองข้อมูลส่วนบุคคลของท่านเป็นอันดับแรก เอกสารฉบับนี้อธิบายถึงนโยบาย วิธีการจัดเก็บ และการนำข้อมูลไปใช้งานเมื่อท่านเข้าใช้งานเว็บไซต์และบริการของเรา
            </p>
          </div>

          {/* Content Sections */}
          <div className="space-y-8 text-sm text-stone-700 dark:text-stone-300 leading-relaxed">
            {/* 1. ข้อมูลที่เราจัดเก็บ */}
            <section className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-stone-900 dark:text-stone-100">
                <FileText className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2>1. ข้อมูลที่เราจัดเก็บ (Information We Collect)</h2>
              </div>
              <p>เราจัดเก็บข้อมูลเฉพาะเท่าที่จำเป็นต่อการให้บริการเกมทายเพลงเท่านั้น ได้แก่:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-600 dark:text-stone-400">
                <li>
                  <strong className="text-stone-900 dark:text-stone-200">ข้อมูลบัญชีผู้ใช้:</strong> ชื่อที่แสดง (Display Name), รูปภาพโปรไฟล์/อวาตาร์ (Avatar), และที่อยู่อีเมล (Email Address) จากการเข้าสู่ระบบผ่าน Google OAuth หรือการสมัครสมาชิก
                </li>
                <li>
                  <strong className="text-stone-900 dark:text-stone-200">ข้อมูลการเล่นเกม:</strong> คะแนนสะสม (Score), สถิติการตอบถูก, และเพลย์ลิสต์เพลงที่ท่านสร้างขึ้นในระบบ
                </li>
                <li>
                  <strong className="text-stone-900 dark:text-stone-200">ข้อมูลเซสชันชั่วคราว:</strong> รหัสห้องเกม (Room Code) และสถานะการเชื่อมต่อแบบเรียลไทม์เพื่อจับคู่แข่งขันกับผู้เล่นอื่น
                </li>
              </ul>
            </section>

            {/* 2. วัตถุประสงค์ในการใช้ข้อมูล */}
            <section className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-stone-900 dark:text-stone-100">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <h2>2. วัตถุประสงค์ในการใช้ข้อมูล (Purpose of Use)</h2>
              </div>
              <p>เรานำข้อมูลของท่านไปใช้เพื่อวัตถุประสงค์ดังต่อไปนี้เท่านั้น:</p>
              <ul className="list-disc list-inside space-y-1.5 pl-2 text-stone-600 dark:text-stone-400">
                <li>เพื่อยืนยันตัวตนและรักษาความปลอดภัยของบัญชีผู้ใช้งาน</li>
                <li>เพื่อแสดงชื่อ คะแนน และอันดับในห้องแข่งขันเกมทายเพลงแบบเรียลไทม์</li>
                <li>เพื่อบันทึกและจัดการเพลย์ลิสต์เพลงส่วนตัวของท่านสำหรับนำไปเปิดเล่นในห้องเกม</li>
                <li>เพื่อปรับปรุงประสิทธิภาพ ประสบการณ์การใช้งาน และแก้ไขปัญหาทางเทคนิคของระบบ</li>
              </ul>
            </section>

            {/* 3. การเชื่อมต่อกับ Google OAuth */}
            <section className="p-6 rounded-3xl bg-amber-500/5 border border-amber-500/20 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-amber-900 dark:text-amber-200">
                <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2>3. นโยบายการใช้ข้อมูล Google OAuth (Google User Data)</h2>
              </div>
              <p>
                เมื่อท่านเลือกเข้าสู่ระบบด้วย Google แอปพลิเคชันของเราจะขอเข้าถึงข้อมูลโปรไฟล์พื้นฐานที่เปิดเผยต่อสาธารณะ ได้แก่:
              </p>
              <ul className="list-disc list-inside space-y-1 pl-2 text-stone-600 dark:text-stone-300">
                <li>ชื่อและรูปภาพโปรไฟล์ (เพื่อนำมาตั้งเป็นชื่อและรูปตัวแทนในเกม)</li>
                <li>ที่อยู่อีเมล (เพื่อใช้เป็นตัวระบุบัญชีผู้ใช้ที่ไม่ซ้ำกัน)</li>
              </ul>
              <p className="text-xs text-stone-500 dark:text-stone-400 pt-1">
                เราไม่มีการร้องขอสิทธิ์หรือเข้าถึงข้อมูลส่วนตัวอื่นๆ เช่น Google Drive, Gmail หรือ Google Calendar ของท่านเด็ดขาด และการใช้ข้อมูลเป็นไปตามข้อกำหนดของ{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline text-amber-700 dark:text-amber-400 hover:text-amber-600 font-semibold"
                >
                  Google API Services User Data Policy
                </a>
              </p>
            </section>

            {/* 4. การรักษาความปลอดภัยและการไม่เปิดเผยข้อมูล */}
            <section className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-stone-900 dark:text-stone-100">
                <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2>4. การรักษาความปลอดภัยของข้อมูล (Data Protection & Security)</h2>
              </div>
              <p>
                เราไม่มีนโยบายการขาย แลกเปลี่ยน หรือเปิดเผยข้อมูลส่วนบุคคลของผู้ใช้ให้แก่บุคคลภายนอกหรือบริษัทโฆษณาใดๆ ทั้งสิ้น ข้อมูลทั้งหมดถูกจัดเก็บและประมวลผลอย่างปลอดภัยผ่านฐานข้อมูล Supabase ที่ได้มาตรฐานความปลอดภัยระดับสากล และมีการเข้ารหัสการส่งข้อมูลผ่าน HTTPS (SSL/TLS) ตลอดเวลา
              </p>
            </section>

            {/* 5. สิทธิของผู้ใช้งานและการลบข้อมูล */}
            <section className="p-6 rounded-3xl bg-white dark:bg-stone-900 border border-stone-200/80 dark:border-stone-800/80 shadow-sm space-y-3">
              <div className="flex items-center gap-2.5 text-base font-bold text-stone-900 dark:text-stone-100">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h2>5. สิทธิของผู้ใช้และการลบข้อมูล (User Rights & Deletion)</h2>
              </div>
              <p>
                ท่านมีสิทธิ์ในการเข้าถึง แก้ไขชื่อและอวาตาร์ หรือขอลบบัญชีผู้ใช้และประวัติการเล่นทั้งหมดของท่านออกจากระบบได้ตลอดเวลา โดยสามารถดำเนินการผ่านเมนูจัดการโปรไฟล์ในแอป หรือติดต่อทีมงานผู้พัฒนา
              </p>
            </section>
          </div>

          {/* Footer Back Home button */}
          <div className="mt-12 text-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-sm shadow-md transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>กลับสู่หน้าแรก เพลงไรวะ?</span>
            </Link>
          </div>
        </main>

        {/* Page Footer */}
        <footer className="w-full py-6 border-t border-stone-200 dark:border-stone-800 text-xs text-stone-500 flex flex-wrap items-center justify-between gap-2 mt-auto">
          <p>© 2026 เพลงไรวะ? (Pleng-Rai-Wa) • All rights reserved.</p>
          <Link
            href="/"
            className="hover:text-amber-600 dark:hover:text-amber-400 transition-colors"
          >
            หน้าแรก
          </Link>
        </footer>
      </div>
    </div>
  );
}
