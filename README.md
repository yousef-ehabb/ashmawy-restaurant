# Ashmawy Restaurant (عشماوي) - Ordering System & Website

Modern restaurant web application and ordering platform for Ashmawy Restaurant in Aswan, Egypt. Built with React 19, Vite, TanStack Router & Start, Nitro, Tailwind CSS v4, and Firebase.

---

## Architecture Overview

- **Frontend & Routing:** React 19, TanStack Router, TanStack Start, Lucide Icons, Radix UI components, Tailwind CSS v4.
- **Server-Side API:** Nitro engine with Vercel preset (`preset: "vercel"`, Node.js runtime), providing authoritative order creation, tracking, status updates, menu availability, and operational controls.
- **Database & Authentication:** Firebase Firestore (client persistence + server-side Firebase Admin SDK), Firebase Authentication.
- **Hosting & Deployment:** Vercel (Production and Preview deployments via GitHub integration).
- **Source Code Management:** GitHub (`https://github.com/yousef-ehabb/ashmawy-restaurant.git`).

---

## Prerequisites

- **Node.js:** v20.x, v22.x, or v24.x (LTS recommended)
- **Package Manager:** npm (v10+), or pnpm / bun

---

## Local Development Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yousef-ehabb/ashmawy-restaurant.git
   cd ashmawy-restaurant
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your Firebase credentials. For local testing without a live Firebase project, the Firebase Emulator can be used.

4. **Start the local development server:**
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:5173`. The development server includes a built-in API middleware proxying `/api/*` requests to the server router.

---

## Available Scripts

- `npm run dev`: Starts the Vite development server with local API middleware.
- `npm run build`: Builds the production bundle for Vercel deployment (generates `.vercel/output`).
- `npm run preview`: Previews the production build locally.
- `npm test`: Runs the automated test suite with Vitest.
- `npm run test:watch`: Runs tests in watch mode.
- `npm run lint`: Runs ESLint to check for code issues.
- `npm run format`: Formats source code using Prettier.
- `npm run create-admin`: Script to provision or verify an admin user in Firestore.
- `npm run clear-orders`: Script to prune or clear test orders.

---

## Vercel Deployment Configuration

This project is configured to deploy directly to Vercel using the official Nitro Vercel preset (`preset: "vercel"`).

### How It Works

1. During `npm run build`, Vite builds the client bundle and Nitro generates the Vercel Build Output API v3 directory structure inside `.vercel/output`:
   - `.vercel/output/static`: Client-side static assets, scripts, stylesheets, and fonts with immutable cache headers.
   - `.vercel/output/functions/__server.func`: Serverless Node.js function running the unified API and SSR handler.
   - `.vercel/output/config.json`: Routing definitions mapping static assets and delegating dynamic requests (`/(.*)`) to `/__server`.

2. In Vercel Project Settings:
   - **Framework Preset:** Other
   - **Build Command:** `npm run build`
   - **Output Directory:** `.vercel/output` (Vercel automatically detects `.vercel/output` when present)
   - **Install Command:** `npm install`
   - **Node.js Version:** 20.x or 22.x

### Required Vercel Environment Variables

Set the following in the Vercel Dashboard under **Settings -> Environment Variables**:

| Variable Name | Environment | Description |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | Production, Preview | Firebase Web API Key |
| `VITE_FIREBASE_AUTH_DOMAIN` | Production, Preview | Firebase Auth Domain |
| `VITE_FIREBASE_PROJECT_ID` | Production, Preview | Firebase Project ID (`ashmawy-ordering`) |
| `VITE_FIREBASE_STORAGE_BUCKET` | Production, Preview | Firebase Storage Bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Production, Preview | Firebase Sender ID |
| `VITE_FIREBASE_APP_ID` | Production, Preview | Firebase Web App ID |
| `FIREBASE_PROJECT_ID` | Production, Preview | Server Firebase Admin Project ID |
| `FIREBASE_CLIENT_EMAIL` | Production, Preview | Firebase Service Account Email |
| `FIREBASE_PRIVATE_KEY` | Production, Preview | Firebase Service Account Private Key (with line breaks) |
| `FIREBASE_SERVICE_ACCOUNT_KEY` | Optional | Alternative: Full Service Account JSON string |

> **Security Note:** Never expose `FIREBASE_PRIVATE_KEY` or `FIREBASE_SERVICE_ACCOUNT_KEY` to the client. Keep them un-prefixed (do NOT prefix with `VITE_`).

---

## Server API Endpoints

All API endpoints are implemented in `src/server/apiRouter.ts` and served seamlessly in both dev and production:

- `POST /api/orders/create` — Authoritative server-side order calculation, validation, idempotency guard, and sequential order numbering.
- `GET /api/orders/track`, `POST /api/orders/track` — Customer order tracking by order number and phone.
- `GET /api/admin/orders` — List orders (Admin authenticated).
- `POST /api/admin/orders/update` — Update order status and kitchen notes with transition validation (Admin authenticated).
- `POST /api/admin/orders/delete` — Delete order(s) (Admin authenticated).
- `GET /api/menu/availability` — Public menu item and extra availability.
- `POST /api/admin/menu/availability` — Toggle item/extra availability across branches (Admin authenticated).
- `GET /api/settings/operational` — Public operational control settings (working hours, branch open/closed state).
- `POST /api/admin/settings/operational` — Update operational controls and branch status (Admin authenticated).

---

## GitHub CI/CD & Deployment Workflow

1. **Develop Locally:** Implement changes and test with `npm test` and `npm run build`.
2. **Commit Changes:** Standard Git commit (`git commit -m "feat/fix: description"`).
3. **Push to GitHub:** Push to the authoritative GitHub repository (`git push origin main` or pull request).
4. **Vercel Auto-Deploy:** Vercel automatically detects the push, runs `npm run build`, and deploys the production build or preview URL.
5. **Verify:** Test API endpoints and UI on the deployed Vercel URL.

---

## Troubleshooting

- **Missing API Routes / 404s:** Ensure requests target `/api/*` exactly. Check that `src/server.ts` routes `/api/*` requests to `handleApiRequest`.
- **Admin 401 Unauthorized:** Verify the request includes `Authorization: Bearer <token>` where token is a valid Firebase ID token.
- **Admin 403 Forbidden:** The authenticated user does not have `admin` claims, is not on the admin allowlist, or does not have an active record in Firestore `admins/{uid}`.
- **Failed Builds:** Check that `npm run build` succeeds locally. Verify Node.js version compatibility in Vercel settings.
