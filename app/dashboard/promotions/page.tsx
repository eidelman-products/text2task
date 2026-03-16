"use client"

import { useEffect, useMemo, useState } from "react"

type PromotionRow = {
  id: string
  sender: string
  emails: number
  domain?: string
  unsubscribable?: boolean
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
    <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-[14px] border border-[#d9e1f2] bg-white shadow-sm">

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

export default function PromotionsPage() {

  const [promotionsData, setPromotionsData] = useState<PromotionRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {

    async function loadPromotions() {

      try {

        const res = await fetch("/api/gmail/senders")

        if (!res.ok) {
          throw new Error("API failed")
        }

        const data = await res.json()

        setPromotionsData(data.senders || [])

      } catch (err) {

        console.error("Failed loading senders", err)

      } finally {

        setLoading(false)

      }

    }

    loadPromotions()

  }, [])

  const foundInSample = 1000

  const totalInInbox = promotionsData.reduce(
    (sum, row) => sum + row.emails,
    0
  )

  const freePlanLeftThisWeek = 197
  const cleanupUsedThisWeek = 53
  const cleanupLimit = 250

  const cleanNowCount = useMemo(() => {
    return Math.min(totalInInbox, freePlanLeftThisWeek)
  }, [totalInInbox])

  return (
    <div className="min-h-screen bg-[#f7f8fc] px-6 py-8 md:px-10">

      <div className="mx-auto max-w-[1400px]">

        <div className="rounded-[28px] border border-[#d9e1f2] bg-white px-6 py-6 shadow-[0_10px_30px_rgba(31,41,55,0.05)] md:px-10 md:py-8">

          <h1 className="text-4xl font-bold text-[#14213d] mb-6">
            Promotions
          </h1>

          <div className="mb-6 flex gap-4">

            <button className="inline-flex h-[58px] items-center justify-center rounded-[16px] bg-[#2563eb] px-7 text-[18px] font-bold text-white">
              Clean {cleanNowCount} Promotions
            </button>

            <button className="inline-flex h-[58px] items-center justify-center rounded-[16px] border border-[#cdd7eb] bg-white px-7 text-[18px] font-bold text-[#2563eb]">
              Upgrade to Pro
            </button>

          </div>

          <div className="overflow-hidden rounded-[22px] border border-[#d9e1f2] bg-white">

            <div className="grid grid-cols-12 border-b border-[#d9e1f2] bg-[#f5f7fc] px-6 py-5 text-[17px] font-semibold text-[#465377]">
              <div className="col-span-6">Sender</div>
              <div className="col-span-2 text-center">Emails</div>
              <div className="col-span-4 text-right">Actions</div>
            </div>

            {loading && (
              <div className="p-6 text-center text-gray-500">
                Loading senders...
              </div>
            )}

            {!loading &&
              promotionsData.map((row, index) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-12 items-center px-6 py-4 ${
                    index !== promotionsData.length - 1
                      ? "border-b border-[#e5ebf7]"
                      : ""
                  }`}
                >
                  <div className="col-span-6 flex items-center gap-4">

                    <SenderLogo
                      sender={row.sender}
                      domain={row.domain}
                    />

                    <div className="min-w-0">

                      <div className="truncate text-[20px] font-bold text-[#14213d]">
                        {row.sender}
                      </div>

                      {row.domain && (
                        <div className="mt-1 text-sm text-[#7b87a3]">
                          {row.domain}
                        </div>
                      )}

                    </div>

                  </div>

                  <div className="col-span-2 text-center text-[20px] font-bold text-[#14213d]">
                    {row.emails}
                  </div>

                  <div className="col-span-4 flex justify-end gap-3">

                    <button className="h-[48px] rounded-[14px] bg-[#ef4444] px-6 text-white font-bold">
                      Move to Trash
                    </button>

                    <button className="h-[48px] rounded-[14px] border px-5 font-bold">
                      Archive
                    </button>

                    <button
                      className={`h-[48px] rounded-[14px] border px-5 font-bold ${
                        row.unsubscribable
                          ? "text-blue-600"
                          : "text-gray-400 cursor-not-allowed"
                      }`}
                      disabled={!row.unsubscribable}
                    >
                      Unsubscribe
                    </button>

                  </div>

                </div>
              ))}

          </div>

          <div className="mt-6 text-sm text-[#6b7895]">
            Showing the first 1000 inbox emails analyzed
          </div>

          <div className="mt-2 text-sm text-[#6b7895]">
            Weekly cleanup used:{" "}
            <b>
              {cleanupUsedThisWeek}/{cleanupLimit}
            </b>
          </div>

        </div>

      </div>

    </div>
  )
}
