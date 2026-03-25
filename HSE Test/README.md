# ProPrep — Full Stack Deployment Guide

## Stack
| Layer | Technology | Free Hosting |
|-------|-----------|-------------|
| **Frontend** | HTML + CSS + Vanilla JS | Netlify |
| **Backend API** | Node.js + Express | Railway.app |
| **Database** | SQLite (file) | Included with Railway |

---

## Project Structure
```
proprep-backend/          ← Backend (deploy to Railway)
  server.js               ← Express API + all routes
  package.json
  .env.example
  proprep.db              ← Auto-created on first run (SQLite)

index.html                ← Frontend (deploy to Netlify)
app.js                    ← Frontend JS (calls backend API)
```

---

## Step 1 — Deploy Backend to Railway (Free)

1. **Create account** at [railway.app](https://railway.app) (free, no card needed)

2. **Push to GitHub first:**
   ```bash
   cd proprep-backend
   git init
   git add .
   git commit -m "ProPrep backend"
   # Create repo at github.com, then:
   git remote add origin https://github.com/YOURNAME/proprep-backend.git
   git push -u origin main
   ```

3. **Deploy on Railway:**
   - New Project → Deploy from GitHub repo
   - Select your `proprep-backend` repo
   - Railway auto-detects Node.js and runs `npm start`

4. **Set environment variables in Railway dashboard:**
   ```
   JWT_SECRET=your_random_64_char_string_here
   FRONTEND_URL=https://your-site.netlify.app
   NODE_ENV=production
   ```
   Generate a secure secret:
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

5. **Note your Railway URL** — looks like `https://proprep-backend-production.up.railway.app`

---

## Step 2 — Deploy Frontend to Netlify (Free)

1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)

2. **Before uploading**, set your backend URL in `index.html`:
   Find the line in `app.js`:
   ```js
   const API_BASE = window.PROPREP_API || 'http://localhost:3001/api';
   ```
   Change it to your Railway URL:
   ```js
   const API_BASE = window.PROPREP_API || 'https://YOUR-APP.up.railway.app/api';
   ```
   Or add this `<script>` tag to `index.html` before `<script src="app.js">`:
   ```html
   <script>window.PROPREP_API = 'https://YOUR-APP.up.railway.app/api';</script>
   ```

3. **Drag both files** (`index.html` + `app.js`) onto Netlify Drop

4. Your site is live at something like `https://graceful-mochi-abc123.netlify.app`

5. **Add custom domain** in Netlify → Domain Settings (optional)

---

## Step 3 — Update CORS on Backend

In Railway env vars, set:
```
FRONTEND_URL=https://YOUR-SITE.netlify.app
```

---

## Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| 🎓 Candidate | `rahul.mehta@gmail.com` | `Gulf@2025` |
| 👷 Expert | `arun.kumar.hse@gmail.com` | `Expert@2025` |
| 🔐 Admin | `admin.proprep@gmail.com` | `Admin@2025` |

Admin also: `Ctrl+Shift+A` or triple-tap the `·` dot in footer.

---

## API Endpoints

### Auth
| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| POST | `/api/auth/register` | No | Register candidate or expert |
| POST | `/api/auth/login` | No | Login, returns JWT token |
| GET | `/api/auth/me` | Bearer | Get current user profile |
| PUT | `/api/auth/me` | Bearer | Update profile |

### Sessions
| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/sessions` | Bearer | Get sessions (filtered by role) |
| POST | `/api/sessions` | Bearer | Book a session |
| PUT | `/api/sessions/:id/feedback` | Bearer | Submit expert feedback |
| DELETE | `/api/sessions/:id` | Admin | Delete session |

### Interviewers
| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/interviewers` | No | List active interviewers |
| PUT | `/api/interviewers/:id` | Bearer | Update interviewer status/bio |
| GET | `/api/interviewers/:id/availability` | No | Get availability |
| PUT | `/api/interviewers/:id/availability` | Bearer | Set availability |

### Admin
| Method | Endpoint | Auth | Description |
|--------|---------|------|-------------|
| GET | `/api/admin/stats` | Admin | Dashboard stats |
| GET | `/api/candidates` | Admin | All candidates |
| GET | `/api/pending-interviewers` | Admin | Pending approvals |
| POST | `/api/pending-interviewers/:id/approve` | Admin | Approve interviewer |
| DELETE | `/api/pending-interviewers/:id` | Admin | Reject application |
| GET | `/api/notifications` | Bearer | Get notifications |
| PUT | `/api/notifications/read` | Bearer | Mark all as read |

---

## Local Development

```bash
# Backend
cd proprep-backend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev    # starts on http://localhost:3001

# Frontend — open index.html directly in browser
# (app.js points to localhost:3001 by default)
```

---

## Alternative Free Hosting Options

### Backend alternatives to Railway:
- **Render.com** — Free tier, 750 hrs/month. Deploy same way.
- **Fly.io** — Free allowance, good performance.
- **Glitch.com** — Instant Node.js, free forever.

### Database upgrade (when you outgrow SQLite):
- **Supabase** — Free PostgreSQL, 500MB. Change `better-sqlite3` to `pg` driver.
- **PlanetScale** — Free MySQL, 5GB.
- **MongoDB Atlas** — Free 512MB.

---

## Security Checklist Before Going Live

- [ ] Change `JWT_SECRET` to a 64-char random string
- [ ] Set `FRONTEND_URL` to your exact Netlify domain
- [ ] Remove demo seed data from `server.js` (the `seedDemoData()` function)
- [ ] Set `NODE_ENV=production` in Railway
- [ ] Add rate limiting: `npm install express-rate-limit`
- [ ] Add helmet: `npm install helmet`
