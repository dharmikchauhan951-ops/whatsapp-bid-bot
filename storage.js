const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'data.json');

function loadData() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = { grandTotal: 0, bidCount: 0, senders: {}, history: [], topBids: [] };
    fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2));
    return initial;
  }
  const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (!data.topBids) data.topBids = []; // backward compatibility
  return data;
}

function saveData(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

/**
 * Record a parsed message's bids and update running totals.
 * @param {string} sender - WhatsApp sender id (e.g. "whatsapp:+91...")
 * @param {number} messageTotal - sum of bid amounts found in this message
 * @param {number[]} amounts - individual bid amounts found
 * @param {string} rawBody - original message text
 */
function recordBid(sender, messageTotal, amounts, rawBody) {
  const data = loadData();

  data.grandTotal += messageTotal;
  data.bidCount += amounts.length;

  if (!data.senders[sender]) {
    data.senders[sender] = { total: 0, bidCount: 0 };
  }
  data.senders[sender].total += messageTotal;
  data.senders[sender].bidCount += amounts.length;

  data.history.push({
    sender,
    rawBody,
    amounts,
    messageTotal,
    timestamp: new Date().toISOString()
  });

  // Track every individual bid amount for the "highest bids" leaderboard
  const timestamp = new Date().toISOString();
  amounts.forEach(amount => {
    data.topBids.push({ sender, amount, timestamp });
  });
  data.topBids.sort((a, b) => b.amount - a.amount);
  data.topBids = data.topBids.slice(0, 50); // keep top 50 only

  saveData(data);
  return data;
}

/**
 * Returns the top N highest individual bids placed so far.
 */
function getTopBids(limit = 5) {
  const data = loadData();
  return data.topBids.slice(0, limit);
}

function getGrandTotal() {
  return loadData();
}

function resetAll() {
  const initial = { grandTotal: 0, bidCount: 0, senders: {}, history: [] };
  saveData(initial);
  return initial;
}

module.exports = { recordBid, getGrandTotal, resetAll, getTopBids };
