/*
 * Stage menu — prototype chrome for screen recording, not part of the terminal design.
 * A ☰ button in the window's top-left corner opens a small panel: which software interface
 * the terminal shows (new or old), upcoming features to switch on (wired in app.js), the page
 * background behind the terminal, and the terminal's drop shadow. Choices are remembered in
 * this browser.
 *
 * So it stays out of recordings, the button fades away after a few seconds and comes back
 * when the pointer moves into the top-left corner or the button gets keyboard focus.
 */
(function () {
  "use strict";

  var DEFAULT_BG = "#e6e6e8";
  var STORE_KEY = "payment-terminal:stage-bg";
  var SHADOW_KEY = "payment-terminal:device-shadow";
  var UI_KEY = "payment-terminal:ui";
  var CORNER = 160;          // px from the top-left corner that wakes the button
  var FIRST_HIDE = 3000;     // ms the button stays visible after the page opens

  var menu = document.getElementById("stageMenu");
  var toggle = menu.querySelector(".stage-menu__toggle");
  var panel = menu.querySelector(".stage-menu__panel");
  var radios = panel.querySelectorAll('input[name="stage-bg"]');
  var picker = panel.querySelector('input[type="color"]');
  var hex = panel.querySelector(".stage-menu__hex");

  /* ---------- Background ---------- */

  function normalise(value) {
    var v = String(value || "").trim().toLowerCase();
    if (v.charAt(0) !== "#") v = "#" + v;
    if (/^#[0-9a-f]{3}$/.test(v)) v = "#" + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    return /^#[0-9a-f]{6}$/.test(v) ? v : null;
  }

  // Dark backgrounds get a light button, so it stays visible on black or blue screen.
  function isDark(color) {
    var c = [1, 3, 5].map(function (i) {
      var s = parseInt(color.substr(i, 2), 16) / 255;
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] < 0.18;
  }

  function setBackground(color, from) {
    document.body.style.setProperty("--stage-bg", color);
    menu.setAttribute("data-ink", isDark(color) ? "light" : "dark");
    for (var i = 0; i < radios.length; i++) radios[i].checked = radios[i].value === color;
    if (from !== picker) picker.value = color;
    if (from !== hex) hex.value = color;
    try { localStorage.setItem(STORE_KEY, color); } catch (e) { /* private mode: not remembered */ }
  }

  panel.addEventListener("change", function (e) {
    if (e.target.name === "stage-bg") setBackground(e.target.value, e.target);
  });
  picker.addEventListener("input", function () { setBackground(picker.value, picker); });
  hex.addEventListener("input", function () {
    var color = normalise(hex.value);
    hex.setAttribute("aria-invalid", color ? "false" : "true");
    if (color) setBackground(color, hex);
  });
  hex.addEventListener("blur", function () {
    hex.value = picker.value;          // tidy a half-typed or invalid value
    hex.setAttribute("aria-invalid", "false");
  });

  var saved = null;
  try { saved = normalise(localStorage.getItem(STORE_KEY)); } catch (e) { /* storage blocked */ }
  setBackground(saved || DEFAULT_BG);

  /* ---------- Interface: new or old software ---------- */
  // app.js reads <html data-ui> when the payment reaches Approved, so a switch takes effect
  // from the next approval; a screen already on show stays as it is.

  var uiRadios = panel.querySelectorAll('input[name="stage-ui"]');

  function setUi(ui) {
    document.documentElement.setAttribute("data-ui", ui);
    for (var i = 0; i < uiRadios.length; i++) uiRadios[i].checked = uiRadios[i].value === ui;
    try { localStorage.setItem(UI_KEY, ui); } catch (e) { /* not remembered */ }
  }

  panel.addEventListener("change", function (e) {
    if (e.target.name === "stage-ui") setUi(e.target.value);
  });

  var savedUi = null;
  try { savedUi = localStorage.getItem(UI_KEY); } catch (e) { /* storage blocked */ }
  setUi(savedUi === "old" ? "old" : "new");

  /* ---------- Terminal drop shadow ---------- */

  var shadow = panel.querySelector('input[name="device-shadow"]');

  function setShadow(on) {
    shadow.checked = on;
    document.body.classList.toggle("no-device-shadow", !on);
    try { localStorage.setItem(SHADOW_KEY, on ? "on" : "off"); } catch (e) { /* not remembered */ }
  }

  shadow.addEventListener("change", function () { setShadow(shadow.checked); });

  var savedShadow = null;
  try { savedShadow = localStorage.getItem(SHADOW_KEY); } catch (e) { /* storage blocked */ }
  setShadow(savedShadow !== "off");

  /* ---------- Open / close ---------- */

  function open() {
    panel.hidden = false;
    toggle.setAttribute("aria-expanded", "true");
    var checked = panel.querySelector('input[name="stage-bg"]:checked');
    (checked || radios[0]).focus();
    wake();
  }

  function close(returnFocus) {
    if (panel.hidden) return;
    panel.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
    rest();
  }

  toggle.addEventListener("click", function () {
    if (panel.hidden) open(); else close(true);
  });

  document.addEventListener("pointerdown", function (e) {
    if (!panel.hidden && !menu.contains(e.target)) close(false);
  });

  // Capture phase, so Esc closes this panel without also closing a menu or sheet on the terminal.
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !panel.hidden) {
      e.stopPropagation();
      close(true);
    }
  }, true);

  /* ---------- Hide when not in use ---------- */

  var pointerNear = false;
  var started = false;

  function wake() { menu.classList.remove("is-idle"); }

  function rest() {
    var inUse = !panel.hidden || pointerNear || menu.contains(document.activeElement);
    menu.classList.toggle("is-idle", started && !inUse);
  }

  document.addEventListener("pointermove", function (e) {
    var near = e.clientX < CORNER && e.clientY < CORNER;
    if (near === pointerNear) return;
    pointerNear = near;
    if (near) wake(); else rest();
  });
  document.documentElement.addEventListener("pointerleave", function () {
    pointerNear = false;
    rest();
  });
  menu.addEventListener("focusin", wake);
  menu.addEventListener("focusout", function () { setTimeout(rest, 0); });

  setTimeout(function () { started = true; rest(); }, FIRST_HIDE);
})();
