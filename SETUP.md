# Orcha Agent OS

A modern full-stack starter template combining **Next.js 16**, **shadcn UI**, and **Convex**.

## 🎯 Features

- **Next.js 16** with App Router and TypeScript
- **Tailwind CSS** for utility-first styling
- **shadcn UI** preconfigured for beautiful, customizable components
- **Convex** for real-time backend with built-in authentication
- **ESLint** configured for code quality

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Convex

```bash
npm run convex:dev
```

This will:
- Start the Convex development server
- Create a new Convex project
- Generate your deployment URL

### 3. Configure Environment

Copy your Convex deployment URL to `.env.local`:

```env
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

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

## 🎨 Using shadcn UI

Add components with:

```bash
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add input
```

See [shadcn/ui docs](https://ui.shadcn.com) for available components.

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

## 📄 License

MIT
