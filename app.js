/* ============================================================
   KelasFullstack Course Viewer — app.js
   ============================================================ */

'use strict';

// ── State ──────────────────────────────────────────────────────
const state = {
  courses: [],
  currentCourseIdx: null,
  currentLessonFlat: [],   // [{courseIdx, moduleIdx, lessonIdx, lesson}]
  currentLessonFlatIdx: null,
  currentVideoIdx: 0,
  sidebarCollapsed: false,
  mobileSidebarOpen: false,
  // Quiz state
  currentQuizAnswers: {},  // { questionId: selectedOptionId }
  currentQuizSubmitted: false,
  currentQuizStarted: false,
  // Category state
  activeCategory: 'all',
  categoryCollapsed: {},   // { categoryId: true/false }
};

// ── Card accent colors (cycling) ───────────────────────────────
const CARD_ACCENTS = [
  'linear-gradient(90deg,#0071e3,#6c37c9)',
  'linear-gradient(90deg,#30d158,#0071e3)',
  'linear-gradient(90deg,#ff9f0a,#ff375f)',
  'linear-gradient(90deg,#6c37c9,#ff375f)',
  'linear-gradient(90deg,#5e5ce6,#30d158)',
  'linear-gradient(90deg,#ff375f,#ff9f0a)',
  'linear-gradient(90deg,#0071e3,#30d158)',
  'linear-gradient(90deg,#30d158,#6c37c9)',
];

// ── Roadmap Categories ─────────────────────────────────────────
const CATEGORIES = [
  { id: 'all',          label: 'Semua Kursus',       emoji: '🗂️'  },
  { id: 'fundamental',  label: 'Fundamental',         emoji: '📚'  },
  { id: 'design',       label: 'Design & Figma',      emoji: '🎨'  },
  { id: 'html-css',     label: 'HTML & CSS',          emoji: '🌐'  },
  { id: 'javascript',   label: 'JavaScript',          emoji: '⚡'  },
  { id: 'css-framework',label: 'CSS Framework',       emoji: '💅'  },
  { id: 'vue',          label: 'Vue.js',              emoji: '💚'  },
  { id: 'react',        label: 'React & Others',      emoji: '⚛️'  },
  { id: 'php-mysql',    label: 'PHP & MySQL',         emoji: '🐘'  },
  { id: 'laravel',      label: 'Laravel & CI',        emoji: '🔴'  },
  { id: 'nodejs',       label: 'Node.js & Backend',   emoji: '🟢'  },
  { id: 'deployment',   label: 'Deployment & VPS',    emoji: '🚀'  },
  { id: 'career',       label: 'Career & DevOps',     emoji: '💼'  },
];

function getCourseCategory(course) {
  const slug = course.course_slug || '';
  if (!slug || slug === 'panduan-member-kelasfullstackid' ||
      slug.includes('intro-to-programming') || slug.includes('algoritma') ||
      slug.includes('text-editor') || slug.includes('terminal') ||
      slug.includes('cmd') || slug.includes('git-pemula') || slug.includes('git-dasar'))
    return 'fundamental';
  if (slug.includes('figma') || (slug.includes('uiux') && !slug.includes('alpine')) ||
      slug.includes('developer-desain'))
    return 'design';
  if (slug.includes('dasar-html') || slug.includes('dasar-css') ||
      slug === 'belajar-bootstrap-css-framework')
    return 'html-css';
  if (slug.includes('javascript') || slug.includes('jquery') || slug.includes('ajax'))
    return 'javascript';
  if (slug.includes('tailwind') || slug.includes('sass') ||
      slug.includes('landing-page') || slug.includes('ewallet') ||
      slug.includes('crowd-funding') || slug.includes('portofolio-menggunakan-tailwind') ||
      slug.includes('bootstrap-4'))
    return 'css-framework';
  if (slug.includes('vue') || slug.includes('nuxt'))
    return 'vue';
  if (slug.includes('reactjs') || slug.includes('react') ||
      slug.includes('nextjs') || slug.includes('alpine') || slug.includes('astro'))
    return 'react';
  if (slug.includes('php') || slug.includes('mysql') ||
      slug.includes('database-mysql') || slug.includes('pengenalan-database') ||
      slug.includes('berorientasi-objek-di-php') || slug.includes('berorientasi-objek-php'))
    return 'php-mysql';
  if (slug.includes('laravel') || slug.includes('codeigniter') ||
      slug.includes('filament') || slug.includes('security-for-developer'))
    return 'laravel';
  if (slug.includes('nodejs') || slug.includes('expressjs') ||
      slug.includes('express') || slug.includes('mongodb') ||
      slug.includes('nestjs') || slug.includes('adonis') ||
      slug.includes('fullstack-tutorial') || slug.includes('implementasi') ||
      slug.includes('manajemen-hot') || slug.includes('manajemen-route') ||
      slug.includes('belajar-restful') || slug.includes('belajar-konsep-auth') ||
      slug.includes('directory-listing') || slug.includes('event-management'))
    return 'nodejs';
  if (slug.includes('vps') || slug.includes('nginx') || slug.includes('shared-hosting') ||
      slug.includes('netlify') || slug.includes('deploy') ||
      slug.includes('firebase-hosting') || slug.includes('github-pages') ||
      slug.includes('vercel') || slug.includes('selenium') ||
      slug.includes('cli-di-linux') || slug.includes('revolusi-deployment'))
    return 'deployment';
  if (slug.includes('devops') || slug.includes('kode-etik') ||
      slug.includes('personal-branding') || slug.includes('dunia-kerja') ||
      slug.includes('strategi-karir') || slug.includes('freelance') ||
      slug.includes('english') || slug.includes('interview') || slug.includes('live-class'))
    return 'career';
  return 'fundamental';
}

