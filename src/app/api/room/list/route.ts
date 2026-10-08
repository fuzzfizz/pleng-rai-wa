// ==========================================
// เพลงไรวะ (Pleng-Rai-Wa) - Active Rooms List API
// ==========================================

import { NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rooms = await RoomService.listActiveRooms();
    return NextResponse.json({
      success: true,
      rooms,
    });
  } catch (error) {
    console.error("[RoomList] Error fetching active rooms:", error);
    return NextResponse.json(
      { success: false, error: "เกิดข้อผิดพลาดในการโหลดรายการห้อง" },
      { status: 500 }
    );
  }
}
