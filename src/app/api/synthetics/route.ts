import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - List all saved synthetics
export async function GET() {
  try {
    const synthetics = await db.syntheticInstrument.findMany({
      orderBy: { createdAt: "desc" },
    });

    // Parse legs JSON for each synthetic
    const result = synthetics.map((s) => ({
      ...s,
      legs: JSON.parse(s.legs),
    }));

    return NextResponse.json({ synthetics: result });
  } catch (error) {
    console.error("Error fetching synthetics:", error);
    return NextResponse.json(
      { error: "Failed to fetch synthetics" },
      { status: 500 }
    );
  }
}

// POST - Create a new synthetic instrument
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, type, legs } = body;

    if (!name || !type || !legs || !Array.isArray(legs) || legs.length === 0) {
      return NextResponse.json(
        { error: "Name, type, and legs are required" },
        { status: 400 }
      );
    }

    // Validate legs
    for (const leg of legs) {
      if (!leg.symbol || !leg.coefficient || !leg.side) {
        return NextResponse.json(
          { error: "Each leg must have symbol, coefficient, and side" },
          { status: 400 }
        );
      }
    }

    const synthetic = await db.syntheticInstrument.create({
      data: {
        name,
        description: description || null,
        type,
        legs: JSON.stringify(legs),
      },
    });

    return NextResponse.json({
      synthetic: { ...synthetic, legs: JSON.parse(synthetic.legs) },
    });
  } catch (error) {
    console.error("Error creating synthetic:", error);
    return NextResponse.json(
      { error: "Failed to create synthetic" },
      { status: 500 }
    );
  }
}
