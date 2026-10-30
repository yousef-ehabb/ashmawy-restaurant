# Developer & Agent Guidelines

## Architecture Overview

This project is the **Ashmawy Restaurant** website and ordering system.

- **Frontend & Routing:** React 19, Vite, TanStack Router & Start, Tailwind CSS v4.
- **Server-Side API:** Nitro server engine targeting Vercel (`preset: "vercel"`, Node.js runtime).
- **Database & Auth:** Firebase Firestore (client persistence + server-side Admin SDK), Firebase Authentication.
- **Deployment Platform:** Vercel (production and preview deployments via GitHub repository connection).

## Workflow Guidelines

1. **Git & GitHub:** GitHub is the authoritative source-code repository (`origin: https://github.com/yousef-ehabb/ashmawy-restaurant.git`). Work on feature branches or `main`, test locally, commit, and push to GitHub.
2. **Local Testing:** Always run `npm test` and `npm run build` before committing.
3. **API & Server Security:**
   - Server-side operations requiring privileged Firestore access must use the Firebase Admin SDK inside `src/server/`.
   - Never expose Firebase Admin credentials or private keys to the client.
   - All order calculations and pricing are authoritative and performed on the server.
   - Admin routes require valid bearer tokens and server-side verification.
4. **Vercel Deployment:** Vercel automatically deploys commits pushed to GitHub using the preconfigured Nitro Vercel output.
