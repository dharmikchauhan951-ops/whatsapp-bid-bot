require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { MessagingResponse } = require('twilio').twiml;
const { recordBid, getGrandTotal, resetAll, getTopBids } = require('./storage');

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Optional: if a single bid amount is >= this, flag it as a "high bid" alert.
// Set HIGH_BID_THRESHOLD in .env to enable. Leave unset/0 to disable.
const HIGH_BID_THRESHOLD = parseInt(process.env.HIGH_BID_THRESHOLD || '0', 10);

// Comma-separated list of admin WhatsApp numbers allowed to use "reset"
// e.g. ADMIN_NUMBERS=whatsapp:+919999999999,whatsapp:+918888888888
const ADMIN_NUMBERS = (process.env.ADMIN_NUMBERS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

/**
 * Extracts bid amounts from a message body.
 * Format: "<number>-<amount>" e.g. "1-25", "45-70", "357-100".
 * The number AFTER the dash is always the bid amount, regardless of digit count.
 * Multiple bids can appear in one message, separated by commas/spaces/newlines.
 */
function extractBids(body) {
  const regex = /\d+\s*-\s*(\d+)/g;
  const amounts = [];
  let match;
  while ((match = regex.exec(body)) !== null) {
    amounts.push(parseInt(match[1], 10));
  }
  return amounts;
}

app.post('/whatsapp', (req, res) => {
  const rawBody = (req.body.Body || '').trim();
  const sender = req.body.From || 'unknown';
  const twiml = new MessagingResponse();

  const lower = rawBody.toLowerCase();

  // --- Command: check grand total ---
  if (lower === 'total') {
    const data = getGrandTotal();
    twiml.message(
      `📊 Grand total bids: ${data.bidCount}\n💰 Grand total amount: ${data.grandTotal}`
    );
    return res.type('text/xml').send(twiml.toString());
  }

  // --- Command: top bids leaderboard ---
  if (lower === 'topbids' || lower === 'top bids') {
    const top = getTopBids(5);
    if (top.length === 0) {
      twiml.message('No bids recorded yet.');
    } else {
      const lines = top.map((b, i) => `${i + 1}. ${b.amount} — ${b.sender}`);
      twiml.message(`🏆 Top bids:\n${lines.join('\n')}`);
    }
    return res.type('text/xml').send(twiml.toString());
  }

  // --- Command: reset (admin only) ---
  if (lower === 'reset') {
    if (ADMIN_NUMBERS.length && !ADMIN_NUMBERS.includes(sender)) {
      twiml.message('❌ You are not authorized to reset totals.');
    } else {
      resetAll();
      twiml.message('♻️ All totals have been reset.');
    }
    return res.type('text/xml').send(twiml.toString());
  }

  // --- Otherwise, try to parse as a bid message ---
  const amounts = extractBids(rawBody);

  if (amounts.length === 0) {
    twiml.message(
      '❌ Format not recognized. Please send bids like: 1-25 or 45-70 or 357-100'
    );
    return res.type('text/xml').send(twiml.toString());
  }

  const messageTotal = amounts.reduce((sum, n) => sum + n, 0);
  const data = recordBid(sender, messageTotal, amounts, rawBody);

  let reply = `✅ Total: ${messageTotal}`;
  if (amounts.length > 1) {
    reply += `\n(${amounts.join(' + ')} = ${messageTotal})`;
  }
  reply += `\n📊 Grand total: ${data.grandTotal}`;

  if (HIGH_BID_THRESHOLD > 0) {
    const highOnes = amounts.filter(a => a >= HIGH_BID_THRESHOLD);
    if (highOnes.length > 0) {
      reply += `\n🚨 High bid alert: ${highOnes.join(', ')} (>= ${HIGH_BID_THRESHOLD})`;
    }
  }

  twiml.message(reply);
  res.type('text/xml').send(twiml.toString());
});

app.get('/', (req, res) => {
  res.send('WhatsApp Bid Bot is running.');
});

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
