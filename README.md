# 🚀 Controlled LLM Search System

## ⚡ What This System Demonstrates

- 🔻 **70–100% reduction in LLM tokens**
- ⚡ **Up to ~99% latency reduction** using caching (~5ms, 0 tokens)
- 🧠 LLM used **only for intent extraction**
- ⚙️ Deterministic filtering & ranking outside LLM
- 📦 Multi-layer caching to eliminate unnecessary LLM calls

---

## 📌 Problem

Most LLM-based applications follow a naive pattern:

- Send full datasets to the LLM
- Let the model handle filtering and reasoning

This leads to:

- High token usage
- Increased cost
- Slow response times
- Poor scalability

---

## 💡 Solution

This system introduces a **controlled LLM pipeline**:

1. **Intent Extraction (LLM)**
   Convert natural language → structured filters

2. **Deterministic Filtering (Backend)**
   Apply filters without using LLM

3. **Ranking Logic**
   Prioritize relevant results deterministically

4. **Multi-layer Caching**
   - Query cache → skip LLM entirely
   - Intent cache → reuse filtered results

---

## 🧠 Architecture

```
User Query
   ↓
Query Cache (exact match → skip LLM)
   ↓ (miss)
LLM (Intent Extraction ONLY)
   ↓
Backend Filtering + Ranking (Deterministic)
   ↓
Return Response
   ↓
Store in Cache
```

---

## 📊 Performance Impact

| Scenario          | Tokens  | Latency  |
| ----------------- | ------- | -------- |
| Standard Approach | 700–900 | ~1500 ms |
| Optimized System  | 100–200 | ~600 ms  |
| Cached (repeat)   | 0       | ~5 ms    |

### Key Insight

Performance gains come from:

- Reducing data sent to the LLM
- Eliminating LLM calls entirely on cache hits

---

## 🖥️ Demo UI

The system provides a **side-by-side comparison**:

- Standard vs Optimized approach
- Token usage
- Latency
- Cache behavior (instant vs LLM execution)

### Example Flow

- First request → LLM used
- Second request → ⚡ instant (0 tokens, ~5ms)

---

## 🛠️ Tech Stack

- Next.js (App Router)
- OpenRouter (LLM access)
- OpenAI-compatible APIs
- Tailwind CSS
- Node.js

---

## 📂 Project Structure

```
app/
 ├── api/
 │    ├── search/              # Optimized pipeline
 │    ├── baseline-search/     # Standard approach
 │
 ├── page.tsx                 # Demo UI
```

---

## 🎯 Core Principle

LLMs should be used for:

- Understanding intent
- Extracting structured meaning

NOT for:

- Filtering datasets
- Acting as databases

---

## 🧠 Key Takeaway

Efficient LLM systems are not about using more AI —

They are about:

> **Using LLMs only where they add value, and removing them everywhere else.**

---

## 👤 Author

Yash Vasoya
Full-Stack Engineer | AI & LLM Systems