function getCourseThumb(course) {
  for (const mod of (course.modules || [])) {
    for (const lesson of (mod.lessons || [])) {
      const ytUrls = lesson.youtube_urls || [];
      if (ytUrls.length > 0) {
        const id = getYoutubeId(ytUrls[0]);
        if (id) return `https://img.youtube.com/vi/${id}/mqdefault.jpg`;
      }
    }
  }
  return null;
}

function getCatEmoji(catId) {
  const cat = CATEGORIES.find(c => c.id === catId);
  return cat ? cat.emoji : '📚';
}

// ── Helpers ────────────────────────────────────────────────────
function getYoutubeId(url) {
  const m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function buildYoutubeEmbed(url) {
  const id = getYoutubeId(url);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&playsinline=1`;
}

function buildYoutubeThumbnail(url) {
  const id = getYoutubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/mqdefault.jpg` : null;
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Lines/phrases that are scraper navigation artifacts — strip them out
const SCRAPER_NOISE = [
  /^Kelas Saya$/,
  /^Selanjutnya$/,
  /^Materi$/,
  /^Questions$/,
  /^Notes$/,
  /^Server \d+$/,
  /^Tidak ada materi teks$/,
  /^Kelas Saya\n/,
  // breadcrumb-style truncated course title like "Algoritma dan P..."
  /^.{3,40}\.{3}$/,
];

function isNoiseLine(line) {
  const t = line.trim();
  if (!t) return true;
  return SCRAPER_NOISE.some(rx => rx.test(t));
}

function cleanText(raw = '') {
  // Split into lines, filter noise, rejoin
  const lines = raw.split('\n');
  const cleaned = lines.filter(l => !isNoiseLine(l));
  // collapse 3+ consecutive empty lines into 1
  return cleaned.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function formatText(raw = '') {
  if (raw.trim().startsWith('<') || /<[a-z][\s\S]*>/i.test(raw)) {
    return raw.trim();
  }
  const text = cleanText(raw);
  if (!text) return '';   // nothing to show — caller decides whether to render the block
  return text
    .split(/\n\n+/)
    .map(para => {
      const p = para.trim();
      if (!p) return '';
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');
}

// Build flat lesson list for a course
function buildFlatLessons(courseIdx) {
  const course = state.courses[courseIdx];
  const flat = [];
  course.modules.forEach((mod, mIdx) => {
    mod.lessons.forEach((lesson, lIdx) => {
      flat.push({ courseIdx, moduleIdx: mIdx, lessonIdx: lIdx, lesson, moduleName: mod.module_title });
    });
  });
  return flat;
}

// ── DOM refs ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const overlay = $('overlay');
const courseNav = $('course-nav');
const searchInput = $('search-input');
const sidebarToggle = $('sidebar-toggle');
const mobileMenuBtn = $('mobile-menu-btn');
const breadcrumb = $('breadcrumb');

const homeView = $('home-view');
const courseView = $('course-view');
const lessonView = $('lesson-view');

// ── Show/Hide Views ────────────────────────────────────────────
function showView(name) {
  [homeView, courseView, lessonView].forEach(v => v.classList.remove('active'));
  if (name === 'home') homeView.classList.add('active');
  else if (name === 'course') courseView.classList.add('active');
  else if (name === 'lesson') lessonView.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Sidebar toggle ─────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  mainContent.classList.toggle('expanded', state.sidebarCollapsed);
});

mobileMenuBtn.addEventListener('click', () => {
  state.mobileSidebarOpen = true;
  sidebar.classList.add('mobile-open');
  overlay.classList.add('active');
});

overlay.addEventListener('click', closeMobileSidebar);

function closeMobileSidebar() {
  state.mobileSidebarOpen = false;
  sidebar.classList.remove('mobile-open');
  overlay.classList.remove('active');
}

// ── Render Sidebar Nav ─────────────────────────────────────────
function renderNav(filter = '') {
  courseNav.innerHTML = '';
  const filt = filter.toLowerCase();

  // When searching: flat list across all categories
  if (filt) {
    state.courses.forEach((course, idx) => {
      if (!course.course_title.toLowerCase().includes(filt)) return;
      const btn = document.createElement('button');
      btn.className = 'nav-item' + (state.currentCourseIdx === idx ? ' active' : '');
      btn.innerHTML = `
        <span class="nav-index">${idx + 1}</span>
        <span class="nav-text">${escapeHtml(course.course_title)}</span>
      `;
      btn.addEventListener('click', () => { goToCourse(idx); closeMobileSidebar(); });
      courseNav.appendChild(btn);
    });
    return;
  }

  // No search: group by category
  // Build a map: categoryId → [{courseIdx, course}]
  const catMap = {};
  CATEGORIES.filter(c => c.id !== 'all').forEach(c => { catMap[c.id] = []; });
  state.courses.forEach((course, idx) => {
    const catId = getCourseCategory(course);
    if (!catMap[catId]) catMap[catId] = [];
    catMap[catId].push({ idx, course });
  });

  CATEGORIES.filter(c => c.id !== 'all').forEach(cat => {
    const items = catMap[cat.id] || [];
    if (!items.length) return;

    const isCollapsed = !!state.categoryCollapsed[cat.id];

    const group = document.createElement('div');
    group.className = 'cat-group' + (isCollapsed ? ' collapsed' : '');
    group.dataset.catId = cat.id;

    const hasActive = items.some(it => it.idx === state.currentCourseIdx);

    group.innerHTML = `
      <button class="cat-header" data-cat="${cat.id}">
        <span class="cat-emoji">${cat.emoji}</span>
        <span class="cat-label">${cat.label}</span>
        <span class="cat-count">${items.length}</span>
        <span class="cat-chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <div class="cat-body"></div>
    `;

    const body = group.querySelector('.cat-body');
    items.forEach(({ idx, course }) => {
      const btn = document.createElement('button');
      btn.className = 'nav-item' + (state.currentCourseIdx === idx ? ' active' : '');
      btn.innerHTML = `
        <span class="nav-index">${idx + 1}</span>
        <span class="nav-text">${escapeHtml(course.course_title)}</span>
      `;
      btn.addEventListener('click', () => { goToCourse(idx); closeMobileSidebar(); });
      body.appendChild(btn);
    });

    // Collapse toggle
    group.querySelector('.cat-header').addEventListener('click', () => {
      const col = group.classList.toggle('collapsed');
      state.categoryCollapsed[cat.id] = col;
    });

    // Auto-expand if contains active course
    if (hasActive) {
      group.classList.remove('collapsed');
      state.categoryCollapsed[cat.id] = false;
    }

    courseNav.appendChild(group);
  });
}

searchInput.addEventListener('input', () => renderNav(searchInput.value));

// ── Render Home ────────────────────────────────────────────────
function renderHome() {
  // Stats
  let totalLessons = 0, totalModules = 0;
  state.courses.forEach(c => {
    c.modules.forEach(m => {
      totalModules++;
      totalLessons += m.lessons.length;
    });
  });
  $('stats-bar').innerHTML = `
    <div class="stat-item"><div class="stat-num">${state.courses.length}</div><div class="stat-label">Kursus</div></div>
    <div class="stat-item"><div class="stat-num">${totalModules}</div><div class="stat-label">Modul</div></div>
    <div class="stat-item"><div class="stat-num">${totalLessons}</div><div class="stat-label">Pelajaran</div></div>
  `;

  // ── Category filter chips ──────────────────────────────────
  let filterBar = $('cat-filter-bar');
  if (!filterBar) {
    filterBar = document.createElement('div');
    filterBar.id = 'cat-filter-bar';
    filterBar.className = 'cat-filter-bar';
    const grid = $('course-grid');
    grid.parentNode.insertBefore(filterBar, grid);
  }
  filterBar.innerHTML = CATEGORIES.map(cat => `
    <button class="cat-chip${state.activeCategory === cat.id ? ' active' : ''}" data-cat="${cat.id}">
      <span class="cat-chip-emoji">${cat.emoji}</span>
      ${cat.label}
    </button>
  `).join('');
  filterBar.querySelectorAll('.cat-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCategory = btn.dataset.cat;
      applyCategoryFilter();
      // Update chip states
      filterBar.querySelectorAll('.cat-chip').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === state.activeCategory));
      // Sync sidebar
      renderNav();
    });
  });

  // ── Course grid ─────────────────────────────────────────────
  const grid = $('course-grid');
  grid.innerHTML = '';
  state.courses.forEach((course, idx) => {
    const catId = getCourseCategory(course);
    const thumb = getCourseThumb(course);
    const catEmoji = getCatEmoji(catId);
    const totalL = course.modules.reduce((s, m) => s + m.lessons.length, 0);
    const hasVideo = course.modules.some(m => m.lessons.some(l => l.youtube_urls?.length || l.video_urls?.length));
    const mentorsHtml = course.mentors?.length
      ? `<span class="card-pill">${escapeHtml(course.mentors.slice(0,2).join(', '))}${course.mentors.length>2?` +${course.mentors.length-2}`:''}</span>`
      : '';

    const card = document.createElement('div');
    card.className = 'course-card animate-in';
    card.dataset.category = catId;
    card.style.setProperty('--card-accent', CARD_ACCENTS[idx % CARD_ACCENTS.length]);
    card.style.animationDelay = `${idx * 35}ms`;
    card.innerHTML = `
      <div class="card-thumb">
        ${thumb ? `<img src="${thumb}" loading="lazy" alt="" decoding="async" onerror="this.style.display='none'">` : ''}
        <div class="card-thumb-placeholder">${catEmoji}</div>
      </div>
      <div class="card-body">
        <div class="card-number">KURSUS ${idx + 1} • ${escapeHtml(CATEGORIES.find(c=>c.id===catId)?.label||'')}</div>
        <div class="card-title">${escapeHtml(course.course_title)}</div>
        <div class="card-desc">${escapeHtml(course.about_course || course.course_description || '')}</div>
        <div class="card-footer">
          <div class="card-pills">
            <span class="card-pill accent">${totalL} pelajaran</span>
            ${hasVideo ? '<span class="card-pill">🎬 Video</span>' : ''}
            ${mentorsHtml}
          </div>
          <div class="card-arrow">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </div>
        </div>
      </div>
    `;
    card.addEventListener('click', () => goToCourse(idx));
    grid.appendChild(card);
  });

  applyCategoryFilter();
}

