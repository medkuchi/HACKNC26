import { NextRequest, NextResponse } from "next/server";
import { generateText } from "@/lib/gemini/client";
import { explanationPrompt } from "@/lib/gemini/prompts";

export async function POST(req: NextRequest) {
  const { planName, cost, shortfall, riskLevel } = await req.json();

  if (!planName || cost == null || shortfall == null || !riskLevel) {
    return NextResponse.json(
      { error: "planName, cost, shortfall, and riskLevel are required" },
      { status: 400 },
    );
  }

  const explanation = await generateText(
    explanationPrompt({ planName, cost, shortfall, riskLevel }),
  );

  return NextResponse.json({ explanation });
}
