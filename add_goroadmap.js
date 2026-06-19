const fs = require('fs');
let d = fs.readFileSync('app.js', 'utf8');

// Find where to insert goRoadmap - right before renderRoadmapView
const insertBefore = 'function renderRoadmapView()';
const idx = d.indexOf(insertBefore);

if (idx >= 0 && !d.includes('function goRoadmap')) {
  const goRoadmapFn = `function goRoadmap() {
  state.topView = 'roadmap';
  state.currentCourseIdx = null;
  renderNav();
  renderRoadmapView();
  showView('roadmap');
  updateBreadcrumb('roadmap');
  closeMobileSidebar();
}

`;
  d = d.substring(0, idx) + goRoadmapFn + d.substring(idx);
  fs.writeFileSync('app.js', d);
  console.log('goRoadmap: INSERTED successfully');
} else if (d.includes('function goRoadmap')) {
  console.log('goRoadmap: already exists');
} else {
  console.log('ERROR: renderRoadmapView marker not found');
}

const check = fs.readFileSync('app.js', 'utf8');
console.log('Verified goRoadmap defined:', check.includes('function goRoadmap'));
