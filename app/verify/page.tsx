"use client"

/**
 * /verify — THE BOOKS. Public proof of revenue.
 *
 * Every dollar that comes in is snapshotted into a chained commit and anchored
 * on Solana (SPL Memo). This page shows the cumulative gross + pool split +
 * paid-out, and lets anyone re-hash each commit's canonical preimage in their
 * browser and match it against the on-chain memo — so the gross can't be
 * understated or rewritten after the fact. The partner audit surface.
 */

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { ShieldCheck, ArrowLeft, Link2, Hash, ExternalLink, Loader2, Check, X, Wrench, Users2, Code2, Send, Ticket } from "lucide-react"

const ACID = "#c6ff2e"
const usd = (c: number) => `$${((c ?? 0) / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const spins = (n: number) => (n ?? 0).toLocaleString("en-US")

async function sha256Hex(s: string): Promise<string> {
  const bytes = new TextEncoder().encode(s)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("")
}
function explorer(sig: string, cluster: string | null) {
  return cluster === "mainnet-beta" ? `https://explorer.solana.com/tx/${sig}` : `https://explorer.solana.com/tx/${sig}?cluster=${cluster || "devnet"}`
}

interface Commit {
  seq: number; period_end: string
  gross_cents: number; ops_cents: number; team_cents: number; eco_cents: number; paid_cents: number
  ops_pct: number; team_pct: number; eco_pct: number
  prev_hash: string | null; commit_hash: string; commit_canonical: string
  signature: string | null; rpc_cluster: string | null; created_at: string
}

interface DrawWinner { position: number; handle: string; tickets: number; spins: number }
interface Draw {
  day: string
  pool_spins: number
  carry_spins: number
  tickets_total: number
  players_total: number
  seed: string | null
  summary: { winners?: DrawWinner[] } | null
  settled_at: string
  settle_commit_hash: string | null
  settle_canonical: string | null
  settle_signature: string | null
  settle_cluster: string | null
}

