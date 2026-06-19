const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const htmlPath = path.join(__dirname, '..', 'referensi.html');
const outputPath = path.join(__dirname, '..', 'course_meta.json');

console.log('Reading referensi.html...');
const html = fs.readFileSync(htmlPath, 'utf8');

console.log('Parsing with JSDOM...');
const dom = new JSDOM(html);
const document = dom.window.document;

const mapping = {};
const cards = document.querySelectorAll('.card');
console.log(`Found ${cards.length} cards.`);

cards.forEach((card, index) => {
  const linkEl = card.querySelector('a') || card.closest('a');
  const link = linkEl ? linkEl.getAttribute('href') : null;
  if (!link) return;

  const parts = link.split('/');
  const slug = parts[parts.length - 1] || parts[parts.length - 2];
  if (!slug) return;

  const titleEl = card.querySelector('.card-title') || card.querySelector('h5') || card.querySelector('h6');
  const title = titleEl ? titleEl.textContent.trim() : '';

  // Extract duration
  const footerEl = card.querySelector('.card-footer') || card.querySelector('small');
  const footerText = footerEl ? footerEl.textContent.trim() : '';
  const durationMatch = footerText.match(/(\d+\s*Jam|\d+\s*Menit)/i);
  const duration = durationMatch ? durationMatch[0] : null;

  // Extract img src
  const img = card.querySelector('img');
  const imgSrc = img ? img.getAttribute('src') : null;

  // Extract tags
  const tags = Array.from(card.querySelectorAll('.badge, [class*="badge"], span.bg-light'))
    .map(b => b.textContent.trim())
    .filter(b => b && b !== 'Lulus' && b !== 'Main');

  mapping[slug] = {
    title,
    imgSrc,
    tags,
    duration
  };
});

console.log(`Extracted metadata for ${Object.keys(mapping).length} course slugs.`);
fs.writeFileSync(outputPath, JSON.stringify(mapping, null, 2), 'utf8');
console.log('Metadata written to course_meta.json successfully.');
