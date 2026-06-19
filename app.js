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
  // Current top-level view: 'home' | 'roadmap'
  topView: 'home',
};

// ── Lesson Understanding Tags — localStorage persistence ────────
// Key format: `understanding_${courseSlug}_${lessonTitle_hash}`
// Values: 'mengerti' | 'ragu' | 'belum' | null

function getLessonKey(courseIdx, flatIdx) {
  const course = state.courses[courseIdx];
  const item = state.currentLessonFlat[flatIdx];
  if (!course || !item) return null;
  const slug = course.course_slug || courseIdx;
  const lessonId = `${item.moduleIdx}_${item.lessonIdx}`;
  return `understanding_${slug}_${lessonId}`;
}

function getLessonUnderstanding(courseIdx, flatIdx) {
  const key = getLessonKey(courseIdx, flatIdx);
  if (!key) return null;
  return localStorage.getItem(key) || null;
}

function setLessonUnderstanding(courseIdx, flatIdx, value) {
  const key = getLessonKey(courseIdx, flatIdx);
  if (!key) return;
  if (value) {
    localStorage.setItem(key, value);
  } else {
    localStorage.removeItem(key);
  }
}

// ── Quiz Results — localStorage persistence ─────────────────────
// Key: `quiz_result_${courseSlug}_${lessonKey}`
function getQuizResultKey(courseIdx, flatIdx) {
  const course = state.courses[courseIdx];
  const item = state.currentLessonFlat[flatIdx];
  if (!course || !item) return null;
  const slug = course.course_slug || courseIdx;
  return `quiz_result_${slug}_${item.moduleIdx}_${item.lessonIdx}`;
}

function saveQuizResult(courseIdx, flatIdx, answers, submitted, started) {
  const key = getQuizResultKey(courseIdx, flatIdx);
  if (!key) return;
  localStorage.setItem(key, JSON.stringify({ answers, submitted, started }));
}

