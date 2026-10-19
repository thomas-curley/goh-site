import { NextRequest, NextResponse } from "next/server";
import { checkPermission } from "@/lib/check-permission";
import { bingoServiceClient } from "@/lib/bingo-server";
import { syncEventAutoTiles } from "@/lib/bingo-sync";

// POST - update this board's auto-tracked tiles from Wise Old Man now.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { allowed } = await checkPermission("manage_bingo");
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const supabase = bingoServiceClient();
  if (!supabase) return NextResponse.json({ error: "Supabase not configured" }, { status: 503 });

  const result = await syncEventAutoTiles(supabase, id);
  return NextResponse.json(result);
}
