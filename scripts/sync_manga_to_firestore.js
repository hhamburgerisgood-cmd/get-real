const fs = require('fs');
const path = require('path');

// Load chapters data
const chaptersJs = fs.readFileSync(path.join(__dirname, '..', 'chapters.js'), 'utf8');
eval(chaptersJs);

const API_KEY = 'AIzaSyB0iTRR8EVcXfykeFZ1E-D4GcWRHF95Q34';
const PROJECT_ID = 'get-real-515ba';
const BASE_URL = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/manga_chapters`;

async function syncChapter(ch) {
  const docData = {
    fields: {
      number: { integerValue: String(ch.number) },
      title: { stringValue: ch.title || `Chapter ${ch.number}` },
      name: { stringValue: ch.name || '' },
      url: { stringValue: ch.url || '' },
      pages: {
        arrayValue: {
          values: (ch.pages || []).map(p => ({ stringValue: p }))
        }
      }
    }
  };

  const url = `${BASE_URL}/${ch.number}?key=${API_KEY}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(docData)
  });

  if (res.ok) {
    console.log(`Synced Chapter ${ch.number} (${(ch.pages || []).length} pages) to Firestore`);
    return true;
  } else {
    const err = await res.text();
    console.error(`Failed Chapter ${ch.number}:`, res.status, err);
    return false;
  }
}

async function main() {
  console.log(`Starting Firestore sync for ${CHAPTER_DATA.length} chapters...`);
  let success = 0;
  for (const ch of CHAPTER_DATA) {
    const ok = await syncChapter(ch);
    if (ok) success++;
    else break; // Stop if database not enabled yet
  }
  console.log(`Completed: ${success}/${CHAPTER_DATA.length} chapters synced.`);
}

main().catch(console.error);