function loadQuizResult(courseIdx, flatIdx) {
  const key = getQuizResultKey(courseIdx, flatIdx);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

// ── Understanding Tag Meta ──────────────────────────────────────
const UNDERSTANDING_TAGS = [
  { value: 'mengerti', label: 'Mengerti', icon: '✅', color: '#30d158', bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.4)' },
  { value: 'ragu',     label: 'Ragu-ragu', icon: '⚠️', color: '#ff9f0a', bg: 'rgba(255,159,10,0.12)', border: 'rgba(255,159,10,0.4)' },
  { value: 'belum',    label: 'Belum Paham', icon: '❌', color: '#ff375f', bg: 'rgba(255,55,95,0.12)', border: 'rgba(255,55,95,0.4)' },
];

function getTagMeta(value) {
  return UNDERSTANDING_TAGS.find(t => t.value === value) || null;
}

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

// ── Roadmap Groups and Categories (dynamic from COURSE_META) ───
let ROADMAP_GROUPS = [];
let CATEGORIES = [];

const CATEGORY_DESCS = {
  'g-panduan': 'Baca terlebih dahulu panduan ini sebelum memulai belajar',
  'g-intro': 'Materi seputar pengenalan pemrograman, profesi, manajemen kode, sampai kepada algoritma dasar',
  'g-uiux': 'Belajar konsep dasar desain antarmuka dan pengalaman pengguna (UI/UX)',
  'g-febasic': 'Belajar dasar-dasar ilmu frontend web development. Terkait dengan antarmuka pengguna aplikasi.',
  'g-feintermediate': 'Belajar berbagai framework terkait frontend development, serta studi kasusnya',
  'g-bebasic-php': 'Belajar dasar-dasar ilmu backend web development. Terkait dengan kode pada sisi server.',
  'g-beintermediate-php': 'Lanjutan backend, belajar framework dan studi kasus khusus sisi server.',
  'g-bebasic-js': 'Belajar backend murni menggunakan teknologi Javascript',
  'g-beintermediate-js': 'Kumpulan kelas Javascript dengan materi Expert',
  'g-testing': 'Mempelajari pengujian software (Software Testing) untuk memastikan kualitas kode',
  'g-deployment': 'Langkah-langkah menaruh aplikasi di server internet agar bisa diakses oleh publik',
  'g-career': 'Persiapan karir, CV, portfolio, interview, dan tips berkarir di industri IT',
  'g-bonus': 'Bonus kelas spesial untuk persiapan kamu terjun ke industri sebenarnya.'
};

function getCourseMeta(course) {
  const slug = course.course_slug || '';
  return COURSE_META.courses[slug] || {
    categoryId: 'g-bonus',
    imgSrc: '',
    tags: [],
    duration: '1 Jam'
  };
}

function getCourseCategory(course) {
  const meta = getCourseMeta(course);
  return meta.categoryId || 'g-bonus';
}

function getCourseGroup(course) {
  const catId = getCourseCategory(course);
  return ROADMAP_GROUPS.find(c => c.id === catId) || ROADMAP_GROUPS[0];
}

function getCourseThumbnailSrc(course) {
  const meta = getCourseMeta(course);
  if (meta.imgSrc) return meta.imgSrc;
  return getCourseThumb(course) || '';
}

function getCatEmoji(catId) {
  const cat = ROADMAP_GROUPS.find(c => c.id === catId);
  return cat ? cat.emoji : '📚';
}


function getCourseThumb(course, quality = 'hqdefault') {
  for (const mod of (course.modules || [])) {
    for (const lesson of (mod.lessons || [])) {
      const ytUrls = lesson.youtube_urls || [];
      if (ytUrls.length > 0) {
        const id = getYoutubeId(ytUrls[0]);
        if (id) return `https://img.youtube.com/vi/${id}/${quality}.jpg`;
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
const roadmapView = $('roadmap-view');
const courseView = $('course-view');
const lessonView = $('lesson-view');

// ── Show/Hide Views ────────────────────────────────────────────
function showView(name) {
  [homeView, roadmapView, courseView, lessonView].forEach(v => v && v.classList.remove('active'));
  if (name === 'home') homeView.classList.add('active');
  else if (name === 'roadmap') roadmapView && roadmapView.classList.add('active');
  else if (name === 'course') courseView.classList.add('active');
  else if (name === 'lesson') lessonView.classList.add('active');

  // Show/hide mobile bottom bar
  const mobBar = $('mobile-lesson-bar');
  if (mobBar) {
    mobBar.style.display = (name === 'lesson') ? 'flex' : 'none';
  }

  // Stop video playback when leaving lesson view
  if (name !== 'lesson') {
    const vw = document.getElementById('video-wrapper');
    if (vw) vw.innerHTML = '';
  }

  const homeBtn = document.getElementById('nav-home-btn');
  const rmBtn = document.getElementById('nav-roadmap-btn');
  if (homeBtn) homeBtn.classList.toggle('active', name === 'home');
  if (rmBtn) rmBtn.classList.toggle('active', name === 'roadmap');
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// ── Sidebar toggle ─────────────────────────────────────────────
sidebarToggle.addEventListener('click', () => {
  state.sidebarCollapsed = !state.sidebarCollapsed;
  sidebar.classList.toggle('collapsed', state.sidebarCollapsed);
  mainContent.classList.toggle('expanded', state.sidebarCollapsed);
});

// Wire sidebar top nav buttons via addEventListener (not onclick= attr)
const _navHomeBtn = document.getElementById('nav-home-btn');
const _navRoadmapBtn = document.getElementById('nav-roadmap-btn');
if (_navHomeBtn) _navHomeBtn.addEventListener('click', () => goHome());
if (_navRoadmapBtn) _navRoadmapBtn.addEventListener('click', () => goRoadmap());

mobileMenuBtn.addEventListener('click', () => {
  if (window.innerWidth > 768) {
    state.sidebarCollapsed = false;
    sidebar.classList.remove('collapsed');
    mainContent.classList.remove('expanded');
  } else {
    state.mobileSidebarOpen = true;
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
  }
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

  // When searching: lesson-level results grouped by course
  if (filt) {
    const searchHeader = document.createElement('div');
    searchHeader.className = 'nav-section-label';
    searchHeader.textContent = 'Hasil pencarian';
    courseNav.appendChild(searchHeader);

    let resultCount = 0;
    state.courses.forEach((course, courseIdx) => {
      const titleMatch = course.course_title.toLowerCase().includes(filt);

      // Collect matching lessons
      const matchingLessons = [];
      (course.modules || []).forEach((mod, mIdx) => {
        (mod.lessons || []).forEach((lesson, lIdx) => {
          if (lesson.title && lesson.title.toLowerCase().includes(filt)) {
            matchingLessons.push({ mIdx, lIdx, lesson });
          }
        });
      });

      if (!titleMatch && matchingLessons.length === 0) return;

      if (titleMatch && matchingLessons.length === 0) {
        // Course title matched — navigate to course overview
        const btn = document.createElement('button');
        btn.className = 'nav-item nav-item-course' + (state.currentCourseIdx === courseIdx ? ' active' : '');
        btn.innerHTML = `
          <span class="nav-index">${courseIdx + 1}</span>
          <span class="nav-text">${escapeHtml(course.course_title)}</span>
        `;
        btn.addEventListener('click', () => { goToCourse(courseIdx); closeMobileSidebar(); });
        courseNav.appendChild(btn);
        resultCount++;
      } else {
        // Add course header label above the lessons
        const courseHeader = document.createElement('div');
        courseHeader.className = 'nav-search-course-header';
        courseHeader.textContent = `${courseIdx + 1}. ${course.course_title}`;
        courseNav.appendChild(courseHeader);

        matchingLessons.forEach(({ mIdx, lIdx, lesson }) => {
          const btn = document.createElement('button');
          btn.className = 'nav-item nav-item-lesson';
          btn.innerHTML = `
            <span class="nav-lesson-icon">▶</span>
            <span class="nav-lesson-info">
              <span class="nav-lesson-title">${escapeHtml(lesson.title)}</span>
            </span>
          `;
          btn.addEventListener('click', () => {
            goToLessonDirect(courseIdx, mIdx, lIdx);
            closeMobileSidebar();
          });
          courseNav.appendChild(btn);
          resultCount++;
        });
      }
    });

    if (resultCount === 0) {
      const empty = document.createElement('div');
      empty.style.cssText = 'padding:16px;font-size:12px;color:var(--text-tertiary);text-align:center';
      empty.textContent = 'Tidak ada hasil ditemukan';
      courseNav.appendChild(empty);
    }
    return;
  }

  // No search: show roadmap groups in sidebar
  // Build map: groupId -> [{courseIdx, course}]
  const groupMap = {};
  ROADMAP_GROUPS.forEach(g => { groupMap[g.id] = []; });
  state.courses.forEach((course, idx) => {
    const g = getCourseGroup(course);
    if (groupMap[g.id]) groupMap[g.id].push({ idx, course });
    else groupMap[ROADMAP_GROUPS[0].id].push({ idx, course });
  });

  ROADMAP_GROUPS.forEach(group => {
    const items = groupMap[group.id] || [];
    if (!items.length) return;

    const hasActive = items.some(it => it.idx === state.currentCourseIdx);
    const isCollapsed = state.categoryCollapsed[group.id] !== false && !hasActive;

    const grpEl = document.createElement('div');
    grpEl.className = 'cat-group' + (isCollapsed ? ' collapsed' : '');
    grpEl.dataset.catId = group.id;

    grpEl.innerHTML = `
      <button class="cat-header" data-cat="${group.id}" style="--grp-color:${group.color}">
        <span class="cat-emoji">${group.emoji}</span>
        <span class="cat-label">${group.label}</span>
        <span class="cat-count">${items.length}</span>
        <span class="cat-chevron">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
        </span>
      </button>
      <div class="cat-body"></div>
    `;

    const body = grpEl.querySelector('.cat-body');
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

    grpEl.querySelector('.cat-header').addEventListener('click', () => {
      const col = grpEl.classList.toggle('collapsed');
      state.categoryCollapsed[group.id] = col;
    });

    if (hasActive) {
      grpEl.classList.remove('collapsed');
      state.categoryCollapsed[group.id] = false;
    }

    courseNav.appendChild(grpEl);
  });
}

searchInput.addEventListener('input', () => renderNav(searchInput.value));

// ── Update Log Data & Renderer ─────────────────────────────────
const UPDATE_LOG = [
  { date: '18 Juni 2026', text: 'NodeJS Mastery from Zero to Hero' },
  { date: '27 April 2026', text: 'Create an Event Management Platform Like Goers with ExpressJS + Xendit' },
  { date: '9 Februari 2026', text: 'Introduction to DevOps Fundamentals: Building Your First Automation Path' },
  { date: '8 Desember 2025', text: 'Security For Developer (Build your application to be super tough)' },
  { date: '21 Oktober 2025', text: 'Learn PHP for Beginners : Concept and Practice [Enhanced]' },
  { date: '10 September 2025', text: 'PHP Native & MySQL : Building an OLX Clone Website with AI Assist Windsurf' },
  { date: '24 Juli 2025', text: 'Developing a QR-based Restaurant Application with Laravel 12' },
  { date: '16 Juni 2025', text: 'Tailwind Basics - Modern High-Speed Web Design' },
  { date: '05 Mei 2025', text: 'Filament for Beginners: Laravel Admin Without the Headache' },
  { date: '23 April 2025', text: 'Developing an HRIS System Like Talenta Using Laravel 12' },
  { date: '25 Februari 2025', text: 'Developing a Streaming System Like Netflix Using Laravel 11' },
  { date: '17 Februari 2025', text: 'Laravel 11 : Creating a Social Media Application Backend with REST API' },
  { date: '14 Januari 2025', text: 'Developer & Design: Building a Solid UI/UX Foundation' }
];

let showAllUpdates = false;

function renderUpdateLog() {
  const logEl = $('update-log-card');
  if (!logEl) return;

  const visibleUpdates = showAllUpdates ? UPDATE_LOG : UPDATE_LOG.slice(0, 5);

  logEl.innerHTML = `
    <div class="update-log-title">
      <span>📢 Log Pembaruan</span>
    </div>
    <ul class="update-log-list">
      ${visibleUpdates.map(item => `
        <li class="update-log-item">
          <div class="update-log-header">
            <span class="update-log-date">${escapeHtml(item.date)}</span>
          </div>
          <div class="update-log-text">${escapeHtml(item.text)}</div>
        </li>
      `).join('')}
    </ul>
    ${UPDATE_LOG.length > 5 ? `
      <button class="about-toggle-btn" id="update-log-toggle-btn" style="margin-top: 16px; font-weight: 600;">
        ${showAllUpdates ? 'Lihat Lebih Sedikit' : 'Lihat Semua Pembaruan'}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transform: ${showAllUpdates ? 'rotate(180deg)' : 'none'}"><polyline points="6 9 12 15 18 9"/></svg>
      </button>
    ` : ''}
  `;

  const toggleBtn = logEl.querySelector('#update-log-toggle-btn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      showAllUpdates = !showAllUpdates;
      renderUpdateLog();
    });
  }
}

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

  // ── Render Update Log at the top ───────────────────────────
  let logEl = $('update-log-card');
  if (!logEl) {
    logEl = document.createElement('div');
    logEl.id = 'update-log-card';
    logEl.className = 'update-log-card animate-in';
    const hero = document.querySelector('.hero');
    if (hero) hero.parentNode.insertBefore(logEl, hero.nextSibling);
  }
  renderUpdateLog();

  // ── Category filter chips ──────────────────────────────────
  let filterBar = $('cat-filter-bar');
  if (!filterBar) {
    filterBar = document.createElement('div');
    filterBar.id = 'cat-filter-bar';
    filterBar.className = 'cat-filter-bar';
    const oldGrid = $('course-grid');
    if (oldGrid) oldGrid.parentNode.insertBefore(filterBar, oldGrid);
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
      filterBar.querySelectorAll('.cat-chip').forEach(b =>
        b.classList.toggle('active', b.dataset.cat === state.activeCategory));
      renderNav();
    });
  });

  // ── Roadmap Sections Container ──────────────────────────────
  let roadmapContainer = $('roadmap-sections-container');
  if (!roadmapContainer) {
    roadmapContainer = document.createElement('div');
    roadmapContainer.id = 'roadmap-sections-container';
    roadmapContainer.className = 'rm-sections-container';
    const oldGrid = $('course-grid');
    if (oldGrid) {
      oldGrid.style.display = 'none'; // Hide flat grid
      oldGrid.parentNode.insertBefore(roadmapContainer, oldGrid.nextSibling);
    }
  }

  // Group courses by category ID
  const coursesByCategory = {};
  ROADMAP_GROUPS.forEach(cat => {
    coursesByCategory[cat.id] = [];
  });
  
  state.courses.forEach((course, idx) => {
    const catId = getCourseCategory(course);
    if (!coursesByCategory[catId]) {
      coursesByCategory[catId] = [];
    }
    coursesByCategory[catId].push({ idx, course });
  });

  roadmapContainer.innerHTML = '';
  ROADMAP_GROUPS.forEach((group, groupIdx) => {
    const items = coursesByCategory[group.id] || [];
    if (items.length === 0) return; // Skip empty categories

    const isCollapsed = state.categoryCollapsed[group.id] === true;
    const desc = CATEGORY_DESCS[group.id] || '';

    const sectionEl = document.createElement('div');
    sectionEl.className = 'rm-section animate-in' + (isCollapsed ? ' collapsed' : '');
    sectionEl.dataset.category = group.id;
    sectionEl.style.animationDelay = `${groupIdx * 40}ms`;

    sectionEl.innerHTML = `
      <div class="rm-section-header" style="--step-color: ${group.color}">
        <div class="rm-section-step">${groupIdx + 1}</div>
        <div class="rm-section-info">
          <div class="rm-section-title">
            <span class="rm-section-emoji">${group.emoji}</span>
            <span>${escapeHtml(group.label)}</span>
          </div>
          ${desc ? `<div class="rm-section-desc">${escapeHtml(desc)}</div>` : ''}
        </div>
        <div class="rm-section-meta">
          <span class="rm-section-count">${items.length} Kursus</span>
          <span class="rm-section-chevron">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </span>
        </div>
      </div>
      <div class="rm-section-body">
        <div class="course-grid"></div>
      </div>
    `;

    // Click header to toggle collapse
    const header = sectionEl.querySelector('.rm-section-header');
    header.addEventListener('click', () => {
      const isCol = sectionEl.classList.toggle('collapsed');
      state.categoryCollapsed[group.id] = isCol;
    });

    const grid = sectionEl.querySelector('.course-grid');
    items.forEach(({ idx, course }) => {
      const meta = getCourseMeta(course);
      const thumb = getCourseThumbnailSrc(course);
      const catEmoji = getCatEmoji(meta.categoryId);
      const totalL = course.modules.reduce((s, m) => s + m.lessons.length, 0);
      
      const card = document.createElement('div');
      card.className = 'course-card';
      card.style.setProperty('--card-accent', CARD_ACCENTS[idx % CARD_ACCENTS.length]);
      card.innerHTML = `
        <div class="card-cover">
          ${thumb ? `<img src="${thumb}" loading="lazy" alt="" onerror="this.style.display='none'">` : ''}
          <div class="card-cover-placeholder"></div>
        </div>
        <div class="card-content">
          <div class="card-number">KURSUS ${idx + 1}</div>
          <div class="card-title">${escapeHtml(course.course_title)}</div>
          <div class="card-desc">${escapeHtml(course.about_course || course.course_description || '')}</div>
          
          ${meta.tags && meta.tags.length > 0 ? `
            <div class="card-tags">
              ${meta.tags.slice(0, 3).map(tag => `<span class="card-tag-badge">${escapeHtml(tag)}</span>`).join('')}
            </div>
          ` : ''}

          <div class="card-footer">
            <div class="card-meta-info">
              <div class="meta-info-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>
                </svg>
                <span>${escapeHtml(meta.duration || '1 Jam')}</span>
              </div>
              <div class="meta-info-item">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
                <span>${totalL} Materi</span>
              </div>
            </div>
          </div>
        </div>
      `;
      card.addEventListener('click', () => goToCourse(idx));
      grid.appendChild(card);
    });

    roadmapContainer.appendChild(sectionEl);
  });

  applyCategoryFilter();
}

function applyCategoryFilter() {
  const container = $('roadmap-sections-container');
  if (!container) return;
  
  const sections = container.querySelectorAll('.rm-section');
  sections.forEach(section => {
    const catId = section.dataset.category;
    if (state.activeCategory === 'all') {
      section.style.display = '';
      const isCollapsed = state.categoryCollapsed[catId] === true;
      section.classList.toggle('collapsed', isCollapsed);
    } else {
      if (catId === state.activeCategory) {
        section.style.display = '';
        section.classList.remove('collapsed');
      } else {
        section.style.display = 'none';
      }
    }
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

// ── Go to Lesson Directly (from search result) ─────────────────
function goToLessonDirect(courseIdx, moduleIdx, lessonIdx) {
  state.currentCourseIdx = courseIdx;
  const course = state.courses[courseIdx];
  // Build flat lesson list for this course
  state.currentLessonFlat = buildFlatLessons(courseIdx);
  // Find the flat index
  const flatIdx = state.currentLessonFlat.findIndex(
    fl => fl.moduleIdx === moduleIdx && fl.lessonIdx === lessonIdx
  );
  if (flatIdx < 0) {
    // Fallback: open course view
    renderCourse(course, courseIdx);
    showView('course');
    updateBreadcrumb('course');
    return;
  }
  renderNav();
  goToLesson(flatIdx);
  $('lesson-counter').textContent = `${flatIdx + 1} / ${state.currentLessonFlat.length}`;
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

      // Understanding tag from localStorage
      const course = state.courses[idx];
      const slug = course?.course_slug || idx;
      const uKey = `understanding_${slug}_${mIdx}_${lIdx}`;
      const uVal = localStorage.getItem(uKey);
      const uDotColor = uVal === 'mengerti' ? '#34c759'
                      : uVal === 'ragu'     ? '#ff9f0a'
                      : uVal === 'belum'    ? '#ff3b30'
                      : 'transparent';
      const uDotBorder = uVal ? 'none' : '1.5px solid var(--border)';
      const uDotTitle = uVal === 'mengerti' ? 'Mengerti'
                      : uVal === 'ragu'     ? 'Ragu-ragu'
                      : uVal === 'belum'    ? 'Belum Paham'
                      : 'Belum ditandai';

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
        <span class="lesson-utag-dot" title="${uDotTitle}" style="background:${uDotColor};border:${uDotBorder}"></span>
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

  // Restore saved quiz state for this lesson
  const saved = loadQuizResult(state.currentCourseIdx, flatIdx);
  if (saved) {
    state.currentQuizAnswers = saved.answers || {};
    state.currentQuizSubmitted = saved.submitted || false;
    state.currentQuizStarted = saved.started || false;
  } else {
    state.currentQuizAnswers = {};
    state.currentQuizSubmitted = false;
    state.currentQuizStarted = false;
  }

  renderLesson();
  showView('lesson');
  updateBreadcrumb('lesson');
  $('lesson-counter').textContent = `${flatIdx + 1} / ${state.currentLessonFlat.length}`;
}

function renderLesson() {
  const { lesson, moduleName } = state.currentLessonFlat[state.currentLessonFlatIdx];
  const flatIdx = state.currentLessonFlatIdx;
  const total = state.currentLessonFlat.length;

  // Update mobile bottom nav elements
  const mobPrevBtn = $('mobile-prev-btn');
  const mobNextBtn = $('mobile-next-btn');
  const mobCounter = $('mobile-counter-label');
  if (mobPrevBtn) mobPrevBtn.disabled = (flatIdx === 0);
  if (mobNextBtn) mobNextBtn.disabled = (flatIdx === total - 1);
  if (mobCounter) mobCounter.textContent = `${flatIdx + 1} / ${total}`;

  // Title
  $('lesson-title').textContent = lesson.title;

  const lessonTextEl = $('lesson-text');
  const quizContainer = $('quiz-container');
  const videoContainer = $('video-container');
  const videoSection = $('video-section');

  // Render understanding tag widget
  renderUnderstandingTag(flatIdx);

  if (lesson.quiz_data) {
    lessonTextEl.style.display = 'none';
    if (videoSection) videoSection.style.display = 'none';
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
  // Nav pills above title
  const pills = $('lesson-nav-pills');
  pills.innerHTML = '';

  // Video
  const allVideos = [];
  (lesson.youtube_urls || []).forEach((url, i) => {
    allVideos.push({ type: 'youtube', url, label: lesson.youtube_urls.length > 1 ? `YouTube ${i+1}` : 'YouTube' });
  });
  (lesson.video_urls || []).forEach((url, i) => {
    let qLabel = '';
    if (url.toLowerCase().includes('playlist.m3u8')) {
      qLabel = 'Auto';
    } else {
      const qMatch = url.match(/(240p|360p|480p|720p|1080p)/i);
      if (qMatch) {
        qLabel = qMatch[1].toLowerCase();
      } else {
        const numMatch = url.match(/(1080|720|480|360|240)/);
        if (numMatch) {
          qLabel = numMatch[1] + 'p';
        } else {
          qLabel = lesson.video_urls.length > 1 ? `Kualitas ${i+1}` : 'Video';
        }
      }
    }
    allVideos.push({ type: 'direct', url, label: qLabel });
  });

  const videoWrapper = $('video-wrapper');

  if (allVideos.length > 0) {
    if (videoSection) videoSection.style.display = '';
    videoContainer.style.display = '';

    // Inject only video wrapper inside videoContainer
    videoContainer.innerHTML = `
      <div id="video-wrapper" class="video-wrapper">${buildVideoEmbed(allVideos[state.currentVideoIdx])}</div>
    `;

    // Remove existing video-tabs inside videoSection if any (to prevent multiple tab bars)
    const existingTabs = videoSection.querySelector('.video-tabs');
    if (existingTabs) {
      existingTabs.remove();
    }

    // Build tab row
    const tabsDiv = document.createElement('div');
    tabsDiv.className = 'video-tabs';
    tabsDiv.innerHTML = allVideos.map((v, i) => `
      <button class="video-tab-btn${i === state.currentVideoIdx ? ' active' : ''}" data-vidx="${i}">
        <span class="yt-dot"></span>${escapeHtml(v.label)}
      </button>
    `).join('');

    // Append tabs to videoSection (rendering below videoContainer)
    videoSection.appendChild(tabsDiv);

    // Tab click events
    tabsDiv.querySelectorAll('.video-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.currentVideoIdx = parseInt(btn.dataset.vidx);
        document.getElementById('video-wrapper').innerHTML = buildVideoEmbed(allVideos[state.currentVideoIdx]);
        tabsDiv.querySelectorAll('.video-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });

  } else {
    if (videoSection) {
      videoSection.style.display = 'none';
      const existingTabs = videoSection.querySelector('.video-tabs');
      if (existingTabs) existingTabs.remove();
    }
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
  let videoSrc = vid.url;
  const isCdn = /b-cdn\.net|diupload\.com/i.test(videoSrc);
  if (isCdn) {
    videoSrc = `video_proxy.php?url=${encodeURIComponent(videoSrc)}`;
  }
  return `<video controls style="width:100%;height:100%;background:#000"><source src="${escapeHtml(videoSrc)}">Browser tidak mendukung video ini.</video>`;
}

function renderLessonSidebar() {
  const sidebarContainer = $('lesson-list-sidebar');
  const sheetContainer = $('sheet-lesson-list');

  const renderToList = (container) => {
    if (!container) return;
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

      // Get understanding tag for this lesson
      const understanding = getLessonUnderstanding(state.currentCourseIdx, i);
      const tagMeta = getTagMeta(understanding);

      const el = document.createElement('div');
      el.className = 'sidebar-lesson-item' + (i === state.currentLessonFlatIdx ? ' active' : '');
      el.innerHTML = `
        <span class="sidebar-lesson-num">${i + 1}</span>
        <span class="sidebar-lesson-title">${escapeHtml(item.lesson.title)}</span>
        ${tagMeta ? `<span class="sidebar-tag-dot" style="background:${tagMeta.color}" title="${tagMeta.label}"></span>` : '<span class="sidebar-tag-dot empty"></span>'}
      `;
      el.addEventListener('click', () => {
        goToLesson(i);
        closeMobileSheet();
      });
      container.appendChild(el);
    });

    // Scroll active into view
    const active = container.querySelector('.sidebar-lesson-item.active');
    if (active) active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };

  renderToList(sidebarContainer);
  renderToList(sheetContainer);
}

// ── Understanding Tag Widget ────────────────────────────────────
function renderUnderstandingTag(flatIdx) {
  let container = $('understanding-tag-widget');
  if (!container) return;

  const current = getLessonUnderstanding(state.currentCourseIdx, flatIdx);

  container.innerHTML = `
    <div class="utag-header">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
      <span>Pemahaman Materi</span>
    </div>
    <div class="utag-buttons">
      ${UNDERSTANDING_TAGS.map(tag => `
        <button class="utag-btn${current === tag.value ? ' active' : ''}" data-value="${tag.value}"
          style="${current === tag.value ? `background:${tag.bg};border-color:${tag.border};color:${tag.color};` : ''}">
          <span class="utag-icon">${tag.icon}</span>
          <span class="utag-label">${tag.label}</span>
        </button>
      `).join('')}
    </div>
  `;

  container.querySelectorAll('.utag-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.dataset.value;
      const prevVal = getLessonUnderstanding(state.currentCourseIdx, flatIdx);
      // Toggle off if same
      setLessonUnderstanding(state.currentCourseIdx, flatIdx, val === prevVal ? null : val);
      renderUnderstandingTag(flatIdx);
      renderLessonSidebar(); // Update sidebar dots
    });
  });
}

// ── Breadcrumb ─────────────────────────────────────────────────
function updateBreadcrumb(view) {
  let html = `<span class="breadcrumb-home" id="bc-home">Home</span>`;
  if (view === 'roadmap') {
    html += `<span class="breadcrumb-sep">›</span><span class="breadcrumb-lesson">Roadmap</span>`;
  } else if (view === 'course' || view === 'lesson') {
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
  state.topView = 'home';
  state.activeCategory = 'all';
  state.currentCourseIdx = null;
  state.currentLessonFlatIdx = null;
  renderNav();
  renderHome();
  showView('home');
  updateBreadcrumb('home');
  $('lesson-counter').textContent = '';
  closeMobileSidebar();
}

function goRoadmap() {
  state.topView = 'roadmap';
  renderRoadmapView();
  showView('roadmap');
  updateBreadcrumb('roadmap');
  closeMobileSidebar();
}

// ── Render Roadmap View ───────────────────────────────────────
function renderRoadmapView() {
  // Stats
  let totalLessons = 0, totalModules = 0;
  state.courses.forEach(c => {
    c.modules.forEach(m => { totalModules++; totalLessons += m.lessons.length; });
  });
  const statsEl = $('roadmap-stats-bar');
  if (statsEl) statsEl.innerHTML = `
    <div class="stat-item"><div class="stat-num">${state.courses.length}</div><div class="stat-label">Kursus</div></div>
    <div class="stat-item"><div class="stat-num">${totalModules}</div><div class="stat-label">Modul</div></div>
    <div class="stat-item"><div class="stat-num">${totalLessons}</div><div class="stat-label">Pelajaran</div></div>
    <div class="stat-item"><div class="stat-num">${ROADMAP_GROUPS.length}</div><div class="stat-label">Kategori</div></div>
  `;

  const container = $('roadmap-groups-container');
  if (!container) return;

  // Build group -> courses map
  const groupMap = {};
  ROADMAP_GROUPS.forEach(g => { groupMap[g.id] = []; });
  state.courses.forEach((course, idx) => {
    const g = getCourseGroup(course);
    (groupMap[g.id] || (groupMap[ROADMAP_GROUPS[0].id])).push({ idx, course });
  });

  container.innerHTML = '';
  ROADMAP_GROUPS.forEach((group, gIdx) => {
    const items = groupMap[group.id] || [];
    if (!items.length) return;

    const section = document.createElement('div');
    section.className = 'rm-group';
    section.style.animationDelay = `${gIdx * 40}ms`;

    const headerEl = document.createElement('div');
    headerEl.className = 'rm-group-header';
    headerEl.style.setProperty('--grp-color', group.color);
    headerEl.innerHTML = `
      <div class="rm-group-left">
        <span class="rm-group-icon" style="background:${group.color}20;color:${group.color}">${group.emoji}</span>
        <div>
          <div class="rm-group-title" style="color:${group.color}">${group.label}</div>
          <div class="rm-group-count">${items.length} kursus</div>
        </div>
      </div>
      <span class="rm-chevron">▾</span>
    `;
    headerEl.addEventListener('click', () => {
      section.classList.toggle('collapsed');
    });

    const grid = document.createElement('div');
    grid.className = 'rm-cards-grid';

    items.forEach(({ idx, course }) => {
      const thumb = getCourseThumbnailSrc(course);
      const totalL = course.modules.reduce((s, m) => s + m.lessons.length, 0);
      const hasVideo = course.modules.some(m => m.lessons.some(l => l.youtube_urls?.length || l.video_urls?.length));
      const deprecated = course.course_title?.includes('[Deprecated]') || course.course_slug?.includes('deprecated');

      const card = document.createElement('div');
      card.className = 'rm-card';
      card.innerHTML = `
        <div class="rm-card-thumb" style="--rm-color:${group.color}">
          ${thumb ? `<img src="${thumb}" loading="lazy" alt="" onerror="this.style.display='none'">` : ''}
          <div class="rm-card-thumb-placeholder" style="color:${group.color}">${group.emoji}</div>
          ${deprecated ? '<span class="rm-deprecated-badge">Deprecated</span>' : ''}
        </div>
        <div class="rm-card-body">
          <div class="rm-card-num" style="color:${group.color}">#${idx + 1}</div>
          <div class="rm-card-title">${escapeHtml(course.course_title)}</div>
          <div class="rm-card-meta">
            ${totalL ? `<span>📖 ${totalL}</span>` : ''}
            ${hasVideo ? '<span>🎬 Video</span>' : ''}
            ${course.mentors?.length ? `<span>👤 ${escapeHtml(course.mentors[0])}</span>` : ''}
          </div>
        </div>
      `;
      card.addEventListener('click', () => goToCourse(idx));
      grid.appendChild(card);
    });

    section.appendChild(headerEl);
    section.appendChild(grid);
    container.appendChild(section);
  });
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
        // Persist quiz result to localStorage
        saveQuizResult(
          state.currentCourseIdx,
          state.currentLessonFlatIdx,
          state.currentQuizAnswers,
          true,
          true
        );
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
        // Clear saved quiz result so user can retake
        saveQuizResult(
          state.currentCourseIdx,
          state.currentLessonFlatIdx,
          {}, false, false
        );
        renderQuiz(quiz, container);
      });
    }
  }
}

