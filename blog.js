/* Open Tab: progress bar, contents rail, share row, topic filter. No dependencies. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  /* reading progress */
  var bar = $('.progress i'), art = $('.prose');
  if (bar && art) {
    var tick = false;
    var paint = function () {
      tick = false;
      var r = art.getBoundingClientRect();
      var total = r.height - window.innerHeight * 0.6;
      var done = total > 0 ? Math.min(1, Math.max(0, -r.top / total)) : 0;
      bar.style.transform = 'scaleX(' + done.toFixed(4) + ')';
    };
    var onScroll = function () { if (!tick) { tick = true; requestAnimationFrame(paint); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    paint();
  }

  /* contents: open on wide screens, folded on phones; highlight current section */
  var toc = $('.post-toc details');
  if (toc) {
    var mq = window.matchMedia('(min-width:1021px)');
    var sync = function () { toc.open = mq.matches; };
    sync();
    if (mq.addEventListener) mq.addEventListener('change', sync); else if (mq.addListener) mq.addListener(sync);
    var links = $$('.toc-links a');
    var map = {};
    links.forEach(function (a) { var el = document.getElementById(a.getAttribute('href').slice(1)); if (el) map[a.getAttribute('href')] = el; });
    if ('IntersectionObserver' in window) {
      var cur = null;
      var io = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (e.isIntersecting) {
            cur = '#' + e.target.id;
            links.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === cur); });
          }
        });
      }, { rootMargin: '0px 0px -70% 0px', threshold: 0 });
      Object.keys(map).forEach(function (k) { io.observe(map[k]); });
    }
    links.forEach(function (a) {
      a.addEventListener('click', function () { if (!mq.matches) toc.open = false; });
    });
  }

  /* share row */
  $$('[data-copy]').forEach(function (b) {
    b.addEventListener('click', function () {
      var url = location.origin + location.pathname.replace(/index\.html$/, '');
      var done = function () { var o = b.textContent; b.textContent = 'Link copied'; setTimeout(function () { b.textContent = o; }, 1800); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done, function () { fallback(url); done(); });
      } else { fallback(url); done(); }
    });
  });
  function fallback(t) {
    var x = document.createElement('textarea');
    x.value = t; x.setAttribute('readonly', ''); x.style.cssText = 'position:fixed;opacity:0;top:0';
    document.body.appendChild(x); x.select();
    try { document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(x);
  }
  $$('[data-share]').forEach(function (b) {
    if (!navigator.share) return;
    b.hidden = false;
    b.addEventListener('click', function () {
      navigator.share({ title: document.title, url: location.href.split('#')[0] }).catch(function () {});
    });
  });

  /* hub: today's date, topic filter */
  var today = $('#today');
  if (today) {
    try {
      today.textContent = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { /* keep static text */ }
  }
  var fbar = $('.filters');
  if (fbar) {
    var btns = $$('button[data-topic]', fbar);
    var items = $$('[data-topic]').filter(function (n) { return n.tagName !== 'BUTTON'; });
    var groups = $$('[data-group]');
    var count = $('#count');
    var known = btns.map(function (b) { return b.getAttribute('data-topic'); });
    var apply = function (t, push) {
      if (known.indexOf(t) < 0) t = 'all';
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-topic') === t)); });
      var shown = 0;
      items.forEach(function (n) {
        var on = t === 'all' || n.getAttribute('data-topic') === t;
        n.hidden = !on;
        if (on) shown++;
      });
      groups.forEach(function (g) {
        g.hidden = !$$('[data-topic]', g).some(function (n) { return !n.hidden; });
      });
      if (count) count.textContent = shown + (shown === 1 ? ' story' : ' stories');
      if (push && window.history && history.replaceState) {
        history.replaceState(null, '', t === 'all' ? location.pathname : location.pathname + '?topic=' + t);
      }
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { apply(b.getAttribute('data-topic'), true); }); });
    var m = /[?&]topic=([a-z-]+)/.exec(location.search);
    apply(m ? m[1] : 'all', false);
  }
})();
