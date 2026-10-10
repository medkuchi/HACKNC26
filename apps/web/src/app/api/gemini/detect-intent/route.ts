import { NextRequest, NextResponse } from "next/server";
import { detectSpendingIntent } from "@/lib/gemini/intentDetection";

export async function POST(req: NextRequest) {
  const { message } = await req.json();

  if (!message || typeof message !== "string") {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const intent = await detectSpendingIntent(message);
  return NextResponse.json(intent);
}
