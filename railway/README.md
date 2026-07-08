# 🌌 Deploying Orcha Agent OS to Railway

This directory contains the production service configurations for deploying the Orcha Agent OS stack to **Railway** using a 5-container architecture integrated with **Convex Cloud** for production-grade database state.

---

## 🏗️ Architecture

```
                                      ┌──────────────┐
                                      │ Convex Cloud │
                                      └──────▲───────┘
                                             │ (Convex WebSocket)
┌──────────────┐                      ┌──────┴───────┐
│              │     (Private HTTP)   │              │
│   orcha-ui   ├─────────────────────►│ orcha-worker │
│  (Next.js)   │                      │   (BullMQ)   │
│              │◄─────────────────────┤              │
└──────┬───────┘                      └──────┬───────┘
       │                                     │
       │ (Private HTTP)                      │ (Redis Connection)
       ▼                                     ▼
┌──────────────┬──────┐               ┌──────────────┐
│  orcha-em    │ graf │               │ orcha-redis  │
│  (Python)    │ (GF) │               │   (Redis)    │
└──────────────┴──────┘               └──────────────┘
```

---

## 🛠️ Step-by-Step Deployment Guide

### 1. Set Up Convex Cloud & Clerk
Ensure you have provisioned production instances on:
* **Convex Cloud** (Get your `NEXT_PUBLIC_CONVEX_URL` and `CONVEX_DEPLOY_KEY`)
* **Clerk Auth** (Get your `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`)

### 2. Create a Railway Project
1. Go to the [Railway Console](https://railway.com/) and create a new **Empty Project**.
2. Deploy the following 5 services inside the project:

#### 🟢 Service 1: `orcha-redis` (Standard Image)
* Click **New** -> **Docker Image** and enter: `redis:alpine`.
* Under settings, rename the service to `orcha-redis`.

#### 🟢 Service 2: `orcha-embeddings` (Python FastAPI)
* Click **New** -> **GitHub Repo** and connect your repository.
* In settings, set:
  * **Root Directory**: `railway/embeddings`
* Exposed Port: `5001`.

#### 🟢 Service 3: `orcha-worker` (BullMQ Daemon)
* Click **New** -> **GitHub Repo** and connect your repository.
* In settings, set:
  * **Root Directory**: `railway/worker`
* *Note: Does not expose any public HTTP ports.*

#### 🟢 Service 4: `orcha-ui` (Next.js SaaS Portal)
* Click **New** -> **GitHub Repo** and connect your repository.
* In settings, set:
  * **Root Directory**: `railway/ui`
  * **Exposed Port**: `3000`
* Generate a domain name under the **Networking** tab.

#### 🟢 Service 5: `orcha-grafana` & `orcha-prometheus` (Monitoring)
* Deploy both services with root directories set to `railway/grafana` and `railway/prometheus`.
* Add the environment variable `ORCHA_UI_HOST=orcha-ui` to the Prometheus service so it can resolve the Next.js telemetry endpoints internally.

---

## 🔑 Environment Variable Reference

Configure these variables inside the **Variables** tab for each service in the Railway dashboard.

### `orcha-ui`
| Variable | Value / Format | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-deployment.convex.cloud` | Convex Production URL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_...` | Clerk Publishable Key |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Secret Key |
| `NEXT_PUBLIC_APP_URL` | `https://your-ui-domain.up.railway.app` | UI public domain |
| `REDIS_URL` | `redis://orcha-redis:6379` | Internal Redis address |
| `ASYNC` | `on` | Enables background processing |
| `ENCRYPTION_KEY` | *(32-char hex key)* | Mapped credential encryption key |

### `orcha-worker`
| Variable | Value / Format | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_CONVEX_URL` | `https://your-deployment.convex.cloud` | Convex Production URL |
| `CONVEX_DEPLOY_KEY` | `prod-...` | Admin credentials for write-backs |
| `CLERK_SECRET_KEY` | `sk_live_...` | Clerk Secret Key |
| `REDIS_URL` | `redis://orcha-redis:6379` | Internal Redis address |
| `ENCRYPTION_KEY` | *(32-char hex key)* | Mapped credential decryption key |
| `OPENAI_API_KEY` | `sk-proj-...` | OpenAI API Key |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | Anthropic API Key |

### `orcha-embeddings`
| Variable | Default Value | Description |
| :--- | :--- | :--- |
| `EMBEDDING_MODEL` | `paraphrase-multilingual-MiniLM-L12-v2` | Pre-downloaded model weight |
| `BATCH_SIZE` | `64` | Concurrency batch size |

---

## 🔒 Private Network Reference
Services within the same project communicate over Railway's private overlay network. Use these internal addresses to bypass public internet roundtrips:

* **Redis Queue**: `orcha-redis:6379`
* **Embedding API**: `http://orcha-embeddings:5001/api/embeddings`
* **Telemetry Scrape Target**: `http://orcha-ui:3000/api/metrics`
