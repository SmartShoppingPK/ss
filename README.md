# Smart Shopping

Multi-page affiliate site with a password-protected owner area at /admin/.

## Run it
1. Install Node 18+ (nodejs.org).
2. Copy `.env.example` to `.env` and set `ADMIN_PASSWORD`.
3. `npm start`, then open http://localhost:3000 and log in at /admin/.

## Folders
- `server.js`: tiny server (no packages to install), login, product API, photo uploads
- `data/products.json`: your products
- `public/`: the site. `shop/`, `about/`, `admin/` are pages; `css/`, `js/lib/`, `js/pages/` hold the styles and scripts; `uploads/` holds product photos

## Deploy
Use a host that runs Node and keeps its disk (a small VPS, or Render/Railway with a persistent disk mounted on `data/` and `public/uploads/`). On hosts with a temporary disk, products vanish on every redeploy. Set `ADMIN_PASSWORD` and `NODE_ENV=production` as environment variables there.