function applyCategoryFilter() {
  const grid = $('course-grid');
  if (!grid) return;
  grid.querySelectorAll('.course-card').forEach(card => {
    const match = state.activeCategory === 'all' || card.dataset.category === state.activeCategory;
    card.classList.toggle('cat-hidden', !match);
  });
}

// ── Go to Course ───────────────────────────────────────────────
function goToCourse(idx) {
  state.currentCourseIdx = idx;
  const course = state.courses[idx];
  renderNav();
  renderCourse(course, idx);
  showView('course');
  updateBreadcrumb('course');
}

function renderCourse(course, idx) {
  $('course-hero-badge').textContent = `Kursus ${idx + 1} dari ${state.courses.length}`;
  $('course-title').textContent = course.course_title;

  const totalL = course.modules.reduce((s,m) => s + m.lessons.length, 0);
  const totalVideos = course.modules.reduce((s,m) => s + m.lessons.filter(l => l.youtube_urls?.length || l.video_urls?.length).length, 0);

  const metaHtml = [
    course.modules.length ? `<div class="meta-item"><span class="meta-dot"></span>${course.modules.length} Modul</div>` : '',
    totalL ? `<div class="meta-item"><span class="meta-dot orange"></span>${totalL} Pelajaran</div>` : '',
    totalVideos ? `<div class="meta-item"><span class="meta-dot red"></span>${totalVideos} Video</div>` : '',
    course.mentors?.length ? `<div class="meta-item"><span class="meta-dot purple"></span>${escapeHtml(course.mentors.join(', '))}</div>` : '',
  ].join('');
  $('course-meta').innerHTML = metaHtml;

  // ── About Section ──────────────────────────────────────────
  const aboutEl = $('course-about-section');
  const rawAbout = (course.about_course || '').trim();
  const rawDesc  = (course.course_description || '').trim();

  // Build sections from about_course (may contain embedded headings separated by double newline)
  let aboutHtml = '';

  if (rawAbout) {
    // Parse into paragraphs; detect inline headings (short lines ending without period or that look like titles)
    const paras = rawAbout.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
    const rendered = paras.map(para => {
      const lines = para.split('\n');
      // If single short line (<= 80 chars, no trailing period), treat as heading
      if (lines.length === 1 && lines[0].length <= 80 && !lines[0].endsWith('.')) {
        return `<h3 class="about-heading">${escapeHtml(lines[0])}</h3>`;
      }
      return `<p class="about-para">${lines.map(l => escapeHtml(l)).join('<br/>')}</p>`;
    }).join('');

    aboutHtml = rendered;
  }

  // Mentors block
  let mentorsHtml = '';
  if (course.mentors?.length) {
    mentorsHtml = `
      <div class="about-mentors">
        <div class="about-subheading">Mentor</div>
        <div class="mentor-list">
          ${course.mentors.map(m => `
            <div class="mentor-chip">
              <div class="mentor-avatar">${escapeHtml(m.charAt(0).toUpperCase())}</div>
              <span>${escapeHtml(m)}</span>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // Stats chips
  const statsHtml = `
    <div class="about-stats">
      ${course.modules.length ? `<div class="about-stat"><span class="about-stat-num">${course.modules.length}</span><span class="about-stat-lbl">Modul</span></div>` : ''}
      ${totalL ? `<div class="about-stat"><span class="about-stat-num">${totalL}</span><span class="about-stat-lbl">Pelajaran</span></div>` : ''}
      ${totalVideos ? `<div class="about-stat"><span class="about-stat-num">${totalVideos}</span><span class="about-stat-lbl">Video</span></div>` : ''}
    </div>`;

  if (!aboutHtml && !mentorsHtml) {
    aboutEl.innerHTML = '';
  } else {
    const PREVIEW_LINES = 6; // how many lines to show before "Baca selengkapnya"
    const fullContent = `${statsHtml}${mentorsHtml}<div class="about-body">${aboutHtml}</div>`;

    // Count newlines to decide if we need a read-more
    const lineCount = rawAbout.split('\n').length;
    const needsToggle = lineCount > PREVIEW_LINES;

    aboutEl.innerHTML = `
      <div class="course-about-card">
        <div class="about-card-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          Tentang Kursus
        </div>
        ${statsHtml}
        ${mentorsHtml}
        ${aboutHtml ? `
          <div class="about-body${needsToggle ? ' collapsed' : ''}" id="about-body">
            ${aboutHtml}
          </div>
          ${needsToggle ? `<button class="about-toggle-btn" id="about-toggle-btn" onclick="toggleAbout()">Baca selengkapnya <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg></button>` : ''}
        ` : ''}
      </div>`;
  }

  // Flat lessons for this course
  state.currentLessonFlat = buildFlatLessons(idx);

  // Modules
  const modList = $('module-list');
  modList.innerHTML = '';
  course.modules.forEach((mod, mIdx) => {
    const block = document.createElement('div');
    block.className = 'module-block animate-in';
    block.style.animationDelay = `${mIdx * 50}ms`;

    const header = document.createElement('div');
    header.className = 'module-header';
    header.innerHTML = `
      <span class="module-title">${escapeHtml(mod.module_title)}</span>
      <span class="module-count">${mod.lessons.length} pelajaran</span>
    `;

    const ul = document.createElement('ul');
    ul.className = 'module-lessons';

    let lessonCounter = 0;
    mod.lessons.forEach((lesson, lIdx) => {
      lessonCounter++;
      const hasYt = lesson.youtube_urls?.length > 0;
      const hasVid = lesson.video_urls?.length > 0;
      const hasText = !!cleanText(lesson.text_content || '');

      // Global flat index
      const flatIdx = state.currentLessonFlat.findIndex(fl => fl.moduleIdx === mIdx && fl.lessonIdx === lIdx);

      const li = document.createElement('li');
      li.className = 'lesson-item';
      li.innerHTML = `
        <span class="lesson-num">${lessonCounter}</span>
        <div class="lesson-info">
          <div class="lesson-name">${escapeHtml(lesson.title)}</div>
          <div class="lesson-badges">
            ${hasYt ? `<span class="lesson-badge yt">▶ YouTube</span>` : ''}
            ${hasVid ? `<span class="lesson-badge video">🎬 Video</span>` : ''}
            ${hasText ? `<span class="lesson-badge text">📝 Teks</span>` : ''}
          </div>
        </div>
        <svg class="lesson-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      `;
      li.addEventListener('click', () => goToLesson(flatIdx));
      ul.appendChild(li);
    });

    block.appendChild(header);
    block.appendChild(ul);
    modList.appendChild(block);
  });
}

// ── Go to Lesson ───────────────────────────────────────────────
function goToLesson(flatIdx) {
  if (flatIdx < 0 || flatIdx >= state.currentLessonFlat.length) return;
  state.currentLessonFlatIdx = flatIdx;
  state.currentVideoIdx = 0;
  // Reset quiz state
  state.currentQuizAnswers = {};
  state.currentQuizSubmitted = false;
  state.currentQuizStarted = false;
  renderLesson();
  showView('lesson');
  updateBreadcrumb('lesson');
  $('lesson-counter').textContent = `${flatIdx + 1} / ${state.currentLessonFlat.length}`;
}

function renderLesson() {
  const { lesson, moduleName } = state.currentLessonFlat[state.currentLessonFlatIdx];
  const flatIdx = state.currentLessonFlatIdx;
  const total = state.currentLessonFlat.length;

  // Title
  $('lesson-title').textContent = lesson.title;

  const lessonTextEl = $('lesson-text');
  const quizContainer = $('quiz-container');
  const videoContainer = $('video-container');

  if (lesson.quiz_data) {
    lessonTextEl.style.display = 'none';
    videoContainer.style.display = 'none';
    
    if (quizContainer) {
      quizContainer.style.display = '';
      renderQuiz(lesson.quiz_data, quizContainer);
    }
    
    // Nav pills
    const pills = $('lesson-nav-pills');
    pills.innerHTML = `
      <button class="nav-pill-btn" id="prev-lesson-btn" ${flatIdx === 0 ? 'disabled' : ''}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        Prev
      </button>
      <span style="font-size:12px;color:var(--text-tertiary);padding:0 6px;align-self:center">${moduleName}</span>
      <button class="nav-pill-btn" id="next-lesson-btn" ${flatIdx === total - 1 ? 'disabled' : ''}>
        Next
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </button>
    `;
    document.getElementById('prev-lesson-btn')?.addEventListener('click', () => goToLesson(flatIdx - 1));
    document.getElementById('next-lesson-btn')?.addEventListener('click', () => goToLesson(flatIdx + 1));
    
    renderLessonSidebar();
    return;
  }

  // Hide quiz container if it was shown previously
  if (quizContainer) {
    quizContainer.style.display = 'none';
    quizContainer.innerHTML = '';
  }

  // Text content
  const formattedText = formatText(lesson.text_content);
  if (formattedText) {
    lessonTextEl.innerHTML = formattedText;
    lessonTextEl.style.display = '';
  } else {
    // No real text — only show if there's also no video
    const hasAnyVideo = (lesson.youtube_urls?.length || 0) + (lesson.video_urls?.length || 0) > 0;
    if (hasAnyVideo) {
      lessonTextEl.innerHTML = '';
      lessonTextEl.style.display = 'none';
    } else {
      lessonTextEl.innerHTML = '<em style="color:var(--text-tertiary);font-size:14px">Materi ini hanya tersedia dalam format video.</em>';
      lessonTextEl.style.display = '';
    }
  }

  // Nav pills
  const pills = $('lesson-nav-pills');
  pills.innerHTML = `
    <button class="nav-pill-btn" id="prev-lesson-btn" ${flatIdx === 0 ? 'disabled' : ''}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
      Prev
    </button>
    <span style="font-size:12px;color:var(--text-tertiary);padding:0 6px;align-self:center">${moduleName}</span>
    <button class="nav-pill-btn" id="next-lesson-btn" ${flatIdx === total - 1 ? 'disabled' : ''}>
      Next
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
    </button>
  `;
  document.getElementById('prev-lesson-btn')?.addEventListener('click', () => goToLesson(flatIdx - 1));
  document.getElementById('next-lesson-btn')?.addEventListener('click', () => goToLesson(flatIdx + 1));

  // Video
  const allVideos = [];
  (lesson.youtube_urls || []).forEach((url, i) => {
    allVideos.push({ type: 'youtube', url, label: lesson.youtube_urls.length > 1 ? `Video ${i+1}` : 'YouTube' });
  });
  (lesson.video_urls || []).forEach((url, i) => {
    allVideos.push({ type: 'direct', url, label: lesson.video_urls.length > 1 ? `Video ${i+1}` : 'Video' });
  });

  const videoContainer = $('video-container');
  const videoWrapper = $('video-wrapper');

  if (allVideos.length > 0) {
    videoContainer.style.display = '';

    // Build tab row if multiple
    let tabsHtml = '';
    if (allVideos.length > 1) {
      tabsHtml = `<div class="video-tabs">` +
        allVideos.map((v, i) => `
          <button class="video-tab-btn${i === state.currentVideoIdx ? ' active' : ''}" data-vidx="${i}">
            <span class="yt-dot"></span>${escapeHtml(v.label)}
          </button>
        `).join('') +
        `</div>`;
    }

    // Inject above video wrapper (inside videoContainer parent we need a flex col)
    videoContainer.innerHTML = `
      ${tabsHtml}
      <div id="video-wrapper" class="video-wrapper">${buildVideoEmbed(allVideos[state.currentVideoIdx])}</div>
    `;

    // Tab click events
    videoContainer.querySelectorAll('.video-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentVideoIdx = parseInt(btn.dataset.vidx);
        document.getElementById('video-wrapper').innerHTML = buildVideoEmbed(allVideos[state.currentVideoIdx]);
        videoContainer.querySelectorAll('.video-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

  } else {
    videoContainer.style.display = 'none';
    videoContainer.innerHTML = '<div id="video-wrapper" class="video-wrapper"></div>';
  }

  // Sidebar lesson list
  renderLessonSidebar();
}

function buildVideoEmbed(vid) {
  if (vid.type === 'youtube') {
    const embed = buildYoutubeEmbed(vid.url);
    if (!embed) return `<p style="color:white;padding:20px">Tidak dapat memuat video.</p>`;
    return `<iframe src="${embed}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`;
  }
  // Direct video
  return `<video controls style="width:100%;height:100%;background:#000"><source src="${escapeHtml(vid.url)}">Browser tidak mendukung video ini.</video>`;
}

function renderLessonSidebar() {
  const container = $('lesson-list-sidebar');
  container.innerHTML = '';
  const flat = state.currentLessonFlat;
  let lastModule = null;

  flat.forEach((item, i) => {
    if (item.moduleName !== lastModule) {
      const sep = document.createElement('div');
      sep.style.cssText = 'padding:10px 16px 4px;font-size:10px;font-weight:700;color:var(--text-tertiary);letter-spacing:0.6px;text-transform:uppercase;background:var(--bg);border-bottom:1px solid var(--border-subtle)';
      sep.textContent = item.moduleName;
      container.appendChild(sep);
      lastModule = item.moduleName;
    }

    const el = document.createElement('div');
    el.className = 'sidebar-lesson-item' + (i === state.currentLessonFlatIdx ? ' active' : '');
    el.innerHTML = `<span class="sidebar-lesson-num">${i + 1}</span><span>${escapeHtml(item.lesson.title)}</span>`;
    el.addEventListener('click', () => goToLesson(i));
    container.appendChild(el);
  });

  // Scroll active into view
  const active = container.querySelector('.sidebar-lesson-item.active');
  if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ── Breadcrumb ─────────────────────────────────────────────────
function updateBreadcrumb(view) {
  let html = `<span class="breadcrumb-home" id="bc-home">Home</span>`;
  if (view === 'course' || view === 'lesson') {
    const course = state.courses[state.currentCourseIdx];
    html += `<span class="breadcrumb-sep">›</span><span class="breadcrumb-course" id="bc-course">${escapeHtml(course.course_title)}</span>`;
  }
  if (view === 'lesson') {
    const { lesson } = state.currentLessonFlat[state.currentLessonFlatIdx];
    html += `<span class="breadcrumb-sep">›</span><span class="breadcrumb-lesson">${escapeHtml(lesson.title)}</span>`;
  }
  breadcrumb.innerHTML = html;

  document.getElementById('bc-home')?.addEventListener('click', goHome);
  document.getElementById('bc-course')?.addEventListener('click', () => goToCourse(state.currentCourseIdx));
}

function toggleAbout() {
  const body = document.getElementById('about-body');
  const btn  = document.getElementById('about-toggle-btn');
  if (!body || !btn) return;
  const isCollapsed = body.classList.toggle('collapsed');
  btn.innerHTML = isCollapsed
    ? 'Baca selengkapnya <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>'
    : 'Sembunyikan <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>';
}

function goHome() {
  state.currentCourseIdx = null;
  state.currentLessonFlatIdx = null;
  renderNav();
  showView('home');
  breadcrumb.innerHTML = `<span class="breadcrumb-home" id="bc-home">Home</span>`;
  document.getElementById('bc-home')?.addEventListener('click', goHome);
  $('lesson-counter').textContent = '';
}

// ── Keyboard shortcuts ─────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (lessonView.classList.contains('active') && state.currentLessonFlatIdx !== null) {
      const next = state.currentLessonFlatIdx + 1;
      if (next < state.currentLessonFlat.length) goToLesson(next);
    }
  }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (lessonView.classList.contains('active') && state.currentLessonFlatIdx !== null) {
      const prev = state.currentLessonFlatIdx - 1;
      if (prev >= 0) goToLesson(prev);
    }
  }
  if (e.key === 'Escape') {
    if (state.mobileSidebarOpen) closeMobileSidebar();
    else if (lessonView.classList.contains('active')) goToCourse(state.currentCourseIdx);
    else if (courseView.classList.contains('active')) goHome();
  }
});

