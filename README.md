<p align="center">
  <img src="public/graphics/orca%20ai%202.png" width="128" alt="Orcha AI Logo" />
</p>

# Orcha AI / Orcha Agent OS 🌌

**The Semantic Operating System for Multi-Tenant AI Agents**

Orcha Agent OS is a next-generation platform designed to bridge the gap between raw data warehouses and intelligent AI agents. Inspired by semantic modeling, Orcha provides a robust, multi-tenant infrastructure to transform your database into a context-aware knowledge base, accessible via the **Model Context Protocol (MCP)**.

---

## 🚀 Vision

In the age of LLMs, the biggest challenge isn't just generating SQL; it's understanding the *business meaning* behind the data. Orcha Agent OS provides a **Semantic Bridge** that allows organizations to map their database catalogs into clear business concepts, ensuring that AI agents provide accurate, governed, and insightful answers every time.

https://www.orcha-solutions.com/os/chat.mp4

## ✨ Key Features

- **🧠 Semantic Bridge & ModelingWizard**: Map complex schemas to business concepts, define calculated virtual columns (e.g. `revenue = price * quantity`), and configure relationships using a guided wizard or interactive React Flow schema editor.
- **🦀 Rust Semantic Engine (WASM-powered)**: On-the-fly SQL transpilation powered by an embedded Rust-based planning engine using Apache DataFusion. Transpiles virtual columns into physical dialect queries with sub-second latency.
- **🔌 Dialect-Specific Unparsing**: Automatically translates and unparses semantic SQL queries into native database dialects (MySQL, PostgreSQL, SQLite, etc.) depending on the connected target database.
- **⛓️ Automatic Join Pathing**: Automatically detects missing join conditions in queries by traversing the relationship graph via BFS and injects ANSI SQL `JOIN` clauses dynamically before execution.
- **🌐 Federated Multi-Database Execution**: Query, join, and visualize data across multiple databases simultaneously using an intuitive `alias.table` reference syntax.
- **🔑 Developer Portal & Multi-Database API Keys**: Expose your semantic databases as a secure API. Supports assigning multiple databases per API key with Mantine MultiSelect interfaces and dynamic database context fallbacks in `/api/chat`.
- **🔌 MCP Native**: Expose your semantic models instantly to LLMs via the Model Context Protocol.
- **🛡️ Secure Connectivity**: Built-in support for PostgreSQL, MySQL, SQLite, and MSSQL.
- **⚡ Real-time Reactive Flows**: Powered by Convex for real-time reactivity, vector search embeddings (RAG), and memory recall.

## 🛠️ Tech Stack

- **Frontend**: [Next.js 16](https://nextjs.org/) (App Router), [Mantine UI](https://mantine.dev/), [Tailwind CSS 4](https://tailwindcss.com/)
- **Backend / DB**: [Convex](https://www.convex.dev/) (Deployment, Database, Actions, Vector Search)
- **Auth**: [Clerk](https://clerk.dev/)
- **Visual Mapping**: [React Flow](https://reactflow.dev/)
- **Protocol**: [Model Context Protocol (MCP)](https://modelcontextprotocol.io/)
- **Execution & Transpilation**: Rust WebAssembly, Apache DataFusion
- **Data Drivers**: Prisma, BullMQ, Redis, PostgreSQL, MySQL, SQLite, MSSQL

## 🚦 Getting Started

### Prerequisites

- Node.js 20+
- pnpm / npm
- A Convex account
- A Clerk account

### Installation

```bash
# Clone the repository
git clone https://github.com/your-repo/orcha-agent-os.git

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local

# Run Convex development
npm run convex:dev

# Run Next.js app
npm run dev
```

---
