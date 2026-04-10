import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TODO: Fetch single event from Supabase by id
  return NextResponse.json(
    { message: `Event ${id} — Supabase not configured yet` },
    { status: 404 }
  );
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();

    // TODO: Authenticate user
    // TODO: Update event in Supabase
    // TODO: Update Discord Scheduled Event

    return NextResponse.json({
      message: `Event ${id} update will work once Supabase is configured`,
      event: body,
    });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // TODO: Authenticate user
  // TODO: Delete from Supabase
  // TODO: Delete Discord Scheduled Event

  return NextResponse.json({
    message: `Event ${id} deletion will work once Supabase is configured`,
  });
}
