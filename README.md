# Constructor Trade Frontend

Frontend scaffold for a trading service based on:

- Next.js 16 (App Router, no `src` directory)
- Tailwind CSS v4
- shadcn/ui
- TradingView Lightweight Charts
- Zustand

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Project structure

- `app/` - Next.js routes and layout
- `components/ui/` - shadcn/ui components
- `components/trading/` - trading dashboard and chart widgets
- `providers/trading-store-provider.tsx` - Zustand provider for App Router
- `stores/trading-store.ts` - typed trading state/actions
- `lib/mock-market-data.ts` - mock OHLC generator for chart bootstrapping

## Scripts

- `npm run dev` - development server
- `npm run lint` - ESLint check
- `npm run build` - production build

## Next steps for production

- Replace mock data with real WS stream (Binance/Bybit/CEX or your gateway)
- Add auth and role-based access
- Add order panel, positions, and risk controls
- Add server-side API routes for secure broker exchange operations
