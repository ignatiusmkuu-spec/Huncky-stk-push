# Huncky STK Push

A React + Vite M-Pesa STK Push payment app that allows users to send payments to till number **6903935**.

## Architecture

- **Frontend only** — React + TypeScript + Vite
- **No backend** — calls external M-Pesa API endpoints directly
- **Port**: 5000

## M-Pesa API Integration

- **STK Push**: `POST https://mpesapi.giftedtech.co.ke/api/payNexusTech.php`
  - Body: `{ phoneNumber, amount }`
  - Phone must be in format `2547xxxxxxxx` or `2541xxxxxxxx`

- **Transaction Verification**: `POST https://mpesapi.giftedtech.co.ke/api/verify-transaction.php`
  - Body: `{ checkoutRequestId }`
  - Polled every 2 seconds (with 1 second sleep between cycles)
  - Handles: `completed`, `pending`, `cancelled`, `failed_insufficient_funds`, `timeout`, and other failures

## Till Number

Hardcoded to **6903935**

## Key Files

- `src/App.tsx` — Main app component with all STK push logic and UI states
- `src/App.css` — Component styles
- `src/index.css` — Global styles and CSS variables
- `vite.config.ts` — Vite config (host: 0.0.0.0, port: 5000, allowedHosts: true)

## Running

```bash
npm run dev
```
