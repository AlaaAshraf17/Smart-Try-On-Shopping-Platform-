# Fit-Me — Frontend

AI-powered virtual try-on shopping platform. Built with **Next.js 14 App Router**, React Three Fiber, and Tailwind CSS.

---

## Overview

Fit-Me is a full-stack e-commerce platform with two unique AI features:

1. **Live Glasses Try-On** — real-time 3D glasses overlay on a webcam feed using MediaPipe face landmarks and React Three Fiber
2. **AI Fitting Room** — upload a photo and virtually try on clothes powered by Hugging Face `Kolors-Virtual-Try-On`

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Next.js 14 (App Router) | Framework, routing, SSR |
| React Three Fiber + drei | 3D glasses rendering |
| Tailwind CSS | Styling |
| Framer Motion | Animations |
| Recharts | Analytics charts |
| Socket.io-client | Real-time events (room collab, support chat, live updates) |
| Axios | API requests |

---

## Prerequisites

- Node.js 18+
- The **backend** Node.js server running on `http://localhost:5000`
- The **AI Flask server** running on `http://localhost:5001` (for live glasses try-on)

---

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file
cp .env.example .env.local
# or create .env.local manually (see below)

# 3. Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Pages

| Route | Description |
|---|---|
| `/` | Homepage — hero, features, CTA |
| `/product` | Product listing with category tabs, 3D viewer, search |
| `/product/[id]` | Product detail — 3D model, color/size selector, reviews |
| `/search?q=...` | Search results page |
| `/cart` | Shopping cart |
| `/checkout` | Checkout with shipping address and payment method |
| `/order/[id]` | Order confirmation and detail |
| `/wishlist` | Saved items |
| `/profile` | User profile — Account, Measurements, Orders, Wishlist, My Looks |
| `/find-my-fit` | AI Fitting Room — upload photo, try on clothes, collab rooms |
| `/try-on/[id]` | Live glasses try-on via webcam (Accessories only) |
| `/brand` | Brands page — local and international |
| `/contact` | Contact form (sends email via backend) |
| `/about` | About page |
| `/dashboard` | Admin dashboard — Overview, Users, Products, Orders, Analytics, Support |
| `/login` | Login |
| `/register` | Register |

---

## Key Features

### Shopping

- **Product catalog** — category filters, client-side pagination, 3D model viewer, color tinting
- **Color + size variants** — color swatch and size (XS–XXL for Clothes) stored per cart item
- **Cart** — persisted to backend, supports different colors/sizes as separate entries
- **Checkout** — shipping address, payment method (cash/card/PayPal), tax + shipping calculation
- **Orders** — full history in profile, status badges (paid/delivered), mark-as-paid for cash orders
- **Wishlist** — toggle heart on any product, view in profile

### AI Features

- **Live Glasses Try-On** (`/try-on/[id]`) — streams webcam frames to the Flask AI server every 66ms, receives face landmarks, renders a 3D GLB glasses model over the face in real-time using React Three Fiber
- **AI Fitting Room** (`/find-my-fit`) — upload a person photo + select a garment → sends to Hugging Face AI → shows the dressed result image
- **My Looks gallery** — try-on history stored in the backend, viewable and deletable in the Profile page

### Collaboration

- **Collab rooms** — share a room ID with a friend on the Fitting Room page, see the same AI result in real-time via Socket.io
- **Room chat** — live text comments within a room session

### User Profile

- Edit name, email, password
- Upload profile photo (stored locally in browser)
- Body measurements tab
- Order history with color/size details
- Wishlist
- **My Looks** — AI try-on gallery with delete

### Search

- Search icon in the navbar expands an inline input
- Navigates to `/search?q=...` with paginated results
- Powered by `?keyword=` backend filter

### Admin Dashboard (`/dashboard`)

- **Overview** — total revenue, orders, users, products, recent activity
- **Users** — list, add, delete
- **Products** — full CRUD with image + GLB 3D model upload
- **Orders** — all orders with customer name, status, mark paid/delivered
- **Analytics** — monthly revenue line chart, paid/unpaid donut, live AI queue counter, real-time activity feed
- **Support** — live support chat panel (Socket.io) — admin receives and replies to user messages

### Support Chat

- Floating chat bubble on the Fitting Room page for non-admin users
- Admin sees all conversations in the Dashboard → Support tab
- Powered entirely by existing Socket.io infrastructure — no extra backend changes

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/          # Login & Register
│   ├── brand/           # Brands page
│   ├── cart/            # Cart
│   ├── checkout/        # Checkout
│   ├── contact/         # Contact form
│   ├── dashboard/       # Admin dashboard
│   ├── find-my-fit/     # AI Fitting Room
│   ├── order/[id]/      # Order detail
│   ├── product/         # Product listing
│   ├── product/[id]/    # Product detail
│   ├── profile/         # User profile
│   ├── search/          # Search results
│   ├── try-on/[id]/     # Live glasses try-on
│   ├── wishlist/        # Wishlist
│   ├── layout.js        # Root layout (Navbar, Providers)
│   └── page.js          # Homepage
├── components/
│   ├── home/            # Navbar, Footer, Hero, Features, CTASection, etc.
│   ├── ui/              # TryOnCamera, Model3D, WishlistHeart, SupportChat, etc.
│   ├── chatbot/         # ChatbotWidget
│   └── providers/       # Context providers wrapper
├── contexts/
│   ├── AuthContext.jsx
│   ├── CartContext.jsx
│   ├── WishlistContext.jsx
│   ├── ThemeContext.jsx
│   └── ToastContext.jsx
└── lib/
    ├── axios.js          # Axios instance with auth interceptor
    └── landmarkUtils.js  # Landmark → Three.js world-space conversion
```

---

## Running with the Full Stack

| Service | Command | Port |
|---|---|---|
| Frontend (this) | `npm run dev` | 3000 |
| Backend (Node.js) | `npm run dev` (in `/Back-end`) | 5000 |
| AI Server (Flask) | `python main.py` (in `/AI`) | 5001 |

The AI server requires `face_landmarker.task` — download it once:

```bash
cd AI
python download_models.py
```

---

## Build & Deploy

```bash
# Production build
npm run build

# Start production server
npm start
```

For deployment, update `NEXT_PUBLIC_API_URL` in your environment variables to point to the production backend URL.
