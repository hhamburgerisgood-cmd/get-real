const fs = require('fs');
const path = require('path');

const files = ['index.html', 'theme.js', 'app.js', 'chat.js', 'forum.js', 'account.js', 'apps.js', 'style.css'];
// Match all emojis and unicode symbols used as UI icons (arrows, chevrons, geometric shapes, etc.)
const emojiRegex = /(\p{Extended_Pictographic}|\p{Emoji_Presentation}|[◀▶▲▼■□⛶✕✓🔒👑👥🚫👢✨🗑💬📖🔖📥➕←→🔍⚙👤🔑☁📝🎉])/gu;

const results = {};

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  results[file] = [];
  lines.forEach((line, idx) => {
    const matches = line.match(emojiRegex);
    if (matches) {
      // Filter out standard ascii or non-emoji false positives if any
      results[file].push({
        line: idx + 1,
        emojis: Array.from(new Set(matches)),
        content: line.trim()
      });
    }
  });
});

fs.writeFileSync('.agents/explorer_survey_2/emoji_inventory.json', JSON.stringify(results, null, 2), 'utf8');
console.log('Saved emoji_inventory.json successfully. Total files scanned:', Object.keys(results).length);
