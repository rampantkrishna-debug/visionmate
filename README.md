# VisionMate website + backend

## What's included
- Updated responsive VisionMate website.
- A generated "How VisionMate Works" infographic in `public/assets/`.
- Login / sign-up icon at the top-right.
- Account registration and login using hashed passwords and server-side sessions.
- Feedback/contact form that saves submissions to SQLite.
- SQLite database files are created automatically in `data/`.

## Run locally
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Set a strong session secret:
   - macOS/Linux: `export SESSION_SECRET="$(node -e "console.log(require('crypto').randomBytes(48).toString('hex'))")"`
   - Windows PowerShell: `$env:SESSION_SECRET = node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
5. Run `npm start`.
6. Open http://localhost:3000

## Database
The app creates `data/visionmate.sqlite` for accounts and feedback, and a separate SQLite session database. Passwords are stored as bcrypt hashes, not plain text.

## Important before public deployment
This is a working local backend starter, not a hosted production service. Deploy it to a Node.js host with persistent disk storage and HTTPS. Set `NODE_ENV=production`, keep `SESSION_SECRET` private, configure backups, privacy/retention rules and an administrator-only way to review feedback. Do not deploy the SQLite database file publicly. The concept is not a certified mobility or safety device.
