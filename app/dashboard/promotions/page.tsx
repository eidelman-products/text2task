"use client"

import { useEffect, useMemo, useState } from "react"

type PromotionRow = {
  id: string
  sender: string
  emails: number
  domain?: string
  unsubscribable?: boolean
}

type FeedbackState = {
  type: "success" | "error" | "info"
  message: string
} | null

const DELETE_ENDPOINT = "/api/delete-by-sender"
const ARCHIVE_ENDPOINT = "/api/archive-by-sender"
const UNSUBSCRIBE_ENDPOINT = "/api/unsubscribe-by-sender"

const CLEANUP_LIMIT = 250
const INITIAL_CLEANUP_USED = 79
const SAMPLE_SIZE = 1000
const PLAN: "free" | "pro" = "free"

function formatNumber(value: number) {
  return new Intl.NumberFormat().format(value)
}

function getInitials(name: string) {
  const cleaned = name.trim()
  if (!cleaned) return "?"

  const words = cleaned.split(/\s+/).filter(Boolean)

  if (words.length === 1) {
    return words[0].slice(0, 1).toUpperCase()
  }

  return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase()
}

function getAvatarColor(seed: string) {
  const colors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-amber-500",
    "bg-yellow-500",
    "bg-lime-500",
    "bg-green-500",
    "bg-emerald-500",
    "bg-teal-500",
    "bg-cyan-500",
    "bg-sky-500",
    "bg-blue-500",
    "bg-indigo-500",
    "bg-violet-500",
    "bg-purple-500",
    "bg-pink-500",
    "bg-rose-500",
  ]

  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash)
  }

  return colors[Math.abs(hash) % colors.length]
}

function getPromotionCategory(domain?: string) {
  const d = (domain || "").toLowerCase()

  if (!d) return "Other"

  if (
    d.includes("aliexpress") ||
    d.includes("amazon") ||
    d.includes("alibaba") ||
    d.includes("banggood") ||
    d.includes("ebay")
  ) {
    return "Shopping"
  }

  if (
    d.includes("agoda") ||
    d.includes("booking") ||
    d.includes("trip") ||
    d.includes("travel")
  ) {
    return "Travel"
  }

  if (
    d.includes("binance") ||
    d.includes("crypto") ||
    d.includes("coin") ||
    d.includes("finance")
  ) {
    return "Finance"
  }

  if (
    d.includes("vidiq") ||
    d.includes("kling") ||
    d.includes("runway") ||
    d.includes("freepik") ||
    d.includes("tube") ||
    d.includes("elevenlabs")
  ) {
    return "SaaS / Tools"
  }

  return "Other"
}

function parseErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function SenderLogo({
  sender,
  domain,
}: {
  sender: string
  domain?: string
}) {
  const [logoFailed, setLogoFailed] = useState(false)

  const initials = getInitials(sender)
  const fallbackColor = getAvatarColor(sender)

  const shouldShowLogo = Boolean(domain) && !logoFailed
  const logoUrl = domain
    ? `https://logo.clearbit.com/${domain}?size=64`
    : ""

  return (
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[16px] border border-[#d9e1f2] bg-white shadow-sm">
      {shouldShowLogo ? (
        <img
          src={logoUrl}
          alt={`${sender} logo`}
          className="h-8 w-8 object-contain"
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <div
          className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white ${fallbackColor}`}
        >
          {initials}
        </div>
      )}
    </div>
  )
}

function DonutChart({
  values,
  total,
}: {
  values: { label: string; value: number; color: string }[]
  total: number
}) {
  const radius = 70
  const circumference = 2 * Math.PI * radius
  let currentOffset = 0

  return (
    <div className="relative flex h-[210px] w-[210px] items-center justify-center">
      <svg width="210" height="210" viewBox="0 0 210 210" className="-rotate-90">
        <circle
          cx="105"
          cy="105"
          r={radius}
          fill="none"
          stroke="#e6edf8"
          strokeWidth="22"
        />
        {values.map((segment) => {
          const segmentLength =
            total > 0 ? (segment.value / total) * circumference : 0
          const circle = (
            <circle
              key={segment.label}
              cx="105"
              cy="105"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="22"
              strokeLinecap="round"
              strokeDasharray={`${segmentLength} ${circumference - segmentLength}`}
              strokeDashoffset={-currentOffset}
            />
          )
          currentOffset += segmentLength
          return circle
        })}
      </svg>

      <div className="absolute flex flex-col items-center justify-center text-center">
        <div className="text-[18px] font-semibold text-[#6b7895]">Promotions</div>
        <div className="text-[42px] font-extrabold leading-none text-[#14213d]">
          {formatNumber(total)}
        </div>
        <div className="mt-1 text-sm text-[#6b7895]">sample emails</div>
      </div>
    </div>
  )
}

export default function PromotionsPage() {
  const [promotionsData, setPromotionsData] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)

  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("all")
  const [sort, setSort] = useState("desc")

  const [feedback, setFeedback] = useState<FeedbackState>(null)
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null)
  const [cleanAllLoading, setCleanAllLoading] = useState(false)
  const [cleanupUsedThisWeek, setCleanupUsedThisWeek] = useState(INITIAL_CLEANUP_USED)

  useEffect(() => {
    let mounted = true

    async function loadPromotions() {
      try {
        const res = await fetch("/api/gmail/senders", {
          cache: "no-store",
        })

        if (!res.ok) {
          throw new Error("Failed to load promotion senders")
        }

        const data = await res.json()
        const senders = Array.isArray(data?.senders) ? data.senders : []

        if (!mounted) return

        const normalized: PromotionRow[] = senders.map((row: PromotionRow, index: number) => ({
          id: row.id || `${row.sender}-${row.domain || "no-domain"}-${index}`,
          sender: row.sender,
          emails: Number(row.emails || 0),
          domain: row.domain,
          unsubscribable: Boolean(row.unsubscribable),
        }))

        setPromotionsData(normalized)
      } catch (error) {
        if (!mounted) return
        setFeedback({
          type: "error",
          message: parseErrorMessage(error, "Failed to load promotions data"),
        })
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadPromotions()

    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!feedback) return
    const timer = window.setTimeout(() => {
      setFeedback(null)
    }, 5000)

    return () => window.clearTimeout(timer)
  }, [feedback])

  const cleanupLeft = Math.max(CLEANUP_LIMIT - cleanupUsedThisWeek, 0)

  const totalPromotions = useMemo(() => {
    return promotionsData.reduce((sum, row) => sum + row.emails, 0)
  }, [promotionsData])

  const cleanNowCount = useMemo(() => {
    return PLAN === "pro" ? totalPromotions : Math.min(totalPromotions, cleanupLeft)
  }, [totalPromotions, cleanupLeft])

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {
      Shopping: 0,
      Travel: 0,
      Finance: 0,
      "SaaS / Tools": 0,
      Other: 0,
    }

    promotionsData.forEach((row) => {
      const category = getPromotionCategory(row.domain)
      map[category] = (map[category] || 0) + row.emails
    })

    return [
      { label: "Shopping", value: map["Shopping"], color: "#f97316" },
      { label: "Travel", value: map["Travel"], color: "#14b8a6" },
      { label: "Finance", value: map["Finance"], color: "#8b5cf6" },
      { label: "SaaS / Tools", value: map["SaaS / Tools"], color: "#3b82f6" },
      { label: "Other", value: map["Other"], color: "#cbd5e1" },
    ]
  }, [promotionsData])

  const dominantCategory = useMemo(() => {
    const sorted = [...categoryData].sort((a, b) => b.value - a.value)
    return sorted[0]
  }, [categoryData])

  const filteredData = useMemo(() => {
    let data = [...promotionsData]

    if (search.trim()) {
      const s = search.toLowerCase().trim()
      data = data.filter(
        (row) =>
          row.sender.toLowerCase().includes(s) ||
          row.domain?.toLowerCase().includes(s)
      )
    }

    if (filter === "unsubscribe") {
      data = data.filter((row) => row.unsubscribable)
    }

    if (filter === "no-unsubscribe") {
      data = data.filter((row) => !row.unsubscribable)
    }

    if (filter === "50plus") {
      data = data.filter((row) => row.emails >= 50)
    }

    if (filter === "10plus") {
      data = data.filter((row) => row.emails >= 10)
    }

    if (sort === "desc") {
      data.sort((a, b) => b.emails - a.emails)
    }

    if (sort === "asc") {
      data.sort((a, b) => a.emails - b.emails)
    }

    if (sort === "az") {
      data.sort((a, b) => a.sender.localeCompare(b.sender))
    }

    if (sort === "za") {
      data.sort((a, b) => b.sender.localeCompare(a.sender))
    }

    return data
  }, [promotionsData, search, filter, sort])

  async function postAction(
    endpoint: string,
    row: PromotionRow,
    fallbackErrorMessage: string
  ) {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sender: row.sender,
        domain: row.domain,
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(text || fallbackErrorMessage)
    }

    return res
  }

  async function handleTrash(row: PromotionRow) {
    if (PLAN === "free" && cleanupLeft <= 0) {
      setFeedback({
        type: "error",
        message: "You’ve reached your weekly free cleanup limit. Upgrade to Pro to continue.",
      })
      return
    }

    const actionKey = `${row.id}-trash`
    setActiveActionKey(actionKey)

    try {
      await postAction(
        DELETE_ENDPOINT,
        row,
        "Failed to move emails to Trash"
      )

      setPromotionsData((prev) => prev.filter((item) => item.id !== row.id))
      setCleanupUsedThisWeek((prev) =>
        PLAN === "pro" ? prev : Math.min(CLEANUP_LIMIT, prev + row.emails)
      )

      setFeedback({
        type: "success",
        message: `${row.sender} moved to Trash successfully.`,
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message: parseErrorMessage(error, "Failed to move emails to Trash"),
      })
    } finally {
      setActiveActionKey(null)
    }
  }

  async function handleArchive(row: PromotionRow) {
    if (PLAN === "free" && cleanupLeft <= 0) {
      setFeedback({
        type: "error",
        message: "You’ve reached your weekly free cleanup limit. Upgrade to Pro to continue.",
      })
      return
    }

    const actionKey = `${row.id}-archive`
    setActiveActionKey(actionKey)

    try {
      await postAction(
        ARCHIVE_ENDPOINT,
        row,
        "Failed to archive emails"
      )

      setPromotionsData((prev) => prev.filter((item) => item.id !== row.id))
      setCleanupUsedThisWeek((prev) =>
        PLAN === "pro" ? prev : Math.min(CLEANUP_LIMIT, prev + row.emails)
      )

      setFeedback({
        type: "success",
        message: `${row.sender} archived successfully.`,
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message: parseErrorMessage(error, "Failed to archive emails"),
      })
    } finally {
      setActiveActionKey(null)
    }
  }

  async function handleUnsubscribe(row: PromotionRow) {
    const actionKey = `${row.id}-unsubscribe`
    setActiveActionKey(actionKey)

    try {
      await postAction(
        UNSUBSCRIBE_ENDPOINT,
        row,
        "Failed to unsubscribe"
      )

      setPromotionsData((prev) =>
        prev.map((item) =>
          item.id === row.id
            ? { ...item, unsubscribable: false }
            : item
        )
      )

      setFeedback({
        type: "success",
        message: `Unsubscribe request sent for ${row.sender}.`,
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message: parseErrorMessage(error, "Failed to unsubscribe"),
      })
    } finally {
      setActiveActionKey(null)
    }
  }

  async function handleCleanNow() {
    if (!promotionsData.length) {
      setFeedback({
        type: "info",
        message: "No promotions available to clean right now.",
      })
      return
    }

    if (PLAN === "free" && cleanupLeft <= 0) {
      setFeedback({
        type: "error",
        message: "You’ve reached your weekly free cleanup limit. Upgrade to Pro to continue.",
      })
      return
    }

    setCleanAllLoading(true)

    try {
      const sortedRows = [...promotionsData].sort((a, b) => b.emails - a.emails)
      const allowed = PLAN === "pro" ? Number.POSITIVE_INFINITY : cleanupLeft

      let processedEmails = 0
      let processedRows = 0
      const succeededIds = new Set<string>()

      for (const row of sortedRows) {
        if (processedEmails >= allowed) break
        if (row.emails > allowed - processedEmails && PLAN !== "pro") continue

        const res = await fetch(DELETE_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sender: row.sender,
            domain: row.domain,
          }),
        })

        if (!res.ok) {
          const text = await res.text()
          throw new Error(text || `Failed to clean promotions for ${row.sender}`)
        }

        processedEmails += row.emails
        processedRows += 1
        succeededIds.add(row.id)
      }

      if (processedRows === 0) {
        setFeedback({
          type: "info",
          message: "No promotion sender matched the current cleanup allowance.",
        })
        return
      }

      setPromotionsData((prev) => prev.filter((item) => !succeededIds.has(item.id)))
      setCleanupUsedThisWeek((prev) =>
        PLAN === "pro" ? prev : Math.min(CLEANUP_LIMIT, prev + processedEmails)
      )

      setFeedback({
        type: "success",
        message: `Cleaned ${formatNumber(processedEmails)} promotion emails across ${processedRows} sender groups.`,
      })
    } catch (error) {
      setFeedback({
        type: "error",
        message: parseErrorMessage(error, "Failed to clean promotions"),
      })
    } finally {
      setCleanAllLoading(false)
    }
  }

  function clearFilters() {
    setSearch("")
    setFilter("all")
    setSort("desc")
  }

  function isRowBusy(row: PromotionRow) {
    return (
      activeActionKey === `${row.id}-trash` ||
      activeActionKey === `${row.id}-archive` ||
      activeActionKey === `${row.id}-unsubscribe`
    )
  }

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-6 py-8 md:px-10">
      <div className="mx-auto max-w-[1440px]">
        <div className="rounded-[28px] border border-[#d9e1f2] bg-white px-6 py-6 shadow-[0_10px_30px_rgba(31,41,55,0.05)] md:px-8 md:py-8">
          {/* HEADER */}
          <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h1 className="text-[34px] font-extrabold tracking-[-0.02em] text-[#14213d] md:text-[38px]">
                Promotions
              </h1>
              <p className="mt-2 max-w-[760px] text-[17px] leading-7 text-[#6b7895]">
                Review marketing clutter, find the noisiest senders, and clean promotion emails faster from one premium workspace.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleCleanNow}
                disabled={cleanAllLoading || loading || cleanNowCount <= 0}
                className="inline-flex h-[56px] items-center justify-center rounded-[16px] bg-[#2563eb] px-6 text-[16px] font-bold text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)] transition hover:bg-[#1d4ed8] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {cleanAllLoading
                  ? "Cleaning..."
                  : `Clean ${formatNumber(cleanNowCount)} Promotions`}
              </button>

              <button className="inline-flex h-[56px] items-center justify-center rounded-[16px] border border-[#bfd0fb] bg-white px-6 text-[16px] font-bold text-[#2563eb] transition hover:bg-[#f8fbff]">
                Unlock Full Cleanup (Pro)
              </button>
            </div>
          </div>

          {/* TRUST + PREMIUM MICROCOPY */}
          <div className="mb-6 flex flex-col gap-3 rounded-[20px] border border-[#e8eef8] bg-[#fbfcff] px-5 py-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-col gap-1">
              <div className="text-[15px] font-semibold text-[#14213d]">
                You control every action
              </div>
              <div className="text-sm text-[#6b7895]">
                Nothing is deleted automatically. Every cleanup action requires your click, and you can disconnect Gmail anytime.
              </div>
            </div>

            <div className="rounded-full bg-[#eef4ff] px-4 py-2 text-sm font-semibold text-[#2563eb]">
              Free plan: up to {formatNumber(cleanupLeft)} cleanup emails left this week
            </div>
          </div>

          {/* FEEDBACK */}
          {feedback && (
            <div
              className={`mb-6 rounded-[16px] border px-4 py-3 text-sm font-semibold ${
                feedback.type === "success"
                  ? "border-[#86efac] bg-[#f0fdf4] text-[#166534]"
                  : feedback.type === "error"
                  ? "border-[#fecaca] bg-[#fef2f2] text-[#b91c1c]"
                  : "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]"
              }`}
            >
              {feedback.message}
            </div>
          )}

          {/* ANALYTICS + MODERN STATS */}
          <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-[1.25fr_0.95fr]">
            <div className="rounded-[24px] border border-[#dce6f7] bg-white p-6 shadow-[0_10px_30px_rgba(15,23,42,0.04)]">
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[24px] font-extrabold tracking-[-0.02em] text-[#14213d]">
                    Promotion categories
                  </div>
                  <div className="mt-2 text-[16px] text-[#6b7895]">
                    Most of your promotion clutter comes from{" "}
                    <span className="font-bold text-[#14213d]">
                      {dominantCategory?.label || "Other"}
                    </span>
                    {dominantCategory && totalPromotions > 0
                      ? ` (${Math.round((dominantCategory.value / totalPromotions) * 100)}%)`
                      : ""}
                    .
                  </div>
                </div>

                <div className="rounded-full bg-[#f5f9ff] px-4 py-2 text-sm font-semibold text-[#2563eb]">
                  Sample-based analytics
                </div>
              </div>

              <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-center">
                <div className="flex justify-center">
                  <DonutChart values={categoryData} total={totalPromotions} />
                </div>

                <div className="flex-1 space-y-4">
                  {categoryData.map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between border-b border-[#edf2fb] pb-3 last:border-b-0 last:pb-0"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3.5 w-3.5 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-[17px] font-semibold text-[#14213d]">
                          {item.label}
                        </span>
                      </div>

                      <span className="text-[18px] font-extrabold text-[#14213d]">
                        {formatNumber(item.value)}
                      </span>
                    </div>
                  ))}

                  <div className="border-t border-[#edf2fb] pt-4 text-sm text-[#6b7895]">
                    Based on Gmail Promotions classification in your latest {formatNumber(SAMPLE_SIZE)}-email sample scan.
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="rounded-[22px] border border-[#dce6f7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#7b87a3]">
                  Promotions in sample
                </div>
                <div className="text-[42px] font-extrabold leading-none text-[#14213d]">
                  {formatNumber(totalPromotions)}
                </div>
                <div className="mt-3 text-sm text-[#6b7895]">
                  Promotion emails detected in your current sample scan.
                </div>
              </div>

              <div className="rounded-[22px] border border-[#dce6f7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#7b87a3]">
                  Weekly cleanup left
                </div>
                <div className="text-[42px] font-extrabold leading-none text-[#16a34a]">
                  {formatNumber(cleanupLeft)}
                </div>
                <div className="mt-3 text-sm text-[#6b7895]">
                  Remaining free cleanup allowance for this week.
                </div>
              </div>

              <div className="rounded-[22px] border border-[#dce6f7] bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#7b87a3]">
                  Weekly cleanup used
                </div>
                <div className="text-[42px] font-extrabold leading-none text-[#14213d]">
                  {formatNumber(cleanupUsedThisWeek)}
                </div>
                <div className="mt-3 text-sm text-[#6b7895]">
                  Used out of {formatNumber(CLEANUP_LIMIT)} weekly free cleanup emails.
                </div>
              </div>

              <div className="rounded-[22px] border border-[#dce6f7] bg-gradient-to-br from-[#f8fbff] to-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mb-2 text-[13px] font-bold uppercase tracking-[0.08em] text-[#7b87a3]">
                  Current plan
                </div>
                <div className="text-[34px] font-extrabold leading-none text-[#2563eb]">
                  {PLAN === "pro" ? "Pro" : "Free"}
                </div>
                <div className="mt-3 text-sm text-[#6b7895]">
                  Upgrade to unlock full inbox cleanup, unlimited actions, and better scan depth.
                </div>
              </div>
            </div>
          </div>

          {/* MODERN INFO BOX */}
          <div className="mb-6 rounded-[20px] border border-[#fed7aa] bg-[#fffaf4] px-5 py-4">
            <div className="text-[18px] font-extrabold text-[#b45309]">
              {formatNumber(totalPromotions)} promotions detected
            </div>
            <div className="mt-2 text-[15px] leading-7 text-[#c26b17]">
              Based on Gmail’s Promotions classification in your sample scan. You can clean up to{" "}
              <span className="font-bold">{formatNumber(cleanupLeft)}</span> more promotion emails on the free plan this week.
            </div>
          </div>

          {/* FILTER BAR */}
          <div className="mb-5 rounded-[22px] border border-[#d9e1f2] bg-[#fbfcff] p-4 md:p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
              <div className="relative flex-1">
                <span className="pointer-events-none absolute left-5 top-1/2 -translate-y-1/2 text-[21px] text-[#6b7895]">
                  🔍
                </span>
                <input
                  type="text"
                  placeholder="Search promotions by sender or email address"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-[56px] w-full rounded-[16px] border border-[#cdd7eb] bg-white pl-14 pr-4 text-[16px] font-medium text-[#14213d] outline-none transition focus:border-[#2563eb]"
                />
              </div>

              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="h-[56px] min-w-[220px] rounded-[16px] border border-[#cdd7eb] bg-white px-5 text-[16px] font-semibold text-[#1d4ed8] outline-none"
              >
                <option value="all">All promotions</option>
                <option value="unsubscribe">Has unsubscribe</option>
                <option value="no-unsubscribe">No unsubscribe</option>
                <option value="50plus">50+ emails</option>
                <option value="10plus">10+ emails</option>
              </select>

              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="h-[56px] min-w-[220px] rounded-[16px] border border-[#cdd7eb] bg-white px-5 text-[16px] font-semibold text-[#1d4ed8] outline-none"
              >
                <option value="desc">🔥 Most emails first</option>
                <option value="asc">Least emails first</option>
                <option value="az">A–Z</option>
                <option value="za">Z–A</option>
              </select>

              <div className="inline-flex h-[56px] items-center justify-center rounded-[16px] border border-[#d9e1f2] bg-white px-5 text-[16px] font-semibold text-[#6b7895]">
                {filteredData.length} of {promotionsData.length} senders
              </div>
            </div>
          </div>

          {/* EMPTY STATE */}
          {!loading && promotionsData.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-[#d7e2f3] bg-[#fbfcff] px-6 py-12 text-center">
              <div className="text-[26px] font-extrabold text-[#14213d]">
                No promotions found
              </div>
              <div className="mx-auto mt-3 max-w-[620px] text-[16px] leading-7 text-[#6b7895]">
                Your latest sample scan did not find promotion senders to review here yet. Run another scan later or upgrade for deeper inbox coverage.
              </div>
              <div className="mt-6 flex justify-center gap-3">
                <button className="inline-flex h-[52px] items-center justify-center rounded-[14px] bg-[#2563eb] px-5 text-[15px] font-bold text-white">
                  Run New Sample Scan
                </button>
                <button className="inline-flex h-[52px] items-center justify-center rounded-[14px] border border-[#bfd0fb] bg-white px-5 text-[15px] font-bold text-[#2563eb]">
                  Upgrade to Pro
                </button>
              </div>
            </div>
          )}

          {/* NO RESULTS STATE */}
          {!loading && promotionsData.length > 0 && filteredData.length === 0 && (
            <div className="rounded-[24px] border border-dashed border-[#d7e2f3] bg-[#fbfcff] px-6 py-10 text-center">
              <div className="text-[24px] font-extrabold text-[#14213d]">
                No matching promotions found
              </div>
              <div className="mx-auto mt-3 max-w-[560px] text-[16px] leading-7 text-[#6b7895]">
                Try a different search or clear the current filters to see your full promotion sender list again.
              </div>
              <button
                onClick={clearFilters}
                className="mt-5 inline-flex h-[50px] items-center justify-center rounded-[14px] border border-[#bfd0fb] bg-white px-5 text-[15px] font-bold text-[#2563eb]"
              >
                Clear filters
              </button>
            </div>
          )}

          {/* TABLE */}
          {!loading && filteredData.length > 0 && (
            <div className="overflow-hidden rounded-[24px] border border-[#d9e1f2] bg-white">
              <div className="grid grid-cols-12 border-b border-[#d9e1f2] bg-[#f7f9fd] px-6 py-5 text-[15px] font-bold uppercase tracking-[0.04em] text-[#6b7895]">
                <div className="col-span-6">Sender</div>
                <div className="col-span-2 text-center">Emails</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>

              {filteredData.map((row, index) => {
                const busy = isRowBusy(row)
                const unsubLoading = activeActionKey === `${row.id}-unsubscribe`
                const trashLoading = activeActionKey === `${row.id}-trash`
                const archiveLoading = activeActionKey === `${row.id}-archive`

                return (
                  <div
                    key={row.id}
                    className={`grid grid-cols-12 items-center px-6 py-4 transition hover:bg-[#fbfdff] ${
                      index !== filteredData.length - 1
                        ? "border-b border-[#edf2fb]"
                        : ""
                    } ${busy ? "opacity-80" : ""}`}
                  >
                    <div className="col-span-6 flex items-center gap-4">
                      <SenderLogo sender={row.sender} domain={row.domain} />

                      <div className="min-w-0">
                        <div className="truncate text-[22px] font-extrabold tracking-[-0.02em] text-[#14213d]">
                          {row.sender}
                        </div>

                        <div className="mt-1 truncate text-[15px] font-medium text-[#7b87a3]">
                          {row.domain || "No domain available"}
                        </div>
                      </div>
                    </div>

                    <div className="col-span-2 text-center text-[20px] font-extrabold text-[#14213d]">
                      {formatNumber(row.emails)}
                    </div>

                    <div className="col-span-4 flex justify-end gap-3">
                      {row.unsubscribable ? (
                        <button
                          onClick={() => handleUnsubscribe(row)}
                          disabled={busy || cleanAllLoading}
                          className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#99f6e4] bg-white px-5 text-[15px] font-bold text-[#0f766e] transition hover:bg-[#f0fdfa] disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {unsubLoading ? "Working..." : "Unsubscribe"}
                        </button>
                      ) : (
                        <button
                          disabled
                          className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#d9e1f2] bg-[#f8fafc] px-5 text-[15px] font-bold text-[#94a3b8] cursor-not-allowed"
                        >
                          Unsubscribed
                        </button>
                      )}

                      <button
                        onClick={() => handleTrash(row)}
                        disabled={busy || cleanAllLoading}
                        className="inline-flex h-[48px] items-center justify-center rounded-[14px] bg-[#ef4444] px-5 text-[15px] font-bold text-white shadow-[0_10px_20px_rgba(239,68,68,0.18)] transition hover:bg-[#dc2626] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {trashLoading ? "Moving..." : "Move to Trash"}
                      </button>

                      <button
                        onClick={() => handleArchive(row)}
                        disabled={busy || cleanAllLoading}
                        className="inline-flex h-[48px] items-center justify-center rounded-[14px] border border-[#bfd0fb] bg-white px-5 text-[15px] font-bold text-[#2563eb] transition hover:bg-[#f8fbff] disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {archiveLoading ? "Archiving..." : "Archive"}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* LOADING */}
          {loading && (
            <div className="rounded-[24px] border border-[#d9e1f2] bg-white px-6 py-12 text-center text-[17px] font-semibold text-[#6b7895]">
              Loading promotions...
            </div>
          )}

          {/* FOOTER HELPER TEXT */}
          {!loading && promotionsData.length > 0 && (
            <div className="mt-5 flex flex-col gap-2 text-sm text-[#6b7895] md:flex-row md:items-center md:justify-between">
              <div>
                Based on your latest {formatNumber(SAMPLE_SIZE)}-email sample scan.
              </div>
              <div>
                Cleanup used this week:{" "}
                <span className="font-bold text-[#14213d]">
                  {formatNumber(cleanupUsedThisWeek)}/{formatNumber(CLEANUP_LIMIT)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}