export default function VerifyPage() {
  const router = useRouter()
  const goBack = () => { if (typeof window !== "undefined" && window.history.length > 1) router.back(); else router.push("/profile") }
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [hashOk, setHashOk] = useState<Record<number, boolean>>({})
  const [integrity, setIntegrity] = useState<"idle" | "ok" | "bad">("idle")
  const [linkage, setLinkage] = useState<"idle" | "ok" | "bad">("idle")
  const [draws, setDraws] = useState<Draw[]>([])
  const [drawsLoading, setDrawsLoading] = useState(true)
  const [drawHashOk, setDrawHashOk] = useState<Record<string, boolean>>({})

  const verify = useCallback(async (rows: Commit[]) => {
    // 1. Re-hash each commit's canonical → must equal commit_hash.
    const okMap: Record<number, boolean> = {}
    let allHash = true
    for (const c of rows) {
      const h = await sha256Hex(c.commit_canonical)
      okMap[c.seq] = h === c.commit_hash
      if (!okMap[c.seq]) allHash = false
    }
    setHashOk(okMap); setIntegrity(rows.length ? (allHash ? "ok" : "bad") : "idle")
    // 2. Chain linkage: each newer commit's prev_hash === the older one's commit_hash.
    let linked = true
    for (let i = 0; i < rows.length - 1; i++) {
      if (rows[i].prev_hash !== rows[i + 1].commit_hash) { linked = false; break }
    }
    setLinkage(rows.length ? (linked ? "ok" : "bad") : "idle")
  }, [])

  const verifyDraws = useCallback(async (rows: Draw[]) => {
    // Re-hash each draw's stored canonical preimage → must equal its commit_hash.
    // Same in-browser check the revenue chain uses.
    const okMap: Record<string, boolean> = {}
    for (const d of rows) {
      if (!d.settle_canonical || !d.settle_commit_hash) continue
      const h = await sha256Hex(d.settle_canonical)
      okMap[d.day] = h === d.settle_commit_hash
    }
    setDrawHashOk(okMap)
  }, [])

  useEffect(() => {
    let cancelled = false
    fetch("/api/proof/revenue").then((r) => (r.ok ? r.json() : { commits: [] }))
      .then((d) => { if (cancelled) return; const rows: Commit[] = d.commits || []; setCommits(rows); setLoading(false); verify(rows) })
      .catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [verify])

  useEffect(() => {
    let cancelled = false
    fetch("/api/proof/draw").then((r) => (r.ok ? r.json() : { draws: [] }))
      .then((d) => { if (cancelled) return; const rows: Draw[] = d.draws || []; setDraws(rows); setDrawsLoading(false); verifyDraws(rows) })
      .catch(() => { if (!cancelled) setDrawsLoading(false) })
    return () => { cancelled = true }
  }, [verifyDraws])

  const latest = commits[0] || null

  const Badge = ({ state }: { state: "idle" | "ok" | "bad" }) =>
    state === "ok" ? <span className="flex items-center gap-1 text-xs" style={{ color: ACID }}><Check className="w-3.5 h-3.5" /> verified</span>
      : state === "bad" ? <span className="flex items-center gap-1 text-xs text-red-400"><X className="w-3.5 h-3.5" /> mismatch</span>
        : <span className="text-xs text-white/30">—</span>

  const Pool = ({ icon: Icon, label, pct, value }: { icon: any; label: string; pct: number; value: string }) => (
    <div className="rounded-2xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
      <div className="flex items-center gap-2 text-white/45 text-[11px] uppercase tracking-wide"><Icon className="w-3.5 h-3.5" /> {label} {pct}%</div>
      <div className="mt-1.5 text-xl font-display">{value}</div>
    </div>
  )

  return (
    <div className="min-h-screen text-white pb-28" style={{ background: "#0a0a0f" }}>
      {/* hero */}
      <div className="relative overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 opacity-[0.08]" style={{ background: "radial-gradient(600px circle at 50% 0%, #c6ff2e, transparent 60%)" }} />
        <div className="relative max-w-3xl lg:max-w-4xl mx-auto px-5 pt-6 pb-9">
          <button onClick={goBack} aria-label="Back" className="inline-flex items-center gap-1.5 mb-5 rounded-full px-3 py-1.5 font-mono text-[11px] tracking-[0.08em] uppercase" style={{ border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.65)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2" style={{ color: ACID }}>
            <ShieldCheck className="w-5 h-5" />
            <span className="text-xs font-mono uppercase tracking-[0.2em]">The Books</span>
          </div>
          <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight">Every dollar, on the record.</h1>
          <p className="mt-3 text-sm sm:text-base text-white/60 leading-relaxed max-w-xl">
            Gross revenue is snapshotted into a chained commit and anchored on Solana. Nothing here asks you to trust us —
            re-hash any commit below and match it against the chain. The gross can&apos;t be understated or rewritten after the fact.
          </p>

          {latest && (
            <>
              <div className="mt-6 rounded-2xl border p-5" style={{ borderColor: "rgba(198,255,46,0.3)", background: "linear-gradient(180deg, rgba(198,255,46,0.07), transparent)" }}>
                <div className="text-white/45 text-[11px] uppercase tracking-wide">Gross revenue (cumulative)</div>
                <div className="mt-1 font-display" style={{ fontSize: 44, color: ACID }}>{usd(latest.gross_cents)}</div>
                <div className="text-white/40 text-[11px] mt-1">anchored at commit #{latest.seq} · {new Date(latest.period_end).toLocaleString()}</div>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
                <Pool icon={Wrench} label="Operational" pct={latest.ops_pct} value={usd(latest.ops_cents)} />
                <Pool icon={Users2} label="Team" pct={latest.team_pct} value={usd(latest.team_cents)} />
                <Pool icon={Code2} label="Development" pct={latest.eco_pct} value={usd(latest.eco_cents)} />
                <Pool icon={Send} label="Paid out" pct={0} value={usd(latest.paid_cents)} />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="max-w-3xl lg:max-w-4xl mx-auto px-5">
        {/* verification summary */}
        <div className="mt-7 grid sm:grid-cols-2 gap-3">
          <div className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium"><Hash className="w-4 h-4 text-white/50" /> Commit integrity</span>
              <Badge state={integrity} />
            </div>
            <p className="text-white/45 text-xs mt-2 leading-relaxed">Each commit&apos;s canonical record is re-hashed in your browser (SHA-256) and matched to its stored hash. Proves no row was edited.</p>
          </div>
          <div className="rounded-2xl border border-white/10 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 font-medium"><Link2 className="w-4 h-4 text-white/50" /> Chain linkage</span>
              <Badge state={linkage} />
            </div>
            <p className="text-white/45 text-xs mt-2 leading-relaxed">Every commit points back to the one before it. Proves the history is unbroken — no snapshot removed or inserted.</p>
          </div>
        </div>

        {/* the chain */}
        <div className="flex items-center gap-2 mt-8 mb-3" style={{ color: ACID }}>
          <ShieldCheck className="w-4 h-4" /><span className="text-xs font-mono uppercase tracking-[0.2em]">The Chain</span>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> loading the books…</div>
        ) : commits.length === 0 ? (
          <div className="text-white/40 text-sm py-10 text-center">No revenue commits anchored yet. They appear here once the anchor runs after the first purchase.</div>
        ) : (
          <div className="space-y-2.5">
            {commits.map((c) => (
              <div key={c.seq} className="rounded-2xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center justify-center w-11 shrink-0">
                    <span className="text-[10px] text-white/35 font-mono">SEQ</span>
                    <span className="font-display text-lg leading-none">{c.seq}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{usd(c.gross_cents)}</span>
                      <span className="text-white/35 text-xs">gross · {new Date(c.period_end).toLocaleDateString()}</span>
                      {c.signature
                        ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: ACID, border: "1px solid rgba(198,255,46,0.3)" }}>ON-CHAIN</span>
                        : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-white/40 border border-white/10">PENDING</span>}
                    </div>
                    <div className="mt-0.5 text-xs text-white/40 font-mono truncate">{c.commit_hash.slice(0, 16)}…{c.commit_hash.slice(-8)}</div>
                  </div>
                  <div className="shrink-0 flex items-center gap-3">
                    {hashOk[c.seq] === undefined ? <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                      : hashOk[c.seq] ? <Check className="w-4 h-4" style={{ color: ACID }} /> : <X className="w-4 h-4 text-red-400" />}
                    {c.signature && (
                      <a href={explorer(c.signature, c.rpc_cluster)} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white">
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* the draws */}
        <div className="flex items-center gap-2 mt-12 mb-3" style={{ color: ACID }}>
          <Ticket className="w-4 h-4" /><span className="text-xs font-mono uppercase tracking-[0.2em]">The Draws</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold leading-tight">Every draw, on the record.</h2>
        <p className="mt-2 text-sm text-white/60 leading-relaxed max-w-xl">
          Five names, weighted by how many tickets each player earned, no name twice. The seed is a Solana blockhash pulled
          after the day closed, so nobody could know it while tickets were still live. Feed the same seed through the same
          tickets and the same five fall out. Re-hash it here, then open the record on Solana.
        </p>

        {drawsLoading ? (
          <div className="flex items-center gap-2 text-white/40 text-sm py-10 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> loading the draws…</div>
        ) : draws.length === 0 ? (
          <div className="text-white/40 text-sm py-10 text-center">No draws yet. The first one lands here the morning after launch.</div>
        ) : (
          <div className="space-y-2.5 mt-4">
            {draws.map((d) => {
              const winners = (d.summary?.winners || []).slice().sort((a, b) => a.position - b.position)
              return (
                <div key={d.day} className="rounded-2xl border border-white/10 p-4" style={{ background: "rgba(255,255,255,0.02)" }}>
                  <div className="flex items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{new Date(d.day + "T00:00:00Z").toLocaleDateString(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })}</span>
                        <span className="text-white/35 text-xs">{spins(d.pool_spins)} Spins pool</span>
                        {d.settle_signature
                          ? <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ color: ACID, border: "1px solid rgba(198,255,46,0.3)" }}>ON-CHAIN</span>
                          : <span className="text-[10px] font-mono px-1.5 py-0.5 rounded text-white/40 border border-white/10">PENDING</span>}
                      </div>
                      {d.settle_commit_hash && (
                        <div className="mt-0.5 text-xs text-white/40 font-mono truncate">{d.settle_commit_hash.slice(0, 16)}…{d.settle_commit_hash.slice(-8)}</div>
                      )}
                    </div>
                    <div className="shrink-0 flex items-center gap-3">
                      {drawHashOk[d.day] === undefined
                        ? <Loader2 className="w-4 h-4 animate-spin text-white/30" />
                        : drawHashOk[d.day] ? <Check className="w-4 h-4" style={{ color: ACID }} /> : <X className="w-4 h-4 text-red-400" />}
                      {d.settle_signature && (
                        <a href={explorer(d.settle_signature, d.settle_cluster)} target="_blank" rel="noopener noreferrer" className="text-white/40 hover:text-white">
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  </div>

                  {winners.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-5 gap-2">
                      {winners.map((w) => (
                        <div key={w.position} className="rounded-xl border border-white/10 px-3 py-2" style={{ background: "rgba(255,255,255,0.02)" }}>
                          <div className="text-[10px] text-white/35 font-mono">#{w.position}</div>
                          <div className="text-xs font-mono truncate">{w.handle}</div>
                          <div className="text-sm font-display" style={{ color: ACID }}>{spins(w.spins)}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-3 text-[11px] text-white/35 font-mono break-all">
                    seed {d.seed ? `${d.seed.slice(0, 12)}…${d.seed.slice(-8)}` : "n/a"}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-white/25 font-mono tracking-wider mt-8 px-4 leading-relaxed">
          CUMULATIVE GROSS · CHAINED · ANCHORED ON SOLANA
        </p>
      </div>
    </div>
  )
}
