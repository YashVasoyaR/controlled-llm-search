"use client";

import { useEffect, useRef, useState } from "react";
import type { ComparisonApiResponse } from "@/types/comparison";

function LatencyInfoIcon({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [text]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="relative inline-flex shrink-0" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-full p-1 text-gray-500 transition-colors hover:bg-gray-200/80 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        aria-expanded={open}
        aria-controls="latency-info-popover"
        aria-label="Why this latency result"
      >
        <svg
          className="h-5 w-5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      </button>
      {open && (
        <div
          id="latency-info-popover"
          role="region"
          aria-label="Latency explanation"
          className="absolute left-1/2 top-full z-30 mt-2 w-[min(18rem,calc(100vw-2rem))] -translate-x-1/2 rounded-lg border border-gray-200 bg-white p-3 text-left text-xs leading-snug text-gray-700 shadow-lg ring-1 ring-black/5"
        >
          {text}
        </div>
      )}
    </div>
  );
}

export default function SearchDemo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimized, setOptimized] = useState<ComparisonApiResponse | null>(null);
  const [baseline, setBaseline] = useState<ComparisonApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCached = optimized?.cached === true;
  const cacheType = optimized?.cache?.type || "none";

  const formatCurrency = (amount: number, currency = "INR") => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
    }).format(amount);
  };
  const handleSearch = async () => {
    if (!query.trim()) {
      setError("Please enter a search query");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Call both APIs in parallel
      const [optimizedRes, baselineRes] = await Promise.all([
        fetch("/api/search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }),
        fetch("/api/baseline-search", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query }),
        }),
      ]);

      if (!optimizedRes.ok || !baselineRes.ok) {
        throw new Error("LLM execution is currently disabled in this public demo.");
      }

      const optimizedData: ComparisonApiResponse = await optimizedRes.json();
      const baselineData: ComparisonApiResponse = await baselineRes.json();

      setOptimized(optimizedData);
      setBaseline(baselineData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An error occurred during search",
      );
      setOptimized(null);
      setBaseline(null);
    } finally {
      setLoading(false);
    }
  };

  const calculateImprovement = () => {
    if (!baseline || !optimized) return null;

    const baselineTokens =
      baseline.usage?.fullContextProcessingTokens ||
      baseline.usage?.totalTokens ||
      0;
    const optimizedTokens = optimized.usage?.totalTokens || 0;
    const tokenReduction = baselineTokens
      ? (((baselineTokens - optimizedTokens) / baselineTokens) * 100).toFixed(1)
      : 0;

    const baselineLatency =
      baseline.latency?.fullContextProcessingMs ||
      baseline.latency?.totalMs ||
      0;
    const optimizedLatency = optimized.latency?.totalMs || 0;
    const latencyDiff = optimizedLatency - baselineLatency;

    let latencyLabel = "";
    let latencyColor = "";
    let latencyType: "faster" | "slower" | "same" | "na" = "na";

    if (baselineLatency === 0) {
      latencyLabel = "N/A";
      latencyColor = "text-gray-600";
      latencyType = "na";
    } else {
      const percent = Math.abs(
        (latencyDiff / baselineLatency) * 100,
      ).toFixed(1);

      if (latencyDiff < 0) {
        latencyType = "faster";
        latencyLabel = `${percent}% faster`;
        latencyColor = "text-green-600";
      } else if (latencyDiff > 0) {
        latencyType = "slower";
        latencyLabel = `${percent}% slower`;
        latencyColor = "text-red-600";
      } else {
        latencyType = "same";
        latencyLabel = "No change";
        latencyColor = "text-gray-600";
      }
    }

    let latencyReason = "";

    if (latencyType === "slower") {
      if (optimizedTokens === 0) {
        latencyReason =
          "Cache hit: latency is minimal but baseline comparison includes full LLM execution.";
      } else {
        latencyReason =
          "Includes LLM intent extraction step. Using slower/free model may increase latency.";
      }
    } else if (latencyType === "faster") {
      latencyReason = "Reduced data sent to LLM improves response time.";
    }

    return { tokenReduction, latencyLabel, latencyColor, latencyType, latencyReason };
  };

  const improvement = calculateImprovement();

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Controlled LLM Search System
          </h1>
          <p className="text-gray-600">
            Reducing token usage and latency with deterministic architecture
          </p>
        </div>

        {/* Search Input Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
              placeholder="Hotels in Goa under 5000 with pool"
              className="min-w-0 w-full flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-800 placeholder:text-zinc-400"
              disabled={loading}
            />
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading}
              className="w-full shrink-0 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer sm:w-auto whitespace-nowrap"
            >
              {loading ? "Searching..." : "Run Comparison"}
            </button>
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-3 bg-red-50 p-2 rounded">
              {error}
            </p>
          )}
        </div>

        {/* Results */}
        {optimized && baseline && (
          <div className="space-y-6">
            {/* Cache Status Badge */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isCached ? "bg-green-500" : "bg-blue-500"
                  }`}
                ></div>
                <span className="font-medium text-gray-900">
                  {isCached
                    ? "⚡ Instant response (LLM skipped via cache)"
                    : "Fresh LLM response"}
                </span>
              </div>
            </div>

            {/* Results Section */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Search Results
              </h2>
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Answer
                </h3>
                <p className="text-gray-700 leading-relaxed">
                  {optimized.finalAnswer || "No answer generated"}
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-3">
                  Top Hotels
                </h3>
                <div className="space-y-2">
                  {optimized.results && optimized.results.length > 0 ? (
                    optimized.results.slice(0, 5).map((hotel, idx) => (
                      <div
                        key={`${idx}-${hotel.name || hotel.title}`}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded border border-gray-200"
                      >
                        <span className="text-gray-900 font-medium">
                          {hotel.name || hotel.title || `Hotel ${idx + 1}`}
                        </span>
                        <span className="text-indigo-600 font-semibold">
                          {formatCurrency(
                            hotel.price || hotel.rate || 0,
                            hotel.currency || "INR",
                          )}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-gray-600">No results available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Comparison (Card Layout) */}
            <div className="space-y-6">
              <h2 className="text-xl font-bold text-gray-900">
                Performance Comparison
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* ❌ Baseline Card */}
                <div className="bg-white rounded-lg border border-red-200 p-6">
                  <h3 className="text-lg font-semibold text-red-600 mb-4">
                    ❌ Standard Approach
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className={`justify-between ${process.env.NEXT_PUBLIC_SHOW_MODEL === "true" ? "flex" : "hidden"}`}>
                      <span className="text-gray-600">Model</span>
                      <span className="font-semibold text-gray-900">
                        {baseline.model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tokens</span>
                      <span className="font-semibold text-gray-900">
                        {baseline.usage?.fullContextProcessingTokens ||
                          baseline.usage?.totalTokens ||
                          0}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Latency</span>
                      <span className="font-semibold text-gray-900">
                        {baseline.latency?.totalMs || 0} ms
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Data to LLM</span>
                      <span className="font-semibold text-gray-900">
                        {baseline.meta?.sentToLLM ?? 0} items
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        Sends full dataset to LLM
                      </p>
                    </div>
                  </div>
                </div>

                {/* ✅ Optimized Card */}
                <div className="bg-white rounded-lg border border-green-200 p-6">
                  <h3 className="text-lg font-semibold text-green-600 mb-4">
                    ✅ Optimized System
                  </h3>

                  <div className="space-y-3 text-sm">
                    <div className={`justify-between ${process.env.NEXT_PUBLIC_SHOW_MODEL === "true" ? "flex" : "hidden"}`}>
                      <span className="text-gray-600">Model</span>
                      <span className="font-semibold text-gray-900">
                        {optimized.model}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tokens</span>
                      <span className="font-semibold text-indigo-600">
                        {optimized.usage?.totalTokens || 0}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Latency</span>
                      <span className="font-semibold text-indigo-600">
                        {optimized.latency?.totalMs || 0} ms
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-gray-600">Data to LLM</span>
                      <span className="font-semibold text-indigo-600">
                        {cacheType === "query"
                          ? 0
                          : (optimized.meta?.filteredItems ?? 0)}{" "}
                        items
                      </span>
                    </div>

                    <div className="pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {cacheType === "query"
                          ? "LLM skipped via cache"
                          : "Filtered data sent to LLM"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 🔥 Impact Summary (moved up) */}
              {improvement && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-5 text-center">
                    <p className="text-green-700 text-sm font-medium">
                      Tokens Reduced
                    </p>
                    <p className="text-2xl font-bold text-green-600">
                      {improvement.tokenReduction}%
                    </p>
                  </div>

                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-5 text-center">
                    <p className="text-gray-700 text-sm font-medium">
                      Latency Change
                    </p>
                    <div className="relative flex w-full min-w-0 items-center justify-center gap-2">
                      <p
                        className={`min-w-0 text-2xl font-bold ${improvement.latencyColor}`}
                      >
                        {improvement.latencyType === "faster" && "⚡ "}
                        {improvement.latencyType === "slower" && "⚠️ "}
                        {improvement.latencyType === "same" && "➖ "}
                        {improvement.latencyLabel}
                      </p>
                      {improvement.latencyReason && (
                        <LatencyInfoIcon text={improvement.latencyReason} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Comparison Table */}
            {/* <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                Performance Comparison
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-300">
                      <th className="text-left py-3 px-4 font-semibold text-gray-900">
                        Metric
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">
                        Baseline
                      </th>
                      <th className="text-center py-3 px-4 font-semibold text-gray-900">
                        Optimized
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        Data sent to LLM
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {baseline.meta?.sentToLLM ?? 0} items
                      </td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {optimized.meta?.filteredItems ?? 0} items
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        Tokens
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {baseline.usage?.fullContextProcessingTokens ||
                          baseline.usage?.totalTokens ||
                          0}
                      </td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {optimized.usage?.totalTokens || 0}
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        LLM Extraction:
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {baseline.latency?.totalMs || 0} ms
                      </td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {optimized.latency?.extractMs || 0} ms
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        Filtering:
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {baseline.latency?.filterMs || 0} ms
                      </td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {optimized.latency?.filterMs || 0} ms
                      </td>
                    </tr>
                    <tr className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        Total
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">
                        {baseline.latency?.totalMs || 0} ms
                      </td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {optimized.latency?.totalMs || 0} ms
                      </td>
                    </tr>
                    <tr className="hover:bg-gray-50">
                      <td className="py-3 px-4 text-gray-900 font-medium">
                        Cache Hit
                      </td>
                      <td className="text-center py-3 px-4 text-gray-700">—</td>
                      <td className="text-center py-3 px-4 text-indigo-600 font-semibold">
                        {cacheType === "query" && "⚡ Instant (LLM skipped)"}
                        {cacheType === "intent" && "🧠 Optimized (LLM used)"}
                        {cacheType === "none" && "Fresh LLM execution"}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div> */}
          </div>
        )}

        {/* Empty State */}
        {!optimized && !baseline && !loading && (
          <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
            <p className="text-gray-500 text-lg">
              Enter a search query above to get started
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
