import { NextResponse } from "next/server";
import { RoomService } from "@/lib/services/room-service";

export async function POST(req: Request) {
  try {
    let hours = 24;
    try {
      const body = await req.json();
      if (body.hours && Number(body.hours) > 0) {
        hours = Number(body.hours);
      }
    } catch {}

    const result = await RoomService.cleanupStaleRooms(hours);
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to cleanup rooms",
      },
      { status: 500 }
    );
  }
}
