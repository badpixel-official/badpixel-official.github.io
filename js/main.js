/* ========================================
   BADPIXEL — Fullpage Presentation v16
   Intro (pixel) + sections (no sub-slides)
   Blur overlay + ScrambleText transitions
   ======================================== */

(function() {
  const sections = document.querySelectorAll('.section');
  const sideNav = document.getElementById('sideNav');
  const sideNavBtns = document.querySelectorAll('.side-nav__btn');
  const glitchOverlay = document.getElementById('glitchOverlay');
  const totalSections = sections.length;

  const INTRO = 0; // Pixel only

  let currentSection = 0;
  let isTransitioning = false;

  /* ================================================
     ScrambleText
     ================================================ */
  const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!?<>{}[]';

  function scrambleText(element, duration) {
    const original = element.textContent;
    const len = original.length;
    if (len === 0) return;

    const resolved = new Array(len).fill(false);
    const startTime = performance.now();
    const resolveDelay = duration * 0.3;

    function frame() {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);

      let result = '';
      for (let i = 0; i < len; i++) {
        if (original[i] === ' ' || original[i] === '\n') {
          result += original[i];
          continue;
        }
        const charProgress = (elapsed - resolveDelay) / (duration - resolveDelay);
        if (charProgress > i / len) resolved[i] = true;

        result += resolved[i]
          ? original[i]
          : SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
      }
      element.textContent = result;

      if (progress < 1) requestAnimationFrame(frame);
      else element.textContent = original;
    }
    requestAnimationFrame(frame);
  }

  function scrambleSection(section) {
    const targets = section.querySelectorAll(
      '.section__title, .hero__title, .hero__tagline, .hero__sub, .label, .section__body, h3, p, blockquote, span:not(.section__scroll-bar)'
    );
    targets.forEach((el, i) => {
      // Skip elements that contain reveal triggers (scramble destroys child elements)
      if (el.querySelector('.reveal-trigger, .reveal-content, .inline-cube')) return;
      setTimeout(() => scrambleText(el, 600), i * 80);
    });
  }

  /* ================================================
     [B+CRT] Fade + CRT subpixel + wave
     ================================================ */
  function glitchTransition(onSwitch) {
    return new Promise((resolve) => {
      const pixelEl = document.getElementById('pixel');
      const viewport = document.getElementById('viewport');
      if (pixelEl) pixelEl.style.opacity = '0';
      document.body.classList.add('is-transitioning');

      const oldSection = sections[currentSection];

      // Activate CRT overlay
      glitchOverlay.classList.add('is-active');

      // Phase 1: fade out current section
      oldSection.classList.add('is-fading-out');

      // Wave animation during transition
      const startTime = performance.now();
      const DURATION = 950;
      let waveRaf;

      function waveLoop() {
        const elapsed = performance.now() - startTime;
        const progress = elapsed / DURATION;
        if (progress >= 1) {
          if (viewport) viewport.style.transform = '';
          return;
        }
        const intensity = Math.sin(progress * Math.PI);
        if (viewport) {
          const wave = Math.sin(elapsed * 0.02) * 6 * intensity;
          viewport.style.transform = 'translateY(' + wave + 'px)';
        }
        waveRaf = requestAnimationFrame(waveLoop);
      }
      waveRaf = requestAnimationFrame(waveLoop);

      setTimeout(() => {
        // Phase 2: switch sections
        oldSection.classList.remove('is-fading-out');
        onSwitch();

        const newSection = sections[currentSection];
        newSection.classList.add('is-fading-in');

        // Phase 3: fade in new section
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            newSection.classList.add('is-visible');
          });
        });

        // Cleanup
        setTimeout(() => {
          newSection.classList.remove('is-fading-in', 'is-visible');
          glitchOverlay.classList.remove('is-active');
          document.body.classList.remove('is-transitioning');
          if (viewport) viewport.style.transform = '';
          if (pixelEl) {
            // On mobile, only show pixel on intro
            if (window.innerWidth <= 768) {
              pixelEl.style.opacity = (currentSection === INTRO) ? '1' : '0';
            } else {
              pixelEl.style.opacity = '1';
            }
          }
          cancelAnimationFrame(waveRaf);
          resolve();
        }, 600);
      }, 350);
    });
  }

  /* --- Section transition --- */
  async function goToSection(index) {
    if (index < 0 || index >= totalSections || index === currentSection || isTransitioning) return;
    isTransitioning = true;

    await glitchTransition(() => {
      sections[currentSection].classList.remove('active');
      sections[index].classList.add('active');
      currentSection = index;

      updateUIVisibility();
      updateNavActive();

      if (index !== INTRO) {
        scrambleSection(sections[index]);
      }
    });

    isTransitioning = false;
  }

  /* --- UI --- */
  const scrollHint = document.querySelector('.section__scroll-hint');

  function updateNavActive() {
    sideNavBtns.forEach(btn => {
      btn.classList.toggle('active', parseInt(btn.dataset.goto) === currentSection);
    });
  }

  function updateUIVisibility() {
    const isIntro = (currentSection === INTRO);
    if (scrollHint) scrollHint.style.opacity = isIntro ? '1' : '0';
    // Hide cube on non-intro sections when width <= 768 (mobile)
    const pixelEl = document.getElementById('pixel');
    if (pixelEl && window.innerWidth <= 768) {
      pixelEl.style.opacity = isIntro ? '1' : '0';
      pixelEl.style.pointerEvents = isIntro ? '' : 'none';
    }
  }

  /* --- Wheel --- */
  let wheelCooldown = false;
  document.addEventListener('wheel', (e) => {
    if (wheelCooldown || isTransitioning || dragActive) return;
    wheelCooldown = true;

    const down = e.deltaY > 0;
    if (down) goToSection(currentSection + 1);
    else goToSection(currentSection - 1);

    setTimeout(() => { wheelCooldown = false; }, 1200);
  }, { passive: true });

  /* --- Touch (section nav — vertical swipe only) --- */
  let touchStartY = 0;
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (dragActive) return;
    const diffY = touchStartY - e.changedTouches[0].clientY;
    const diffX = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diffY) < 50) return;
    if (Math.abs(diffY) < Math.abs(diffX) * 1.5) return;
    goToSection(diffY > 0 ? currentSection + 1 : currentSection - 1);
  }, { passive: true });

  /* --- Keyboard --- */
  document.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') {
      e.preventDefault();
      goToSection(currentSection + 1);
    } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
      e.preventDefault();
      goToSection(currentSection - 1);
    }
  });

  /* --- Side nav --- */
  sideNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      goToSection(parseInt(btn.dataset.goto));
    });
  });

  /* --- Reveal triggers (event delegation — works for dynamic elements too) --- */
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.reveal-trigger:not(.section-tab)');
    if (!btn) return;
    e.stopPropagation();
    const targetId = btn.dataset.reveal;
    const content = document.getElementById(targetId);
    if (!content) return;

    const isOpen = btn.classList.toggle('is-open');
    content.classList.toggle('is-open', isOpen);
  });

  /* --- Tab switching (event delegation — scoped to paired tab-content) --- */
  document.addEventListener('click', (e) => {
    const tab = e.target.closest('.section-tab');
    if (!tab) return;
    e.stopPropagation();
    const target = tab.dataset.tab;
    const tabGroup = tab.closest('.section-tabs');
    if (!tabGroup) return;

    // Toggle only tabs in the same tab group
    tabGroup.querySelectorAll('.section-tab').forEach(t => t.classList.remove('is-open'));
    tab.classList.add('is-open');

    // Find the paired content container (next sibling, or child container)
    // Collect all tab IDs in this group to find matching tab-content elements
    const tabIds = [];
    tabGroup.querySelectorAll('.section-tab').forEach(t => {
      if (t.dataset.tab) tabIds.push('tab-' + t.dataset.tab);
    });

    // Hide all matching, show the target
    tabIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.classList.add('is-hidden');
    });
    const content = document.getElementById('tab-' + target);
    if (content) content.classList.remove('is-hidden');
  });

  /* --- Product section: JSON-driven rendering --- */
  fetch('collections.json')
    .then(r => r.json())
    .then(data => {
      const tabsEl = document.getElementById('productTabs');
      const contentsEl = document.getElementById('productContents');
      if (!tabsEl || !contentsEl) return;

      data.collections.forEach(function(col, i) {
        // Collection tab
        var tab = document.createElement('button');
        tab.className = 'section-tab reveal-trigger' + (i === 0 ? ' is-open' : '');
        tab.dataset.tab = 'col-' + col.id;
        if (col.soon) {
          var parts = col.name.match(/^(.*?\s)(\S+)(\s.*)$/);
          if (parts) {
            tab.innerHTML = parts[1] + '<span class="mosaic-text">' + parts[2] + '</span>' + parts[3] + ' (Soon)';
          } else {
            tab.innerHTML = '<span class="mosaic-text">' + col.name + '</span> (Soon)';
          }
        } else {
          tab.textContent = col.name;
        }
        tabsEl.appendChild(tab);

        // Collection content
        var content = document.createElement('div');
        content.className = 'tab-content' + (i > 0 ? ' is-hidden' : '');
        content.id = 'tab-col-' + col.id;

        if (col.soon) {
          content.innerHTML = '<p class="product__soon">Coming Soon</p>';
        } else {
          // 1. Culture pill
          var revealId = 'col-' + col.id + '-reveal';
          var titleWrap = document.createElement('div');
          titleWrap.className = 'product__title-wrap';
          titleWrap.innerHTML =
            '<span class="reveal-trigger product__culture-title" data-reveal="' + revealId + '" role="button" tabindex="0">' + col.culture + '</span>';
          content.appendChild(titleWrap);

          // 2. Blur area (revealed on culture pill click)
          var blurArea = document.createElement('div');
          blurArea.className = 'product__carousel product__carousel--locked';
          blurArea.id = revealId;

          // 2a. Product / Data Vault view tabs
          var viewTabs = document.createElement('div');
          viewTabs.className = 'section-tabs';
          viewTabs.innerHTML =
            '<button class="section-tab reveal-trigger is-open" data-tab="pv-' + col.id + '">Product</button>' +
            '<button class="section-tab reveal-trigger" data-tab="dv-' + col.id + '">Data Vault</button>';
          blurArea.appendChild(viewTabs);

          // 2b. Product gallery
          var pvContent = document.createElement('div');
          pvContent.className = 'tab-content';
          pvContent.id = 'tab-pv-' + col.id;
          var pvTrack = document.createElement('div');
          pvTrack.className = 'product__carousel-track';
          col.products.forEach(function(p) {
            var card = document.createElement('div');
            card.className = 'product__slide';
            card.innerHTML = '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy"><p>' + p.name + '</p>';
            pvTrack.appendChild(card);
          });
          pvContent.appendChild(pvTrack);
          blurArea.appendChild(pvContent);

          // 2c. Data Vault gallery
          var dvContent = document.createElement('div');
          dvContent.className = 'tab-content is-hidden';
          dvContent.id = 'tab-dv-' + col.id;
          if (col.lookbook && col.lookbook.length > 0) {
            var dvTrack = document.createElement('div');
            dvTrack.className = 'product__carousel-track';
            col.lookbook.forEach(function(p) {
              var card = document.createElement('div');
              card.className = 'product__slide';
              card.innerHTML = '<img src="' + p.image + '" alt="' + p.name + '" loading="lazy"><p>' + p.name + '</p>';
              dvTrack.appendChild(card);
            });
            dvContent.appendChild(dvTrack);
          } else {
            dvContent.innerHTML = '<p class="product__soon">Coming Soon</p>';
          }
          blurArea.appendChild(dvContent);

          content.appendChild(blurArea);
        }

        contentsEl.appendChild(content);
      });
    })
    .catch(() => {});

  /* --- Drag-to-scroll for horizontal galleries --- */
  let dragActive = false;
  let dragCleanup = null;

  document.addEventListener('mousedown', (e) => {
    const track = e.target.closest('.product__carousel-track');
    if (!track) return;
    // Only activate if track is in the currently active section
    const section = track.closest('.section');
    if (!section || !section.classList.contains('active')) return;
    let startX = e.clientX;
    let scrollLeft = track.scrollLeft;
    let moved = false;
    dragActive = true;

    function onMove(ev) {
      moved = true;
      track.scrollLeft = scrollLeft - (ev.clientX - startX);
    }
    function onUp() {
      dragActive = false;
      dragCleanup = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    dragCleanup = onUp;
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch drag support for horizontal galleries (with direction lock)
  document.addEventListener('touchstart', (e) => {
    const track = e.target.closest('.product__carousel-track');
    if (!track) return;
    const section = track.closest('.section');
    if (!section || !section.classList.contains('active')) return;
    let startX = e.touches[0].clientX;
    let startY = e.touches[0].clientY;
    let scrollLeft = track.scrollLeft;
    let locked = false;

    function onTouchMove(ev) {
      if (!locked) {
        var dx = Math.abs(ev.touches[0].clientX - startX);
        var dy = Math.abs(ev.touches[0].clientY - startY);
        if (dx + dy < 10) return;
        if (dx > dy) { locked = true; dragActive = true; }
        else { cleanup(); return; }
      }
      ev.preventDefault();
      track.scrollLeft = scrollLeft - (ev.touches[0].clientX - startX);
    }
    function cleanup() {
      dragActive = false;
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', cleanup);
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', cleanup);
  }, { passive: true });

  // Force cleanup on section transition
  const origGoToSection = goToSection;
  goToSection = function(index) {
    if (dragCleanup) { dragCleanup(); }
    return origGoToSection(index);
  };

  /* --- Init --- */
  updateUIVisibility();

  /* --- 3D Box Button: global mouse tracking (desktop only) --- */
  const revealBtns = document.querySelectorAll('.reveal-trigger');
  let btnMouseX = window.innerWidth / 2;
  let btnMouseY = window.innerHeight / 2;
  const isTouchOnly = 'ontouchstart' in window;

  document.addEventListener('mousemove', (e) => {
    btnMouseX = e.clientX;
    btnMouseY = e.clientY;
  });

  const BTN_RADIUS = 300; // px — effect radius around each button
  const inlineCubeBoxes = document.querySelectorAll('.inline-cube__box');

  function updateBtnRotations() {
    revealBtns.forEach(btn => {
      const rect = btn.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = btnMouseX - cx;
      const dy = btnMouseY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const falloff = Math.max(0, 1 - dist / BTN_RADIUS);
      const rx = (dy / BTN_RADIUS) * -25 * falloff;
      const ry = (dx / BTN_RADIUS) * 25 * falloff;
      btn.style.setProperty('--rx', rx + 'deg');
      btn.style.setProperty('--ry', ry + 'deg');
    });

    // All inline cubes — global mouse direction tracking
    const mx = (btnMouseX / window.innerWidth - 0.5) * 2;
    const my = (btnMouseY / window.innerHeight - 0.5) * 2;
    inlineCubeBoxes.forEach(box => {
      box.style.setProperty('--irx', (my * -35) + 'deg');
      box.style.setProperty('--iry', (mx * 35) + 'deg');
    });

    requestAnimationFrame(updateBtnRotations);
  }
  if (!isTouchOnly) requestAnimationFrame(updateBtnRotations);

  /* --- Glitch bursts --- */
  const glitchEl = document.querySelector('.glitch');
  if (glitchEl) {
    const colors = ['rgba(255,32,32,0.8)', 'rgba(0,255,65,0.6)', 'rgba(0,102,255,0.7)'];
    (function loop() {
      const rx = (Math.random() - 0.5) * 16;
      const ry = (Math.random() - 0.5) * 8;
      const c1 = colors[Math.floor(Math.random() * 3)];
      const c2 = colors[Math.floor(Math.random() * 3)];
      glitchEl.style.textShadow = `${rx}px ${ry}px 0 ${c1}, ${-rx}px ${-ry}px 0 ${c2}`;
      setTimeout(() => { glitchEl.style.textShadow = ''; }, 100 + Math.random() * 80);
      setTimeout(loop, 1000 + Math.random() * 2000);
    })();
  }

  /* --- 3D Pixel: Mouse tracking + cursor mode --- */
  const pixelCube = document.getElementById('pixelCube');
  const pixelEl = document.getElementById('pixel');
  if (pixelCube && pixelEl) {
    let targetRx = 0, targetRy = 0;
    let currentRx = 0, currentRy = 0;
    let mouseX = window.innerWidth / 2, mouseY = window.innerHeight / 2;
    let rafId = null;
    let lastMouseTime = Date.now();
    let idleAngle = 0;
    let isCursorMode = false;
    const isTouchDevice = 'ontouchstart' in window;

    document.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      const mx = (e.clientX / window.innerWidth - 0.5) * 2;
      const my = (e.clientY / window.innerHeight - 0.5) * 2;
      targetRx = my * -45;
      targetRy = mx * 45;
      lastMouseTime = Date.now();
    });

    function lerp(a, b, t) { return a + (b - a) * t; }

    function animate() {
      const idle = isTouchDevice || (Date.now() - lastMouseTime > 3000);

      if (idle && !isCursorMode) {
        idleAngle += 0.15;
        targetRx = Math.sin(idleAngle * 0.02) * 15;
        targetRy = Math.sin(idleAngle * 0.01) * 30;
      }

      currentRx = lerp(currentRx, targetRx, 0.08);
      currentRy = lerp(currentRy, targetRy, 0.08);

      pixelCube.style.setProperty('--rx', currentRx + 'deg');
      pixelCube.style.setProperty('--ry', currentRy + 'deg');

      if (isCursorMode) {
        pixelEl.style.left = mouseX + 'px';
        pixelEl.style.top = mouseY + 'px';
      }

      rafId = requestAnimationFrame(animate);
    }

    function setCursorMode(on) {
      if (isTouchDevice) { on = false; } // No cursor mode on touch devices
      isCursorMode = on;
      pixelEl.classList.toggle('pixel--cursor', on);
      document.body.classList.toggle('cursor-active', on);
      if (!on) {
        pixelEl.style.left = '50%';
        pixelEl.style.top = '50%';
      }
    }

    // Hook into section navigation
    const origUpdateUI = updateUIVisibility;
    updateUIVisibility = function() {
      origUpdateUI();
      setCursorMode(currentSection !== INTRO);
    };

    // Always run animation
    rafId = requestAnimationFrame(animate);
  }

  /* --- Mobile: hide identity description text, show em only --- */
  function stripIdentityDesc() {
    if (window.innerWidth > 768) return;
    document.querySelectorAll('.identity__detail').forEach(el => {
      if (el.dataset.stripped) return;
      el.childNodes.forEach(n => {
        if (n.nodeType === 3 && n.textContent.trim()) n.textContent = '';
      });
      var desc = el.querySelector('.identity__desc');
      if (desc) desc.remove();
      el.dataset.stripped = '1';
    });
  }
  stripIdentityDesc();
  document.addEventListener('click', function(e) {
    if (e.target.closest('[data-tab="identity"]')) {
      requestAnimationFrame(stripIdentityDesc);
    }
  });

})();
