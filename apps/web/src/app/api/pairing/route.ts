import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createPairingCode, verifyPairingCode } from "@/lib/pairing/store";

// hash both sides first since timingSafeEqual throws on unequal-length buffers
function isAuthorizedWorker(req: NextRequest): boolean {
  const expected = process.env.PHOTON_AGENT_SHARED_SECRET?.trim();
  if (!expected) return false;

  const provided = /^Bearer (.+)$/i.exec(req.headers.get("Authorization") ?? "")?.[1];
  if (!provided) return false;

  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(provided), hash(expected));
}

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
  if (!isAuthorizedWorker(req)) {
    return NextResponse.json({ error: "Unauthorized worker request" }, { status: 401 });
  }

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
