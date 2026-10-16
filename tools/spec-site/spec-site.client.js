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

  /** Shows one view, marks the nav link, and moves focus for keyboard and screen-reader users. */
  function route(moveFocus) {
    var r = resolve(location.hash);
    views.forEach(function (v) { v.hidden = v !== r.view; });
    navLinks.forEach(function (a) {
      if (a.getAttribute('data-view') === r.view.id) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    var focusEl = r.target || r.view.querySelector('h2');
    if (r.target && r.target.tagName === 'DETAILS') r.target.open = true;
    if (moveFocus && focusEl) {
      if (!focusEl.hasAttribute('tabindex')) focusEl.setAttribute('tabindex', '-1');
      focusEl.focus({ preventScroll: true });
      focusEl.scrollIntoView({ block: 'start' });
    }
    if (moveFocus && narrow.matches && navToggle) navToggle.open = false;
  }

  window.addEventListener('hashchange', function () { route(true); });
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

  var expanded = false;
  expand.addEventListener('click', function () {
    expanded = !expanded;
    cards.forEach(function (c) { if (!c.hidden) c.open = expanded; });
    // A11Y: the label states the action the button will take next (no aria-pressed as well).
    expand.textContent = expanded ? 'Collapse all' : 'Expand all';
  });
})();