// Mobile Lesson Sheet functions
const mobileSheet = $('mobile-lesson-sheet');
const sheetOverlay = $('sheet-overlay');

function openMobileSheet() {
  if (mobileSheet) mobileSheet.classList.add('active');
  if (sheetOverlay) sheetOverlay.classList.add('active');
}

function closeMobileSheet() {
  if (mobileSheet) mobileSheet.classList.remove('active');
  if (sheetOverlay) sheetOverlay.classList.remove('active');
}

// ── Init ───────────────────────────────────────────────────────
function init() {
  // Populate groups and categories dynamically from COURSE_META
  if (typeof COURSE_META !== 'undefined' && COURSE_META.categories) {
    ROADMAP_GROUPS = COURSE_META.categories;
    CATEGORIES = [
      { id: 'all', label: 'Semua Kursus', emoji: '🗂️' },
      ...COURSE_META.categories
    ];
  } else {
    ROADMAP_GROUPS = [
      { id: 'g-panduan', label: 'Panduan Member', emoji: '📚', color: '#3b82f6' }
    ];
    CATEGORIES = [
      { id: 'all', label: 'Semua Kursus', emoji: '🗂️' },
      { id: 'g-panduan', label: 'Panduan Member', emoji: '📚' }
    ];
  }

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

  // Wire up mobile bar & sheet event listeners
  const mobPrevBtn = $('mobile-prev-btn');
  const mobNextBtn = $('mobile-next-btn');
  const mobPlaylistBtn = $('mobile-playlist-btn');
  const sheetCloseBtn = $('sheet-close-btn');

  if (mobPrevBtn) {
    mobPrevBtn.addEventListener('click', () => {
      if (state.currentLessonFlatIdx !== null && state.currentLessonFlatIdx > 0) {
        goToLesson(state.currentLessonFlatIdx - 1);
      }
    });
  }
  if (mobNextBtn) {
    mobNextBtn.addEventListener('click', () => {
      if (state.currentLessonFlatIdx !== null && state.currentLessonFlatIdx < state.currentLessonFlat.length - 1) {
        goToLesson(state.currentLessonFlatIdx + 1);
      }
    });
  }
  if (mobPlaylistBtn) {
    mobPlaylistBtn.addEventListener('click', openMobileSheet);
  }
  if (sheetOverlay) {
    sheetOverlay.addEventListener('click', closeMobileSheet);
  }
  if (sheetCloseBtn) {
    sheetCloseBtn.addEventListener('click', closeMobileSheet);
  }

  // Fade out loading screen
  const loadingScreen = $('loading-screen');
  if (loadingScreen) {
    loadingScreen.classList.add('fade-out');
    setTimeout(() => {
      loadingScreen.style.display = 'none';
    }, 400);
  }
}

init();
