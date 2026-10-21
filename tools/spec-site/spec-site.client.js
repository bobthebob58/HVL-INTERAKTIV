/*
 * spec-site.client — routing and requirement filtering for the generated spec site.
 *
 * Why: the site is one HTML file. Without JavaScript every view is shown stacked; this script
 *      turns it into a navigable reader and makes the requirement list filterable.
 * Spec: DOC-004
 * Invariants:
 *   - Only plain hash tokens are used ("#spec-01", "#r-SEC-001", "#spec-01--4-pattern-catalogue"),
 *     so deep links survive environments that strip anything else.
 *   - Nothing is stored; the page works the same in private windows.
 *   - A11Y: focus moves to the heading of the view or target the reader navigated to (WCAG 2.4.3),
 *     and filter results are announced through a polite live region (WCAG 4.1.3).
 * Collaborators: inlined by buildSpecSite.mjs into the page produced by pageTemplate.mjs.
 * Tests: Session 1 adds a Playwright smoke test of routing and filtering.
 */
(function () {
  'use strict';
  var root = document.documentElement;
  root.lang = 'en';
  root.classList.add('js');

  var views = Array.prototype.slice.call(document.querySelectorAll('.view'));
  var navLinks = Array.prototype.slice.call(document.querySelectorAll('.sidenav a[data-view]'));
  var navToggle = document.querySelector('.nav-toggle');
  var narrow = window.matchMedia('(max-width: 60rem)');
  var baseTitle = document.title;
  if (narrow.matches && navToggle) navToggle.open = false;

  /** Resolves a hash token to { view, target } elements. */
  function resolve(hash) {
    var token = decodeURIComponent((hash || '').replace(/^#/, ''));
    var target = token ? document.getElementById(token) : null;
    var viewKey = token.split('--')[0];
    var view = target && target.closest ? target.closest('.view') : null;
    if (!view) view = document.getElementById(viewKey);
    if (!view || !view.classList.contains('view')) view = document.getElementById('overview');
    return { view: view, target: target && target !== view ? target : null };
  }

  /** A11Y: only tables and code blocks that really scroll sideways stay tab stops (WCAG 2.1.1). */
  function markScrollers(scope) {
    Array.prototype.forEach.call(scope.querySelectorAll('.table-wrap, pre.code'), function (el) {
      if (!el.clientWidth) return; // hidden view or closed card: decided when it is shown
      if (el.scrollWidth > el.clientWidth) el.setAttribute('tabindex', '0');
      else el.removeAttribute('tabindex');
    });
  }

  /** Shows one view, marks the nav link, and moves focus for keyboard and screen-reader users. */
  function route(moveFocus) {
    var r = resolve(location.hash);
    views.forEach(function (v) { v.hidden = v !== r.view; });
    navLinks.forEach(function (a) {
      if (a.getAttribute('data-view') === r.view.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var current = navLinks.filter(function (a) { return a.getAttribute('data-view') === r.view.id; })[0];
    document.title = current ? current.textContent + ' · ' + baseTitle : baseTitle; // A11Y: WCAG 2.4.2
    var focusEl = r.target || r.view.querySelector('h2');
    if (r.target && r.target.tagName === 'DETAILS') r.target.open = true;
    if (moveFocus && focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
      focusEl.scrollIntoView({ block: 'start' });
    }
    if (moveFocus && narrow.matches && navToggle) navToggle.open = false;
    markScrollers(r.view);
    // WHY: a vertical scrollbar may appear after the view is shown and narrow the tables by ~15 px.
    window.requestAnimationFrame(function () { markScrollers(r.view); });
  }

  window.addEventListener('hashchange', function () { route(true); });
  window.addEventListener('resize', function () { markScrollers(document); });
  document.addEventListener('toggle', function (e) { if (e.target.open) markScrollers(e.target); }, true);
  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (a.classList.contains('skip')) {
      // A11Y: "Skip to content" stays in the current view (WCAG 2.4.1); "#main" is not a view.
      e.preventDefault();
      var h = views.filter(function (v) { return !v.hidden; })[0].querySelector('h2');
      h.focus(); h.scrollIntoView({ block: 'start' });
    } else if (a.hash === location.hash) {
      // No hashchange fires for the current hash: route here, or focus falls to <body> (WCAG 2.4.3).
      e.preventDefault(); route(true);
    }
  });
  route(Boolean(location.hash));

  // ---- Requirement explorer -------------------------------------------------------------
  var form = document.getElementById('req-filters');
  if (!form) return;
  var cards = Array.prototype.slice.call(document.querySelectorAll('details.req'));
  var count = document.getElementById('req-count');
  var expand = document.getElementById('req-expand');
  var fields = {
    search: document.getElementById('req-search'),
    area: document.getElementById('req-area'),
    priority: document.getElementById('req-priority'),
    session: document.getElementById('req-session'),
    status: document.getElementById('req-status'),
  };
  var timer = null;

  /** Applies all filters; every word typed in Search must appear in the requirement. */
  function applyFilters() {
    var words = fields.search.value.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = 0;
    cards.forEach(function (card) {
      var d = card.dataset;
      var ok = (!fields.area.value || d.area === fields.area.value)
        && (!fields.priority.value || d.priority === fields.priority.value)
        && (!fields.session.value || d.session === fields.session.value)
        && (!fields.status.value || d.status === fields.status.value)
        && words.every(function (w) { return d.text.indexOf(w) !== -1; });
      card.hidden = !ok;
      if (ok) shown++;
    });
    syncExpandLabel();
    count.textContent = shown === cards.length
      ? 'Showing all ' + cards.length + ' requirements.'
      : shown === 0 ? 'No requirements match these filters. Clear a filter or change the search words.'
        : 'Showing ' + shown + ' of ' + cards.length + ' requirements.';
  }

  form.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(applyFilters, 150);
  });
  form.addEventListener('submit', function (e) { e.preventDefault(); applyFilters(); });
  form.addEventListener('reset', function () { setTimeout(applyFilters, 0); });

  /** A11Y: the label states the action the button will take next, derived from the visible cards. */
  function syncExpandLabel() {
    var visible = cards.filter(function (c) { return !c.hidden; });
    var allOpen = visible.length > 0 && visible.every(function (c) { return c.open; });
    expand.textContent = allOpen ? 'Collapse all' : 'Expand all';
  }
  expand.addEventListener('click', function () {
    var visible = cards.filter(function (c) { return !c.hidden; });
    var open = !visible.every(function (c) { return c.open; });
    visible.forEach(function (c) { c.open = open; });
    syncExpandLabel();
  });
  document.querySelector('.req-list').addEventListener('toggle', syncExpandLabel, true);
})();
