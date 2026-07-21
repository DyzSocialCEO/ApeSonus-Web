import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/server"
import { apiRatelimit } from "@/lib/upstash"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * GET /api/proof/draw
 *
 * Public, read-only. Returns settled draws newest-first with the anon winners,
 * the seed, and the on-chain anchor (commit hash + canonical preimage + tx
 * signature). Anyone can re-hash the canonical in their browser, match it to
 * commit_hash, open the memo on Solana, and re-run the seeded hash-walk from
 * the seed + tickets to confirm the same five. No identity is exposed — winners
 * are the anon handles the settle already froze into summary. No auth required.
 */
export async function GET(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") || "unknown"
    const { success } = await apiRatelimit().limit(`proof-draw:${ip}`)
    if (!success) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 })
    }

    const supabase = await createAdminClient()
    const { data, error } = await supabase
      .from("pit_draw_days")
      .select(
        "day, status, pool_spins, carry_spins, tickets_total, players_total, seed, summary, settled_at, settle_commit_hash, settle_canonical, settle_signature, settle_cluster",
      )
      .eq("status", "settled")
      .order("day", { ascending: false })
      .limit(120)

    if (error) throw error

    return NextResponse.json(
      { draws: data || [] },
      { headers: { "Cache-Control": "public, max-age=30" } },
    )
  } catch (e) {
    console.error("[proof/draw]", (e as Error).message)
    return NextResponse.json({ draws: [] }, { status: 200 })
  }
}
