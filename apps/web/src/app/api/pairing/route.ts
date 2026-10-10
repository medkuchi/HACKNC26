import { NextRequest, NextResponse } from "next/server";
import { createPairingCode, verifyPairingCode } from "@/lib/pairing/store";

export async function POST(req: NextRequest) {
  const { userId } = await req.json();

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const { code, expiresAt } = createPairingCode(userId);
  return NextResponse.json({ code, expiresAt });
}

// called by apps/photon-agent when an incoming iMessage looks like a pairing code
export async function PATCH(req: NextRequest) {
  const { code } = await req.json();

  if (!code) {
    return NextResponse.json({ error: "code is required" }, { status: 400 });
  }

  const result = verifyPairingCode(code);
  if (!result) {
    return NextResponse.json({ verified: false }, { status: 404 });
  }

  return NextResponse.json({ verified: true, userId: result.userId });
}
