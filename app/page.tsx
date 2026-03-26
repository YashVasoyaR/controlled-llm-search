"use client";

import { useState } from "react";

interface UsageData {
  totalTokens?: number;
  fullContextProcessingTokens?: number;
  queryUnderstandingTokens?: number;
  responseGenerationTokens?: number;
}

interface LatencyData {
  totalMs?: number;
  extractMs?: number;
  filterMs?: number;
  fullContextProcessingMs?: number;
  queryUnderstandingMs?: number;
  responseGenerationMs?: number;
  cacheHitMs?: number;
}

interface ApiResponse {
  query: string;
  finalAnswer: string;
  results?: Array<{
    name?: string;
    title?: string;
    price?: number;
    rate?: number;
    currency?: string;
  }>;
  usage: UsageData;
  latency: LatencyData;
  cached?: boolean;
  cache?: {
    type: "query" | "intent" | "none";
  };
  filters?: Record<string, unknown>;
  type?: string;
  source?: string;
  meta?: {
    totalItems?: number;
    filteredItems?: number;
    sentToLLM?: number;
  };
}

export default function SearchDemo() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [optimized, setOptimized] = useState<ApiResponse | null>(null);
  const [baseline, setBaseline] = useState<ApiResponse | null>(null);
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
        throw new Error("API request failed");
      }

      const optimizedData: ApiResponse = await optimizedRes.json();
      const baselineData: ApiResponse = await baselineRes.json();

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
    let latencyImprovement = 0;

    if (baselineLatency) {
      latencyImprovement =
        ((baselineLatency - optimizedLatency) / baselineLatency) * 100;
    }

    const latencyLabel =
      latencyImprovement >= 0
        ? `${latencyImprovement.toFixed(1)}% faster`
        : `${Math.abs(latencyImprovement).toFixed(1)}% slower`;

    return { tokenReduction, latencyImprovement, latencyLabel };
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
          <div className="flex gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleSearch()}
              placeholder="Hotels in Goa under 5000 with pool"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-zinc-800 placeholder:text-zinc-400"
              disabled={loading}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium cursor-pointer"
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

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 text-center">
                    <p className="text-blue-700 text-sm font-medium">
                      Faster Response
                    </p>
                    <p className="text-2xl font-bold text-blue-600">
                      {improvement.latencyLabel}
                    </p>
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