// ── Render Quiz ────────────────────────────────────────────────
function renderQuiz(quiz, container) {
  if (!state.currentQuizStarted) {
    // Render splash page
    const detail = quiz.detail || {};
    const questions = quiz.questions || [];
    container.innerHTML = `
      <div class="quiz-splash-card animate-in">
        <div class="quiz-splash-icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"></path>
            <path d="m9 12 2 2 4-4"></path>
          </svg>
        </div>
        <h2 class="quiz-splash-title">${escapeHtml(detail.title || 'Mulai Kuis')}</h2>
        ${detail.description ? `<p class="quiz-splash-desc">${escapeHtml(detail.description)}</p>` : ''}
        
        <div class="quiz-info-grid">
          <div class="quiz-info-item">
            <span class="quiz-info-label">Jumlah Soal</span>
            <span class="quiz-info-value">${questions.length} Soal</span>
          </div>
          <div class="quiz-info-item">
            <span class="quiz-info-label">Durasi</span>
            <span class="quiz-info-value">${detail.duration || '30'} Menit</span>
          </div>
          <div class="quiz-info-item">
            <span class="quiz-info-label">Passing Grade</span>
            <span class="quiz-info-value">${detail.kkm || '60'}%</span>
          </div>
        </div>
        
        <button id="start-quiz-btn" class="quiz-btn primary">Mulai Kuis</button>
      </div>
    `;
    
    document.getElementById('start-quiz-btn').addEventListener('click', () => {
      state.currentQuizStarted = true;
      renderQuiz(quiz, container);
    });
    return;
  }
  
  // Quiz is started. Render questions list
  const detail = quiz.detail || {};
  const questions = quiz.questions || [];
  
  let html = '';
  
  // If submitted, show result banner at the top
  if (state.currentQuizSubmitted) {
    let correctCount = 0;
    questions.forEach(q => {
      const selectedOptId = state.currentQuizAnswers[q.id];
      const correctOpt = q.options.find(o => o.is_right === 1 || o.is_right === '1');
      if (selectedOptId && correctOpt && Number(selectedOptId) === Number(correctOpt.id)) {
        correctCount++;
      }
    });
    const score = Math.round((correctCount / questions.length) * 100);
    const kkm = detail.kkm || 60;
    const isPassed = score >= kkm;
    
    html += `
      <div class="quiz-result-banner ${isPassed ? 'passed' : 'failed'} animate-in">
        <div class="quiz-result-header">
          <span class="quiz-result-badge">${isPassed ? 'LULUS' : 'COBA LAGI'}</span>
          <span class="quiz-result-score">Skor Anda: <strong>${score}%</strong></span>
        </div>
        <p class="quiz-result-text">
          ${isPassed 
            ? 'Luar biasa! Anda telah berhasil melampaui batas nilai kelulusan (KKM) untuk topik ini.' 
            : `Nilai Anda masih di bawah batas kelulusan (KKM: ${kkm}%). Silakan pelajari kembali materinya dan coba lagi.`}
        </p>
        <div class="quiz-result-stats">
          <span>Benar: <strong>${correctCount}</strong> dari <strong>${questions.length}</strong></span>
          <button id="retry-quiz-btn" class="quiz-btn secondary small">Mulai Ulang Kuis</button>
        </div>
      </div>
    `;
  }
  
  // Render questions
  html += `<div class="quiz-questions-list">`;
  questions.forEach((q, qIdx) => {
    html += `
      <div class="quiz-question-card">
        <div class="quiz-question-header">
          <span class="quiz-question-number">SOAL ${qIdx + 1}</span>
          <div class="quiz-question-body">${q.content}</div>
        </div>
        <div class="quiz-options-list" data-qid="${q.id}">
    `;
    
    q.options.forEach(opt => {
      const isSelected = state.currentQuizAnswers[q.id] === opt.id;
      const isRightOpt = opt.is_right === 1 || opt.is_right === '1';
      
      let optClass = '';
      if (isSelected) optClass += ' selected';
      
      if (state.currentQuizSubmitted) {
        optClass += ' disabled';
        if (isRightOpt) {
          optClass += ' correct';
        } else if (isSelected) {
          optClass += ' incorrect';
        }
      }
      
      html += `
        <div class="quiz-option-item${optClass}" data-optid="${opt.id}">
          <div class="quiz-option-radio">
            <div class="quiz-option-radio-inner"></div>
          </div>
          <div class="quiz-option-text">${escapeHtml(opt.content)}</div>
          ${state.currentQuizSubmitted && isRightOpt ? '<span class="quiz-option-badge correct">Benar</span>' : ''}
          ${state.currentQuizSubmitted && isSelected && !isRightOpt ? '<span class="quiz-option-badge incorrect">Salah</span>' : ''}
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  html += `</div>`;
  
  // Submit button at the bottom if not submitted
  if (!state.currentQuizSubmitted) {
    const answeredCount = Object.keys(state.currentQuizAnswers).length;
    const isAllAnswered = answeredCount === questions.length;
    
    html += `
      <div class="quiz-footer-actions">
        <span class="quiz-progress-text">${answeredCount} dari ${questions.length} soal dijawab</span>
        <button id="submit-quiz-btn" class="quiz-btn primary" ${isAllAnswered ? '' : 'disabled'}>Kirim Jawaban</button>
      </div>
    `;
  }
  
  container.innerHTML = html;
  
  // Bind events
  if (!state.currentQuizSubmitted) {
    container.querySelectorAll('.quiz-option-item').forEach(el => {
      el.addEventListener('click', () => {
        const optionId = parseInt(el.dataset.optid);
        const questionId = parseInt(el.closest('.quiz-options-list').dataset.qid);
        
        state.currentQuizAnswers[questionId] = optionId;
        renderQuiz(quiz, container);
      });
    });
    
    const submitBtn = document.getElementById('submit-quiz-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', () => {
        state.currentQuizSubmitted = true;
        renderQuiz(quiz, container);
        container.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  } else {
    const retryBtn = document.getElementById('retry-quiz-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        state.currentQuizAnswers = {};
        state.currentQuizSubmitted = false;
        state.currentQuizStarted = false;
        renderQuiz(quiz, container);
      });
    }
  }
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  // COURSE_DATA is injected from data.js (works without a server)
  if (typeof COURSE_DATA !== 'undefined' && Array.isArray(COURSE_DATA)) {
    state.courses = COURSE_DATA;
  } else {
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:Inter,sans-serif;text-align:center;color:#6e6e73;padding:20px">
        <div>
          <div style="font-size:40px;margin-bottom:12px">⚠️</div>
          <h2 style="color:#1d1d1f;margin-bottom:8px">Data tidak ditemukan</h2>
          <p>Pastikan file <code>data.js</code> ada di folder <code>course-viewer/</code>.</p>
        </div>
      </div>`;
    return;
  }

  renderNav();
  renderHome();
  showView('home');
  updateBreadcrumb('home');
}

init();
