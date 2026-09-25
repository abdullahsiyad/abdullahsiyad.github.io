/* motion.js — smooth scrolling, word-by-word headings, 3D tilt, magnetic buttons,
   hero parallax, logo orbit and the 3D skills orbit. Loaded before the main script. */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  /* ── 1. Split headings into words; each word rises out of a mask when revealed ── */
  const wrapWord = (content, i) => {
    const w = document.createElement('span'); w.className = 'w';
    const inner = document.createElement('span'); inner.className = 'wi';
    inner.style.setProperty('--i', i);
    if (typeof content === 'string') inner.textContent = content; else inner.appendChild(content);
    w.appendChild(inner);
    return w;
  };
  $$('[data-split]').forEach(el => {
    let i = 0;
    const walk = parent => {
      [...parent.childNodes].forEach(node => {
        if (node.nodeType === 3) {
          const frag = document.createDocumentFragment();
          node.textContent.split(/(\s+)/).forEach(part => {
            if (!part) return;
            frag.appendChild(/^\s+$/.test(part) ? document.createTextNode(' ') : wrapWord(part, i++));
          });
          parent.replaceChild(frag, node);
        } else if (node.nodeType === 1 && node.tagName !== 'BR') {
          if (node.classList.contains('grad')) {
            const mark = document.createComment('');
            parent.replaceChild(mark, node);
            parent.replaceChild(wrapWord(node, i++), mark);
          } else walk(node);
        }
      });
    };
    walk(el);
    el.classList.add('split-ready');
  });

  /* ── 2. Smooth momentum scrolling (Lenis loads async; this runs when it arrives) ── */
  window.__initLenis = () => {
    if (window.__lenis || reduce || !window.Lenis) return;
    window.__lenis = new window.Lenis({
      autoRaf: true, lerp: 0.09, anchors: true, allowNestedScroll: true,
      prevent: node => !!(node.closest && node.closest('textarea'))
    });
    root.classList.add('lenis-on');
  };
  if (window.Lenis) window.__initLenis();

  /* ── 3. 3D tilt on cards ── */
  if (fine && !reduce) {
    [['.stat', 10], ['.f-item', 7], ['.sk', 6], ['.about-card', 3]].forEach(([sel, max]) => $$(sel).forEach(el => {
      let t;
      el.addEventListener('pointermove', e => {
        if (el.classList.contains('reveal') && !el.classList.contains('in')) return;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        clearTimeout(t);
        el.style.transition = 'transform .15s linear';
        el.style.transform = `perspective(1000px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max * 1.2).toFixed(2)}deg) translateY(-3px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .8s cubic-bezier(.2,.8,.2,1)';
        el.style.transform = '';
        t = setTimeout(() => { el.style.transition = ''; }, 800);
      });
    }));

    /* ── 4. Magnetic buttons ── */
    $$('.btn, .icon-btn').forEach(el => {
      const k = el.classList.contains('icon-btn') ? 0.35 : 0.22;
      el.addEventListener('pointermove', e => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
        el.style.transition = 'transform .15s ease-out';
        el.style.transform = `translate(${(dx * k).toFixed(1)}px, ${(dy * k).toFixed(1)}px)`;
      });
      el.addEventListener('pointerleave', () => {
        el.style.transition = 'transform .7s cubic-bezier(.3,1.6,.5,1)';
        el.style.transform = '';
      });
    });
  }

  /* ── 5. Scroll-linked: hero parallax, nav state, logo orbit, statement ring ── */
  const heroCopy = $('.hero-copy'), heroCard = $('.hero-card'), nav = $('.nav'), statement = $('.statement');
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const vh = innerHeight, y = scrollY;
    const p = Math.min(Math.max(y / (vh * 0.9), 0), 1);
    if (!reduce && heroCopy) {
      heroCopy.style.transform = `translate3d(0, ${(-p * 80).toFixed(1)}px, 0)`;
      heroCopy.style.opacity = p > 0.001 ? (1 - p * 0.85).toFixed(3) : '';
      if (heroCard) heroCard.style.transform = `perspective(1200px) translate3d(0, ${(-p * 40).toFixed(1)}px, 0) rotateX(${(p * 10).toFixed(2)}deg)`;
    }
    const d = Math.min(Math.max((y / vh - 0.04) / 0.81, 0), 1);
    root.style.setProperty('--dock', (d * d * (3 - 2 * d)).toFixed(3));
    if (nav) nav.classList.toggle('scrolled', y > 24);
    if (statement) {
      const r = statement.getBoundingClientRect();
      const sp = Math.min(Math.max((vh - r.top) / (vh + r.height), 0), 1);
      statement.style.setProperty('--sp', sp.toFixed(4));
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll);
  onScroll();

  /* ── 6. Skills orbit: three tilted rings of tools you can drag to spin ── */
  const orbit = $('#orbit');
  if (orbit) {
    const plane = $('.orbit-plane', orbit);
    const core = $('.orbit-core', orbit);
    const rings = [1, 2, 3].map(n => $('.ring.r' + n, orbit));
    const chips = $$('.chip', orbit);
    const now = $('#orbitNow .orbit-now-t'), nowWrap = $('#orbitNow');
    const cards = { a: $('.sk[data-g="a"]'), o: $('.sk[data-g="o"]'), d: $('.sk[data-g="d"]') };
    const groupName = { a: 'Data & Reporting', o: 'Supply Chain & S&OP', d: 'Industry Knowledge' };
    const SPEED = { 1: 0.16, 2: 0.11, 3: 0.075 };           // inner rings travel faster
    let radii = { 1: 100, 2: 170, 3: 240 }, compact = false;
    let spin = 0, vel = 0, dragging = false, lastX = 0, moved = 0, over = false, active = null, pinned = null;
    let BT = 56, tilt = 56, tiltT = 56, zr = 0, zrT = 0, time = 0;

    const layout = () => {
      const w = orbit.clientWidth, h = orbit.clientHeight;
      compact = w < 560;
      orbit.classList.toggle('compact', compact);
      BT = compact ? 46 : 56; tiltT = BT;
      const r3 = Math.min(w * 0.49, h * 1.0, 400);
      radii = { 1: r3 * 0.45, 2: r3 * 0.73, 3: r3 };
      rings.forEach((el, i) => { const r = radii[i + 1]; el.style.width = el.style.height = r * 2 + 'px'; el.style.margin = -r + 'px 0 0 ' + -r + 'px'; });
      // spread the visible chips evenly on their ring
      [1, 2, 3].forEach(n => {
        const list = chips.filter(c => c.dataset.ring == n && (!compact || c.hasAttribute('data-core')));
        list.forEach((c, i) => { c._a = (i / list.length) * Math.PI * 2 + n * 0.7; c._on = true; });
        chips.filter(c => c.dataset.ring == n && compact && !c.hasAttribute('data-core')).forEach(c => { c._on = false; });
      });
    };

    const light = (chip, on) => {
      const g = chip.dataset.g, card = cards[g];
      chip.classList.toggle('on', on);
      if (card) {
        card.classList.toggle('hl', on);
        const li = card.querySelectorAll('li')[+chip.dataset.li];
        if (li && chip.dataset.li !== '-1') li.classList.toggle('hl', on);
      }
      if (on) {
        now.innerHTML = '';
        const b = document.createElement('b'); b.textContent = chip.textContent;
        now.append(b, document.createTextNode(' · ' + groupName[g]));
        nowWrap.classList.add('live');
      } else if (!pinned) {
        now.textContent = 'Hover a tool';
        nowWrap.classList.remove('live');
      }
    };

    const render = () => {
      plane.style.transform = `rotateX(${tilt.toFixed(2)}deg) rotateZ(${zr.toFixed(2)}deg)`;
      const face = `rotateZ(${(-zr).toFixed(2)}deg) rotateX(${(-tilt).toFixed(2)}deg)`;
      if (core) core.style.transform = `${face} translate(-50%, -50%)`;
      chips.forEach(c => {
        if (!c._on) return;
        const n = +c.dataset.ring, r = radii[n];
        const a = c._a + spin + time * SPEED[n];
        const x = Math.cos(a) * r, y = Math.sin(a) * r;
        c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0) ${face} translate(-50%, -50%)`;
        c.style.opacity = (0.42 + 0.58 * ((Math.sin(a) + 1) / 2)).toFixed(3);
      });
    };

    orbit.addEventListener('pointerdown', e => {
      dragging = true; moved = 0; lastX = e.clientX;
      orbit.setPointerCapture(e.pointerId);
      orbit.classList.add('dragging');
    });
    orbit.addEventListener('pointermove', e => {
      const r = orbit.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
      if (fine) { tiltT = BT + py * 8; zrT = px * 8; }
      if (!dragging) return;
      const dx = e.clientX - lastX; lastX = e.clientX; moved += Math.abs(dx);
      spin += dx * 0.006; vel = dx * 0.006 * 60;
    });
    const end = () => { dragging = false; orbit.classList.remove('dragging'); };
    orbit.addEventListener('pointerup', end);
    orbit.addEventListener('pointercancel', end);
    orbit.addEventListener('pointerenter', () => { over = true; });
    orbit.addEventListener('pointerleave', () => { over = false; tiltT = BT; zrT = 0; });

    chips.forEach(c => {
      c.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse' || dragging) return; active = c; if (pinned && pinned !== c) light(pinned, false); light(c, true); });
      c.addEventListener('pointerleave', e => { if (e.pointerType !== 'mouse') return; if (active === c) active = null; if (pinned !== c) light(c, false); if (pinned) light(pinned, true); });
      c.addEventListener('click', () => {
        if (moved > 6) return;
        if (pinned === c) { pinned = null; light(c, false); return; }
        if (pinned) light(pinned, false);
        pinned = c; light(c, true);
      });
    });

    let last = performance.now(), running = false;
    const loop = t => {
      const dt = Math.min((t - last) / 1000, 0.05); last = t;
      const calm = active || pinned || over ? 0.2 : 1;
      if (!dragging) { vel *= Math.pow(0.08, dt); spin += vel * dt; }
      time += dt * calm;
      tilt += (tiltT - tilt) * (1 - Math.pow(0.02, dt));
      zr += (zrT - zr) * (1 - Math.pow(0.02, dt));
      render();
      if (running) requestAnimationFrame(loop);
    };
    layout(); render();
    addEventListener('resize', () => { layout(); render(); });
    if (!reduce) {
      new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); }
        else if (!en.isIntersecting) running = false;
      }).observe(orbit);
    } else {
      // no auto motion: still allow dragging
      orbit.addEventListener('pointermove', () => { if (dragging) render(); });
    }
  }
})();
