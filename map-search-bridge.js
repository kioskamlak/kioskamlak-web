/* Copyright (c) 2026 Shirangi. All rights reserved. */
/* Universal map-search input bridge: mouse + touch + pointer + direct inline fallback. */
(function () {
  'use strict';
  function forceMapScreen() {
    var screens = document.querySelectorAll('.screen');
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove('active');
    var mapScreen = document.getElementById('screen-map');
    if (!mapScreen) return false;
    mapScreen.classList.add('active');
    mapScreen.setAttribute('aria-hidden', 'false');
    return true;
  }
  function activateMapSearch(event) {
    if (event) {
      try { event.preventDefault(); } catch (_) {}
      try { event.stopImmediatePropagation(); } catch (_) {}
    }
    var called = false;
    if (typeof window.startMapSearch === 'function') {
      try { window.startMapSearch(); called = true; } catch (err) { console.warn('[Shirangi] startMapSearch recovered', err); }
    }
    if (!called && typeof window.goTo === 'function') {
      try { window.goTo('map'); called = true; } catch (err) { console.warn('[Shirangi] goTo(map) recovered', err); }
    }
    if (!forceMapScreen()) return false;
    window.setTimeout(function () {
      var input = document.getElementById('map-search-input');
      if (!input) return;
      try { input.focus({ preventScroll: true }); } catch (_) { try { input.focus(); } catch (__) {} }
    }, 120);
    return true;
  }
  function bind() {
    var button = document.getElementById('start-map-search-btn');
    if (!button || button.__shirangiMapSearchBound) return;
    button.__shirangiMapSearchBound = true;
    button.addEventListener('pointerup', activateMapSearch, { capture: true, passive: false });
    button.addEventListener('touchend', activateMapSearch, { capture: true, passive: false });
    button.addEventListener('click', activateMapSearch, { capture: true, passive: false });
  }
  window.ShirangiMapSearch = Object.freeze({ activate: activateMapSearch, bind: bind });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bind, { once: true });
  else bind();
  window.setTimeout(bind, 0);
  window.setTimeout(bind, 500);
})();
