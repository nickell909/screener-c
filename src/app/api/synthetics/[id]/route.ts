import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET - Get specific synthetic
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const synthetic = await db.syntheticInstrument.findUnique({
      where: { id },
    });

    if (!synthetic) {
      return NextResponse.json(
        { error: "Synthetic not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      synthetic: { ...synthetic, legs: JSON.parse(synthetic.legs) },
    });
  } catch (error) {
    console.error("Error fetching synthetic:", error);
    return NextResponse.json(
      { error: "Failed to fetch synthetic" },
      { status: 500 }
    );
  }
}

// PUT - Update synthetic
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, type, legs } = body;

    const updateData: Record<string, unknown> = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (type !== undefined) updateData.type = type;
    if (legs !== undefined) updateData.legs = JSON.stringify(legs);

    const synthetic = await db.syntheticInstrument.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      synthetic: { ...synthetic, legs: JSON.parse(synthetic.legs) },
    });
  } catch (error) {
    console.error("Error updating synthetic:", error);
    return NextResponse.json(
      { error: "Failed to update synthetic" },
      { status: 500 }
    );
  }
}

// DELETE - Delete synthetic
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await db.syntheticInstrument.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting synthetic:", error);
    return NextResponse.json(
      { error: "Failed to delete synthetic" },
      { status: 500 }
    );
  }
}
