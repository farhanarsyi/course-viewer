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

// We will traverse all children under the main element, or we can use a simpler approach:
// Traverse all elements in document order and track current category
const allElements = document.querySelectorAll('*');
let currentCategory = 'Panduan Member'; // Default category

const categories = [
  { id: 'g-panduan', label: 'Panduan Member', emoji: '📚', color: '#3b82f6' },
  { id: 'g-intro', label: 'Pengenalan Pemrograman', emoji: '💻', color: '#10b981' },
  { id: 'g-uiux', label: 'UI & UX', emoji: '🎨', color: '#ec4899' },
  { id: 'g-febasic', label: 'Front End Basic', emoji: '🌐', color: '#f59e0b' },
  { id: 'g-feintermediate', label: 'Front End Intermediate', emoji: '⚡', color: '#ef4444' },
  { id: 'g-bebasic-php', label: 'Back End Basic - PHP', emoji: '🐘', color: '#8b5cf6' },
  { id: 'g-beintermediate-php', label: 'Back End Intermediate - PHP', emoji: '🔥', color: '#6366f1' },
  { id: 'g-bebasic-js', label: 'Back End Basic - JS', emoji: '🟢', color: '#14b8a6' },
  { id: 'g-beintermediate-js', label: 'Back End Intermediate - JS', emoji: '🚀', color: '#06b6d4' },
  { id: 'g-testing', label: 'Software Testing', emoji: '🧪', color: '#f97316' },
  { id: 'g-deployment', label: 'Deployment', emoji: '☁️', color: '#64748b' },
  { id: 'g-career', label: 'Career Preparation', emoji: '💼', color: '#475569' },
  { id: 'g-bonus', label: 'Bonus Spesial', emoji: '🎁', color: '#db2777' }
];

const courseMapping = {};

// We can find all elements that are category titles or card elements.
// Let's do a sequential pass over H5 tags and cards.
// If we find an H5 tag with class "fw-bold", check if it matches a category.
// If it matches a category, set the current category ID.
// If we find a card, extract its data and associate it with the current category.
const categoryLabels = categories.map(c => c.label.toLowerCase().trim());

const h5sAndCards = document.querySelectorAll('h5, .card');
console.log(`Processing ${h5sAndCards.length} elements...`);

let currentCategoryId = 'g-panduan';

h5sAndCards.forEach(el => {
  if (el.tagName === 'H5' && el.classList.contains('fw-bold')) {
    const text = el.textContent.trim().toLowerCase();
    const matchedCat = categories.find(c => text.includes(c.label.toLowerCase()) || c.label.toLowerCase().includes(text));
    if (matchedCat) {
      currentCategoryId = matchedCat.id;
      console.log(`Switched to category: ${matchedCat.label} (${matchedCat.id})`);
    }
  } else if (el.classList.contains('card')) {
    const linkEl = el.querySelector('a') || el.closest('a');
    const link = linkEl ? linkEl.getAttribute('href') : null;
    if (!link) return;

    const parts = link.split('/');
    const slug = parts[parts.length - 1] || parts[parts.length - 2];
    if (!slug) return;
    
    // Ignore links that aren't course links
    if (slug.includes('devhandal') || slug.includes('kelasfullstack.id') || slug.includes('Group_') || slug.includes('library')) {
      return;
    }

    const titleEl = el.querySelector('.card-title') || el.querySelector('h5') || el.querySelector('h6');
    const title = titleEl ? titleEl.textContent.trim() : '';

    // Extract duration
    const footerEl = el.querySelector('.card-footer') || el.querySelector('small');
    const footerText = footerEl ? footerEl.textContent.trim() : '';
    const durationMatch = footerText.match(/(\d+\s*Jam|\d+\s*Menit)/i);
    const duration = durationMatch ? durationMatch[0] : null;

    // Extract img src
    const img = el.querySelector('img');
    const imgSrc = img ? img.getAttribute('src') : null;

    // Extract tags
    const tags = Array.from(el.querySelectorAll('.badge, [class*="badge"], span.bg-light'))
      .map(b => b.textContent.trim())
      .filter(b => b && b !== 'Lulus' && b !== 'Main');

    courseMapping[slug] = {
      categoryId: currentCategoryId,
      title,
      imgSrc,
      tags,
      duration
    };
  }
});

console.log(`Mapped ${Object.keys(courseMapping).length} course slugs to their categories.`);

const output = {
  categories,
  courses: courseMapping
};

fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Saved to course_meta.json.');
