# Orcha Agent OS

A modern full-stack starter template combining **Next.js 16**, **shadcn UI**, and **Convex**.

## 🎯 Features

- **Next.js 16** with App Router and TypeScript
- **Tailwind CSS** for utility-first styling
- **shadcn UI** preconfigured for beautiful, customizable components
- **Convex** for real-time backend with built-in authentication
- **ESLint** configured for code quality

## 🚀 Quick Start (Self-Hosted)

This project is configured to run on a **Self-Hosted Convex** instance via Docker.

### 1. Windows Environment Setup (PowerShell Only)
If you are on Windows, you must allow script execution to use `npx` properly:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2. Launch Infrastructure
Start the database (MySQL) and the Convex Backend/Dashboard:
```bash
docker-compose up -d
```
*Wait for the containers to become healthy (approx 30 seconds).*

### 3 Generate Local Admin Key
Run the following command to generate a local admin key for your self-hosted instance:
```bash
docker compose exec backend ./generate_admin_key.sh
```
*Copy the generated key for use in the next step.*

### 4. Install Dependencies & Drivers
You must install the database drivers (not included by default) to enable the Bridge:
```bash
npm install
npm install mysql2 pg
```

### 5. Start Convex Sync
Run the development sync against your local instance. **Do not use the standard `npx convex dev`** as it defaults to the cloud:
```powershell
# Use npx.cmd on Windows to bypass .ps1 restrictions
npx.cmd convex dev --url http://localhost:3210 --admin-key "convex-self-hosted|01204f53c7b09a60cdd9975785ec0ce915b75dcef849ac14185aa49edbd5f302c9298c0274"
```

### 6. Run Next.js
In a separate terminal:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## 🌉 AI Bridge Configuration
The Agent OS acts as a bridge between your local databases and your models.

- **Slug Resolution**: The system automatically resolves organization slugs (from the URL) into internal Convex IDs. Ensure you use `api.organizations.getSafeBySlug` when building pages.
- **MCP Route**: The core MCP tool interface is located at `/api/mcp/route.ts`. It handles authorization and just-in-time database credential resolution.

## 📦 Project Structure

```
├── app/                  # Next.js app directory
│   ├── layout.tsx       # Root layout with Convex provider
│   ├── page.tsx         # Home page
│   └── providers.tsx    # Convex client provider
├── components/          # shadcn UI components
├── convex/             # Convex backend functions
│   ├── schema.ts       # Database schema
│   └── messages.ts     # Example functions
├── lib/                # Utility functions
│   └── utils.ts        # shadcn cn() utility
└── public/             # Static files
```

## ⚡ Convex Basics

### Query Example

```typescript
// convex/messages.ts
export const list = query({
  handler: async (ctx) => {
    return await ctx.db.query("messages").collect();
  },
});
```

### Mutation Example

```typescript
export const send = mutation({
  args: {
    body: v.string(),
    author: v.string(),
  },
  async handler(ctx, args) {
    return await ctx.db.insert("messages", args);
  },
});
```

### Use in React Components

```typescript
"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

export default function Messages() {
  const messages = useQuery(api.messages.list);
  const send = useMutation(api.messages.send);

  return (
    <div>
      {messages?.map((msg) => (
        <div key={msg._id}>{msg.body}</div>
      ))}
    </div>
  );
}
```

## 📚 Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [Convex Documentation](https://docs.convex.dev)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS](https://tailwindcss.com)

## 📝 Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run convex:dev` - Start Convex development server
- `npm run convex:deploy` - Deploy Convex to production

## 🛠 Customization

### Add shadcn Components

```bash
npx shadcn@latest add [component-name]
```

### Add Convex Tables

Edit `convex/schema.ts` to define your tables and run:

```bash
npm run convex:dev
```

## 🦀 Rust WASM Engine Compilation

The core query transpilation engine is built in Rust and compiled to WebAssembly (WASM). This binary parses queries, resolves virtual/calculated columns, and translates them to native database dialects (MySQL, Postgres, SQLite, MSSQL).

If you make modifications to the Rust files under `orcha-rust-engine/src/`, or are running a fresh `git clone`, you must compile the WASM binary.

### Prerequisites

1. **Install Rust**:
   Ensure you have Rust and `cargo` installed. If not, install via [rustup](https://rustup.rs/):
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. **Install `wasm-pack`**:
   `wasm-pack` compiles Rust code into WebAssembly packages suitable for Node.js.
   ```bash
   cargo install wasm-pack
   ```

### Building & Deploying the WASM Binary

1. **Build the crate**:
   From the repository root, run the compilation script:
   ```bash
   cd orcha-rust-engine
   wasm-pack build --target nodejs
   ```
   This compiles the project and generates WebAssembly bindings in `orcha-rust-engine/pkg/`.

2. **Copy to the application**:
   Since Next.js accesses the WASM engine from `lib/wasm-engine/` (which is ignored by Git), you must copy the generated build outputs:
   ```bash
   # From the repository root
   mkdir -p lib/wasm-engine
   cp orcha-rust-engine/pkg/orcha_semantic_engine_bg.wasm lib/wasm-engine/
   cp orcha-rust-engine/pkg/orcha_semantic_engine.js lib/wasm-engine/
   cp orcha-rust-engine/pkg/orcha_semantic_engine.d.ts lib/wasm-engine/
   ```

3. **Verify the installation**:
   Verify everything compiles and passes tests:
   ```bash
   npm run test
   ```

## 📄 License

MIT

