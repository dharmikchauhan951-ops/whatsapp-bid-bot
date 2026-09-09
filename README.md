# WhatsApp Bid Bot (Twilio)

Parses bid messages sent in WhatsApp (via Twilio's WhatsApp Sandbox/API), replies
with a ✅ and the total for that message, keeps a running grand total, and tracks
the highest individual bids placed.

## How bids are parsed

Every match of `<number>-<amount>` in a message counts as one bid — the number
**after** the dash is always the amount, no matter how many digits:

| Message        | Parsed amount |
|-----------------|--------------|
| `1-25`          | 25           |
| `45-70`         | 70           |
| `357-100`       | 100          |
| `1-25, 45-70, 357-100` (all in one message) | 25 + 70 + 100 = **195** |

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Get a Twilio account + WhatsApp Sandbox**
   - Sign up at https://www.twilio.com/try-twilio
   - Go to Messaging → Try it out → Send a WhatsApp message, join the sandbox
     by sending the given code to the sandbox number from your phone.

3. **Configure environment**
   ```bash
   cp .env.example .env
   # fill in TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, etc. if you plan to send
   # outbound messages later. Not required just to receive/reply.
   ```

4. **Run the server**
   ```bash
   npm start
   ```
   This starts the server on `http://localhost:3000`.

5. **Expose it to the internet** (Twilio needs a public URL to send webhooks to)
   - For local testing, use [ngrok](https://ngrok.com/):
     ```bash
     ngrok http 3000
     ```
   - Or deploy to a host like Render, Railway, or a VPS.

6. **Point Twilio at your webhook**
   - In the Twilio Console → Messaging → Sandbox settings, set
     "WHEN A MESSAGE COMES IN" to:
     `https://<your-domain>/whatsapp` (method: POST)

## Commands (send these as WhatsApp messages)

| Message      | Response                                              |
|--------------|--------------------------------------------------------|
| `1-25`       | ✅ Total: 25, plus running grand total                 |
| `1-25, 45-70`| ✅ Total: 95 (25 + 70), plus running grand total        |
| `total`      | 📊 Grand total bids placed + grand total amount         |
| `topbids`    | 🏆 Top 5 highest individual bids placed, with sender     |
| `reset`      | ♻️ Resets all totals (restrict via `ADMIN_NUMBERS` in `.env`) |

## Notes / things to decide as you go

- **Storage**: currently a local `data.json` file (created automatically).
  Fine for a single server instance; if you deploy somewhere with an
  ephemeral filesystem (e.g. some serverless platforms), swap `storage.js`
  for a real database (Postgres, MongoDB, etc.) — the function signatures
  (`recordBid`, `getGrandTotal`, `resetAll`, `getTopBids`) are ready to be
  reimplemented against any backend.
- **Per-group vs global totals**: right now totals are global across everyone
  who messages the bot. If you need separate totals per WhatsApp group, say so
  and I can key totals by group ID instead of just sender.
- **High bid alert**: set `HIGH_BID_THRESHOLD` in `.env` to a number, and any
  individual bid at or above it triggers a 🚨 alert in the reply.
- **Format edge cases**: the parser matches any `digits-digits` pattern
  anywhere in the message. If customers might type other numbers that
  *aren't* bids (like a phone number with a dash), let me know and I'll
  tighten the pattern.
