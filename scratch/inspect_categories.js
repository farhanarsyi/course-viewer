const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'referensi.html'), 'utf8');
const dom = new JSDOM(html);
const document = dom.window.document;

// Let's find elements that might contain category names
console.log('Searching for headings or sections...');
const headers = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6, .card-header, [class*="title"], [class*="header"]'));
headers.forEach(h => {
  if (h.textContent.trim().length > 0 && h.textContent.trim().length < 100) {
    console.log(`Tag: ${h.tagName}, Class: ${h.className}, Text: ${h.textContent.trim()}`);
  }
});
