const fs = require('fs');

const files = ['index.html', 'style.css', 'app.js', 'chat.js', 'forum.js', 'account.js', 'apps.js'];
const hexRegex = /#([0-9a-fA-F]{3,8})\b/g;

const results = {};

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  results[file] = [];
  lines.forEach((line, idx) => {
    const matches = line.match(hexRegex);
    if (matches) {
      results[file].push({
        line: idx + 1,
        colors: Array.from(new Set(matches)),
        content: line.trim()
      });
    }
  });
});

fs.writeFileSync('.agents/explorer_survey_2/hex_inventory.json', JSON.stringify(results, null, 2), 'utf8');
console.log('Saved hex_inventory.json successfully.');
