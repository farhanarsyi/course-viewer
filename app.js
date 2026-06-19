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
  state.courses.forEach((course, idx) => {
    if (filt && !course.course_title.toLowerCase().includes(filt)) return;
    const btn = document.createElement('button');
    btn.className = 'nav-item' + (state.currentCourseIdx === idx ? ' active' : '');
    btn.innerHTML = `
      <span class="nav-index">${idx + 1}</span>
      <span class="nav-text">${escapeHtml(course.course_title)}</span>
    `;
    btn.addEventListener('click', () => {
      goToCourse(idx);
      closeMobileSidebar();
    });
    courseNav.appendChild(btn);
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

  // Course grid
  const grid = $('course-grid');
  grid.innerHTML = '';
  state.courses.forEach((course, idx) => {
    const totalL = course.modules.reduce((s, m) => s + m.lessons.length, 0);
    const hasVideo = course.modules.some(m => m.lessons.some(l => l.youtube_urls?.length || l.video_urls?.length));
    const mentorsHtml = course.mentors?.length
      ? `<span class="card-pill">${escapeHtml(course.mentors.slice(0, 2).join(', '))}${course.mentors.length > 2 ? ` +${course.mentors.length - 2}` : ''}</span>`
      : '';

    const card = document.createElement('div');
    card.className = 'course-card animate-in';
    card.style.setProperty('--card-accent', CARD_ACCENTS[idx % CARD_ACCENTS.length]);
    card.style.animationDelay = `${idx * 35}ms`;
    card.innerHTML = `
      <div class="card-number">KURSUS ${idx + 1}</div>
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
    `;
    card.addEventListener('click', () => goToCourse(idx));
    grid.appendChild(card);
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

  const totalL = course.modules.reduce((s, m) => s + m.lessons.length, 0);
  const totalVideos = course.modules.reduce((s, m) => s + m.lessons.filter(l => l.youtube_urls?.length || l.video_urls?.length).length, 0);

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
  const rawDesc = (course.course_description || '').trim();

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
  renderLesson();
  showView('lesson');
  updateBreadcrumb('lesson');
  const total = state.currentLessonFlat.length;
  $('lesson-counter').textContent = `${flatIdx + 1} / ${total}`;
  updateMobileBar(flatIdx, total);
  closeLessonSheet();
}

function renderLesson() {
  const { lesson, moduleName } = state.currentLessonFlat[state.currentLessonFlatIdx];
  const flatIdx = state.currentLessonFlatIdx;
  const total = state.currentLessonFlat.length;

  // Title
  $('lesson-title').textContent = lesson.title;

  // Text content
  const formattedText = formatText(lesson.text_content);
  const lessonTextEl = $('lesson-text');
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

  // ── Video ─────────────────────────────────────────────────────
  // Collect all videos; extract resolution label from URL if present
  const rawVideos = [];
  (lesson.youtube_urls || []).forEach(url => {
    rawVideos.push({ type: 'youtube', url, label: 'YouTube', res: 0 });
  });
  (lesson.video_urls || []).forEach(url => {
    // detect resolution from URL path segment e.g. /1080p/ or /480p/
    const resMatch = url.match(/\/(\d{3,4}p)\//i);
    const resLabel = resMatch ? resMatch[1].toUpperCase() : 'Video';
    const resNum = resMatch ? parseInt(resMatch[1]) : 0;
    rawVideos.push({ type: 'direct', url, label: resLabel, res: resNum });
  });

  // Sort direct videos: highest resolution first; YouTube stays at front
  const youtubeVids = rawVideos.filter(v => v.type === 'youtube');
  const directVids = rawVideos.filter(v => v.type === 'direct').sort((a, b) => b.res - a.res);
  const allVideos = [...youtubeVids, ...directVids];

  // Always default to first (highest-res direct, or YouTube)
  if (state.currentVideoIdx >= allVideos.length) state.currentVideoIdx = 0;

  // ── DOM refs ───────────────────────────────────────────────────
  const videoSection = $('video-section');
  const videoContainer = $('video-container');

  if (allVideos.length > 0) {
    videoSection.style.display = '';

    // ── Quality tabs (outside video-container so they're not covered) ──
    let tabsEl = $('video-tabs-row');
    if (!tabsEl) {
      tabsEl = document.createElement('div');
      tabsEl.id = 'video-tabs-row';
      videoSection.insertBefore(tabsEl, videoContainer);
    }

    if (allVideos.length > 1) {
      tabsEl.className = 'video-tabs';
      tabsEl.innerHTML = allVideos.map((v, i) => `
        <button class="video-tab-btn${i === state.currentVideoIdx ? ' active' : ''}" data-vidx="${i}">
          <span class="yt-dot"></span>${escapeHtml(v.label)}
        </button>
      `).join('');
      tabsEl.querySelectorAll('.video-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.currentVideoIdx = parseInt(btn.dataset.vidx);
          renderActiveVideo(allVideos);
          tabsEl.querySelectorAll('.video-tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
    } else {
      tabsEl.className = '';
      tabsEl.innerHTML = '';
    }

    // ── Render the active video into video-container ────────────
    renderActiveVideo(allVideos);

  } else {
    videoSection.style.display = 'none';
    const tabsEl = $('video-tabs-row');
    if (tabsEl) { tabsEl.className = ''; tabsEl.innerHTML = ''; }
    videoContainer.innerHTML = '';
  }

  // Sidebar lesson list
  renderLessonSidebar();
}

// ── Render the currently-selected video ────────────────────────
function renderActiveVideo(allVideos) {
  const container = $('video-container');
  const vid = allVideos[state.currentVideoIdx];
  if (!vid) return;

  if (vid.type === 'youtube') {
    const embed = buildYoutubeEmbed(vid.url);
    container.innerHTML = embed
      ? `<iframe src="${embed}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`
      : `<p style="color:#fff;padding:20px">Tidak dapat memuat video.</p>`;
    return;
  }

  // Direct / HLS video
  const isHLS = vid.url.includes('.m3u8');
  const videoEl = document.createElement('video');
  videoEl.controls = true;
  videoEl.setAttribute('playsinline', '');
  videoEl.setAttribute('webkit-playsinline', '');
  videoEl.style.cssText = 'width:100%;height:100%;background:#000;display:block';

  container.innerHTML = '';
  container.appendChild(videoEl);

  if (isHLS && typeof Hls !== 'undefined' && Hls.isSupported()) {
    const hls = new Hls({ maxMaxBufferLength: 60 });
    hls.loadSource(vid.url);
    hls.attachMedia(videoEl);
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoEl.src = vid.url;
  } else {
    // Non-HLS direct video
    const src = document.createElement('source');
    src.src = vid.url;
    videoEl.appendChild(src);
    const fallback = document.createTextNode('Browser tidak mendukung video ini.');
    videoEl.appendChild(fallback);
  }
}

function buildVideoEmbed(vid) {
  // kept for compatibility — actual rendering now uses renderActiveVideo
  if (vid.type === 'youtube') {
    const embed = buildYoutubeEmbed(vid.url);
    if (!embed) return `<p style="color:white;padding:20px">Tidak dapat memuat video.</p>`;
    return `<iframe src="${embed}" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" loading="lazy"></iframe>`;
  }
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
  const btn = document.getElementById('about-toggle-btn');
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
  // Hide mobile bottom bar
  const mBar = $('mobile-lesson-bar');
  if (mBar) mBar.style.display = 'none';
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

// ── Mobile Bottom Bar ──────────────────────────────────────────
function updateMobileBar(flatIdx, total) {
  const bar = $('mobile-lesson-bar');
  const prevBtn = $('mobile-prev-btn');
  const nextBtn = $('mobile-next-btn');
  const label = $('mobile-counter-label');
  if (!bar) return;

  bar.style.display = 'flex';
  if (prevBtn) prevBtn.disabled = flatIdx === 0;
  if (nextBtn) nextBtn.disabled = flatIdx === total - 1;
  if (label) label.textContent = `${flatIdx + 1} / ${total}`;
}

// Wire up mobile bar buttons once DOM ready
(function initMobileBar() {
  const prevBtn = $('mobile-prev-btn');
  const nextBtn = $('mobile-next-btn');
  const playlistBtn = $('mobile-playlist-btn');

  prevBtn?.addEventListener('click', () => {
    if (state.currentLessonFlatIdx > 0) goToLesson(state.currentLessonFlatIdx - 1);
  });
  nextBtn?.addEventListener('click', () => {
    if (state.currentLessonFlatIdx < state.currentLessonFlat.length - 1)
      goToLesson(state.currentLessonFlatIdx + 1);
  });
  playlistBtn?.addEventListener('click', openLessonSheet);
})();

// ── Mobile Lesson Sheet ────────────────────────────────────────
const lessonSheet = $('mobile-lesson-sheet');
const sheetOverlay = $('sheet-overlay');
const sheetList = $('sheet-lesson-list');
const sheetCloseBtn = $('sheet-close-btn');

function openLessonSheet() {
  if (!lessonSheet) return;
  // Clone lesson list content into sheet
  const source = $('lesson-list-sidebar');
  if (source && sheetList) {
    sheetList.innerHTML = source.innerHTML;
    // Re-wire click events in sheet
    sheetList.querySelectorAll('.sidebar-lesson-item').forEach((el, i) => {
      el.addEventListener('click', () => goToLesson(i));
    });
    // Scroll active lesson into view in sheet
    const active = sheetList.querySelector('.sidebar-lesson-item.active');
    if (active) setTimeout(() => active.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100);
  }
  lessonSheet.classList.add('open');
  sheetOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeLessonSheet() {
  if (!lessonSheet) return;
  lessonSheet.classList.remove('open');
  sheetOverlay.classList.remove('active');
  document.body.style.overflow = '';
}

sheetCloseBtn?.addEventListener('click', closeLessonSheet);
sheetOverlay?.addEventListener('click', closeLessonSheet);

// Close sheet on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && lessonSheet?.classList.contains('open')) closeLessonSheet();
});

// ── Swipe gesture (lesson view) ────────────────────────────────
(function initSwipe() {
  let startX = 0, startY = 0, moved = false;
  const threshold = 60;  // px to trigger
  const restraint = 100; // max vertical drift allowed

  const zone = document.querySelector('.lesson-main');
  if (!zone) return;

  zone.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startX = t.clientX;
    startY = t.clientY;
    moved = false;
  }, { passive: true });

  zone.addEventListener('touchmove', () => { moved = true; }, { passive: true });

  zone.addEventListener('touchend', e => {
    if (!moved) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = Math.abs(t.clientY - startY);
    if (dy > restraint) return; // mostly vertical scroll, ignore
    if (!lessonView.classList.contains('active')) return;
    if (state.currentLessonFlatIdx === null) return;

    if (dx < -threshold) {
      // swipe left → next lesson
      const next = state.currentLessonFlatIdx + 1;
      if (next < state.currentLessonFlat.length) goToLesson(next);
    } else if (dx > threshold) {
      // swipe right → prev lesson
      const prev = state.currentLessonFlatIdx - 1;
      if (prev >= 0) goToLesson(prev);
    }
  }, { passive: true });
})();

// ── Loading screen helpers ─────────────────────────────────────
const loadingScreen = document.getElementById('loading-screen');
const loadingStatus = document.getElementById('loading-status');

function setLoadingStatus(msg) {
  if (loadingStatus) loadingStatus.textContent = msg;
}

function hideLoadingScreen() {
  if (!loadingScreen) return;
  loadingScreen.classList.add('fade-out');
  loadingScreen.addEventListener('transitionend', () => loadingScreen.remove(), { once: true });
}

function showFatalError(title, detail) {
  hideLoadingScreen();
  document.body.insertAdjacentHTML('beforeend', `
    <div style="position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
      background:var(--bg,#0a0a0f);font-family:Inter,sans-serif;text-align:center;
      color:#6e6e73;padding:24px;z-index:9999">
      <div>
        <div style="font-size:48px;margin-bottom:16px">⚠️</div>
        <h2 style="color:#f5f5f7;margin-bottom:8px;font-size:22px">${title}</h2>
        <p style="max-width:420px;line-height:1.6;font-size:14px">${detail}</p>
        <button onclick="location.reload()" style="margin-top:20px;padding:10px 24px;
          background:linear-gradient(135deg,#0071e3,#6c37c9);color:#fff;border:none;
          border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;">
          Coba Lagi
        </button>
      </div>
    </div>`);
}

// ── Init (async — fetch live from data.php every page load) ────
async function init() {
  setLoadingStatus('Menghubungkan ke sumber data...');

  try {
    const res = await fetch('data.php?_=' + Date.now()); // cache-bust

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }

    const json = await res.json();

    // data.php returns {error, message} on failure
    if (json && json.error) {
      throw new Error(json.message || 'Gagal memuat data dari server.');
    }

    if (!Array.isArray(json) || json.length === 0) {
      throw new Error('Format data tidak valid atau file kosong.');
    }

    setLoadingStatus(`${json.length} kursus ditemukan — menyiapkan tampilan...`);
    state.courses = json;

  } catch (err) {
    // ── Fallback: try static COURSE_DATA from data.js ──────────
    if (typeof COURSE_DATA !== 'undefined' && Array.isArray(COURSE_DATA) && COURSE_DATA.length > 0) {
      console.warn('[CourseViewer] data.php gagal, menggunakan COURSE_DATA statis:', err.message);
      state.courses = COURSE_DATA;
    } else {
      showFatalError(
        'Gagal memuat data kursus',
        `<strong>Error:</strong> ${err.message}<br/><br/>
         Pastikan XAMPP berjalan dan file<br/>
         <code style="background:#1c1c1e;padding:2px 6px;border-radius:4px;color:#30d158">
           C:/Farhan C/kelas-fullstack/scraped_roadmap.json
         </code><br/>
         dapat diakses oleh PHP.`
      );
      return;
    }
  }

  hideLoadingScreen();
  renderNav();
  renderHome();
  showView('home');
  updateBreadcrumb('home');
}

init();

