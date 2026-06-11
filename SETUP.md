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

### 5b. Set Up Convex Environment Variables (CRITICAL)
Before running the application, you must configure both the database encryption key and the Clerk issuer domain inside your Convex environment. If you skip this, Convex will fail to authenticate requests or decrypt your stored database credentials.

In a separate terminal, run:
```bash
# 1. Set the database credentials encryption key
npx convex env set ENCRYPTION_KEY "7;RUp1Y+R.1>N.(hqs_C[RnO5pL#46zj" --url http://localhost:3210 --admin-key "convex-self-hosted|YOUR_ADMIN_KEY"

# 2. Set the Clerk issuer domain (matches CLERK_ISSUER_DOMAIN in .env)
npx convex env set CLERK_ISSUER_DOMAIN "https://divine-sturgeon-6.clerk.accounts.dev" --url http://localhost:3210 --admin-key "convex-self-hosted|YOUR_ADMIN_KEY"
```

> 🛠️ **Windows Troubleshooting (Pipe Escaping Error):**
> On Windows PowerShell/CMD, running the above command might throw an error like `'{key_part}' is not recognized as an internal or external command` because of the pipe character (`|`) in the admin key.
> You can bypass this by invoking the Convex CLI directly via Node:
> ```powershell
> node node_modules\convex\bin\main.js env set ENCRYPTION_KEY "7;RUp1Y+R.1>N.(hqs_C[RnO5pL#46zj" --url "http://localhost:3210" --admin-key "convex-self-hosted|YOUR_ADMIN_KEY"
> node node_modules\convex\bin\main.js env set CLERK_ISSUER_DOMAIN "https://divine-sturgeon-6.clerk.accounts.dev" --url "http://localhost:3210" --admin-key "convex-self-hosted|YOUR_ADMIN_KEY"
> ```


### 6. Run Next.js
In a separate terminal:
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

## 📊 Observability (Grafana + Prometheus)

The API routes are instrumented with Prometheus metrics (request rate, latency, error rate). Prometheus scrapes them and Grafana visualizes them. Both run as part of the Docker stack.

### 1. Start the monitoring stack
The `prometheus` and `grafana` services are defined in `docker-compose.yml`, so `docker-compose up -d` (from the Quick Start) already starts them. To start just these:
```bash
docker-compose up -d prometheus grafana
```

### 2. Make sure the app is exposing metrics
With the Next.js app running (`npm run dev` on port 3000), the metrics endpoint is live at:
```
http://localhost:3000/api/metrics
```
Prometheus scrapes this every 15s via `host.docker.internal:3000` (configured in `monitoring/prometheus.yml`).

### 3. Open Grafana
Grafana is mapped to host port **3001** (container 3000 is remapped to avoid clashing with Next.js):
```
http://localhost:3001
```
Default login is `admin` / `admin`. Override via env vars before starting the stack:
```bash
# .env
GRAFANA_ADMIN_USER=admin
GRAFANA_ADMIN_PASSWORD=change-me
```
The **Orcha API Routes** dashboard (request rate, p95 latency, 5xx rate, error ratio, total RPS, memory) is provisioned automatically — no manual import needed.

### 4. Verify the scrape
Confirm Prometheus is collecting from the app at [http://localhost:9090/targets](http://localhost:9090/targets) — the `orcha-api` target should be **UP**.

> **Note:** The scrape target assumes the Next.js app runs on the **host** (`host.docker.internal:3000`). If you containerize the app, update the target in `monitoring/prometheus.yml` to the service name.
>
> **Optional:** Lock down `/api/metrics` by setting `METRICS_AUTH_TOKEN` in the app's environment, then add the matching `authorization` block in `monitoring/prometheus.yml`.

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

### 🛠️ Troubleshooting Windows Compilation (GNU Linker Errors)

If compiling on Windows using the default GNU toolchain, you may encounter the following error:
```text
error: linking with `x86_64-w64-mingw32-gcc` failed: exit code: 1
note: lld: error: unable to find library -lgcc_eh
      lld: error: unable to find library -lgcc
```

This occurs when the host build scripts (like `proc-macro2` or `quote`) fail to compile because GCC cannot locate its core standard libraries. You can resolve this using one of the following methods:

#### Option A: Switch to MSVC Toolchain (Recommended)
This uses Microsoft Visual Studio's C++ Build Tools and avoids MinGW linking bugs entirely:
1. Download and install the **[Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)** (ensure the **Desktop development with C++** workload is checked).
2. Set MSVC as your default Rust toolchain:
   ```powershell
   rustup default stable-x86_64-pc-windows-msvc
   ```
3. Run `cargo clean` and rebuild:
   ```powershell
   cd orcha-rust-engine
   cargo clean
   wasm-pack build --target nodejs
   ```

#### Option B: Configure LLVM-MinGW (Clang-based) Toolchain Workaround
If you are using the WinGet-provided **LLVM-MinGW** toolchain (`MartinStorsjo.LLVM-MinGW`), it does not ship with `libgcc.a` or `libgcc_eh.a` by default, causing Rust's GNU target to fail linking. You can map them to LLVM's builtins and unwind libraries:

1. Create a directory for compatibility libraries:
   ```powershell
   New-Item -ItemType Directory -Force -Path orcha-rust-engine/dummy_libs
   ```
2. Copy LLVM-MinGW's builtins and unwind libraries to this directory, renaming them to `libgcc.a` and `libgcc_eh.a` respectively:
   ```powershell
   # Copy Clang builtins to libgcc.a
   Copy-Item -Force "$env:USERPROFILE\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260519-ucrt-x86_64\lib\clang\22\lib\windows\libclang_rt.builtins-x86_64.a" orcha-rust-engine/dummy_libs/libgcc.a

   # Copy libunwind to libgcc_eh.a
   Copy-Item -Force "$env:USERPROFILE\AppData\Local\Microsoft\WinGet\Packages\MartinStorsjo.LLVM-MinGW.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe\llvm-mingw-20260519-ucrt-x86_64\x86_64-w64-mingw32\lib\libunwind.a" orcha-rust-engine/dummy_libs/libgcc_eh.a
   ```
3. Set the `LIBRARY_PATH` environment variable to this folder and compile the WASM binary:
   ```powershell
   $env:LIBRARY_PATH = "C:\repos\orcha-agent-os\orcha-rust-engine\dummy_libs"
   wasm-pack build --target nodejs
   ```

## 📄 License

MIT

