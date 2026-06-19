const fs = require('fs');
const meta = JSON.parse(fs.readFileSync('course_meta.json', 'utf8'));
const content = `// Auto-generated course metadata
const COURSE_META = ${JSON.stringify(meta, null, 2)};
`;
fs.writeFileSync('course_meta.js', content, 'utf8');
console.log('Converted course_meta.json to course_meta.js');
