/* Payment Terminal · Flow 2 — interactive prototype
 * State machine, timings and motion follow .design/FLOW.md,
 * which records the Figma prototype reactions and Motion keyframes. */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Config — straight from the Figma prototype                          *
   * ------------------------------------------------------------------ */

  var MAX_DIGITS = 7; // 99 999,99 € (brief D6)

  // Figma easing names → CSS
  var EASE_OUT = "cubic-bezier(0, 0, 0.58, 1)";
  var EASE_IN_OUT = "cubic-bezier(0.42, 0, 0.58, 1)";
  var EASE_LOADER = "cubic-bezier(0.5, 0, 0.5, 1)";

  var INSTANT = { duration: 0 };
  var DISSOLVE_300 = { duration: 300, easing: EASE_OUT };

  // Automatic sequence: after `hold` ms on a state, go to `next` with `transition`.
  var SEQUENCE = {
    "please-wait":   { hold: 2000, next: "present-card",  transition: INSTANT },
    "present-card":  { hold: 3000, next: "card-read",     transition: { duration: 800, easing: EASE_OUT } },
    "card-read":     { hold: 2000, next: "please-wait-2", transition: INSTANT },
    "please-wait-2": { hold: 500,  next: "authorization", transition: INSTANT },
    "authorization": { hold: 2000, next: "approved",      transition: { duration: 300, easing: EASE_IN_OUT } },
    // Figma has a 2 s / dissolve 300 ms ease-out timer on Approved with no destination;
    // it now returns to a fresh sale (brief D1). Tapping still returns immediately.
    "approved":      { hold: 2000, next: "amount-entry",  transition: DISSOLVE_300 }
  };

  // What each transaction screen shows (Figma frames 2003:2104 … 2003:670).
  var TXN_SCREENS = {
    "please-wait":   { body: "loading", prompt: "please wait",                                     announce: "Please wait" },
    "present-card":  { body: "card",    prompt: "Inserez, passez ou présentez<br>votre carte",       announce: "Insérez, passez ou présentez votre carte", leds: true },
    "card-read":     { body: "loading", prompt: "card read",                                       announce: "Card read" },
    "please-wait-2": { body: "loading", prompt: "please wait",                                     announce: "Please wait" },
    "authorization": { body: "loading", prompt: "Authorization please wait<br>Authorisation - patientez", announce: "Authorization, please wait", scheme: "CB" },
    "approved":      { body: "approved",                                                           announce: "Approved. Paiement accepté", date: true }
  };

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ------------------------------------------------------------------ *
   * DOM                                                                 *
   * ------------------------------------------------------------------ */

  var screen = document.getElementById("screen");
  var announcer = document.getElementById("announcer");
  var views = {};

  function txnTemplate(id, cfg) {
    var meta =
      '<span class="txn-debit">debit</span>' +
      (cfg.scheme ? '<span class="txn-scheme">' + cfg.scheme + "</span>" : "") +
      (cfg.date ? '<span class="txn-date">05/08/26 at 12:13:44</span>' : "");

    var thirdRow = cfg.leds
      ? '<div class="leds" aria-hidden="true"><span class="led led--on"></span><span class="led"></span><span class="led"></span><span class="led"></span></div>'
      : cfg.date
        ? '<img class="txn-cb" src="assets/cb-small.svg" alt="">'
        : "";

    var body = "";
    if (cfg.body === "loading") {
      body =
        '<p class="panel__prompt">' + cfg.prompt + "</p>" +
        '<div class="loader" aria-hidden="true">' +
        '  <img class="loader__ring" src="assets/loader-ring.svg" alt="">' +
        '  <img class="loader__logo" src="assets/loader-logo@4x.png" alt="">' +
        "</div>";
    } else if (cfg.body === "card") {
      body =
        '<p class="panel__prompt panel__prompt--muted">' + cfg.prompt + "</p>" +
        '<img class="schemes" src="assets/card-schemes@2x.png" alt="CB, Visa, Mastercard, American Express, Diners Club, Discover, UnionPay, JCB">' +
        // Figma fill is an animated GIF (500×500); falls back to the static export until the file is added.
        '<img class="terminal-art" src="assets/terminal-illustration.gif" alt="" onerror="this.onerror=null;this.src=\'assets/terminal-illustration@2x.png\'">' +
        '<button class="cta" type="button" data-action="cancel-transaction">cancel transaction</button>';
    } else if (cfg.body === "approved") {
      body =
        '<div class="banner">' +
        '  <div class="banner__title">approved</div>' +
        '  <div class="banner__sub">Paiement accepté</div>' +
        '  <div class="banner__check"><img src="assets/icon-check.svg" alt=""></div>' +
        "</div>" +
        '<img class="cb-logo" src="assets/cb-logo@2x.png" alt="CB">' +
        '<button class="new-sale" type="button" data-action="new-sale">Nouvelle vente</button>';
    }

    return (
      '<section class="view view--txn' + (cfg.body === "approved" ? " view--approved" : "") + '" data-view="' + id + '">' +
      '  <div class="statusbar statusbar--muted">' +
      '    <span class="statusbar__time">16:25</span>' +
      '    <img class="statusbar__icons" src="assets/status-icons-muted.svg" alt="">' +
      "  </div>" +
      '  <div class="txn-row txn-row--name">Originator name</div>' +
      '  <div class="txn-row txn-row--meta">' + meta + "</div>" +
      '  <div class="txn-row txn-row--leds">' + thirdRow + "</div>" +
      '  <div class="amount amount--txn" data-amount>' +
      '    <span class="amount__pad" aria-hidden="true">€</span>' +
      '    <span class="amount__value" data-amount-value>0,00</span>' +
      '    <span class="amount__cur" aria-hidden="true">€</span>' +
      "  </div>" +
      '  <div class="panel">' + body + "</div>" +
      "</section>"
    );
  }

  Object.keys(TXN_SCREENS).forEach(function (id) {
    screen.insertAdjacentHTML("beforeend", txnTemplate(id, TXN_SCREENS[id]));
  });
  screen.querySelectorAll("[data-view]").forEach(function (el) {
    views[el.getAttribute("data-view")] = el;
  });

  /* ------------------------------------------------------------------ *
   * Scale the 720 × 1600 screen to fit the window                       *
   * ------------------------------------------------------------------ */

  var device = document.getElementById("device");
  var fit = document.getElementById("deviceFit");

  function fitDevice() {
    var w = device.offsetWidth;
    var h = device.offsetHeight;
    var margin = 32;
    var s = Math.min((window.innerHeight - margin * 2) / h, (window.innerWidth - margin * 2) / w, 1);
    device.style.setProperty("--scale", s.toFixed(4));
    fit.style.width = w * s + "px";
    fit.style.height = h * s + "px";
  }
  window.addEventListener("resize", fitDevice);
  fitDevice();

  /* ------------------------------------------------------------------ *
   * Amount                                                              *
   * ------------------------------------------------------------------ */

  var digits = "";
  var fmt = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function amountText() {
    return fmt.format((parseInt(digits || "0", 10)) / 100);
  }

  function renderAmount() {
    var text = amountText();
    screen.querySelectorAll("[data-amount-value]").forEach(function (el) { el.textContent = text; });
    var entryAmount = views["amount-entry"].querySelector("[data-amount]");
    entryAmount.setAttribute("aria-label", text + " euros");
  }

  function shakeAmount() {
    var el = views["amount-entry"].querySelector("[data-amount]");
    if (reducedMotion.matches) return;
    el.animate(
      [
        { transform: "translateX(0)" },
        { transform: "translateX(-14px)" },
        { transform: "translateX(12px)" },
        { transform: "translateX(-8px)" },
        { transform: "translateX(4px)" },
        { transform: "translateX(0)" }
      ],
      { duration: 360, easing: EASE_OUT }
    );
  }

  /* ------------------------------------------------------------------ *
   * Loader motion — Figma keyframes, phase-locked to the document       *
   * timeline so it never jumps when the screen changes S4 → S5 → S6.    *
   * ------------------------------------------------------------------ */

  function startLoaders() {
    if (reducedMotion.matches) return;
    var timing = { duration: 2000, iterations: Infinity };

    screen.querySelectorAll(".loader__ring").forEach(function (ring) {
      var spin = ring.animate(
        [
          { transform: "rotate(0deg)", easing: EASE_LOADER },
          { transform: "rotate(-360deg)" }
        ],
        timing
      );
      var fade = ring.animate(
        [
          { opacity: 0.3, offset: 0, easing: EASE_LOADER },
          { opacity: 0.8, offset: 0.5, easing: EASE_IN_OUT },
          { opacity: 0.3, offset: 1 }
        ],
        timing
      );
      spin.startTime = 0;
      fade.startTime = 0;
    });

    screen.querySelectorAll(".loader__logo").forEach(function (logo) {
      var pulse = logo.animate(
        [
          { transform: "scale(0.9)", opacity: 0.6, offset: 0, easing: EASE_LOADER },
          { transform: "scale(1)", opacity: 1, offset: 0.25, easing: EASE_IN_OUT },
          { transform: "scale(0.9)", opacity: 0.6, offset: 0.75, easing: EASE_IN_OUT },
          { transform: "scale(0.9)", opacity: 0.6, offset: 1 }
        ],
        timing
      );
      pulse.startTime = 0;
    });
  }
  startLoaders();

  /* ------------------------------------------------------------------ *
   * Navigation                                                          *
   * ------------------------------------------------------------------ */

  var current = null;
  var holdTimer = null;
  var z = 1;

  function announce(text) {
    announcer.textContent = "";
    // next frame so repeated text is still announced
    requestAnimationFrame(function () { announcer.textContent = text; });
  }

  function go(id, transition) {
    var from = current ? views[current] : null;
    var to = views[id];
    transition = transition || INSTANT;

    clearTimeout(holdTimer);
    current = id;

    to.style.zIndex = String(++z);
    to.classList.add("is-active");

    var duration = reducedMotion.matches ? 0 : transition.duration;
    if (from && from !== to) {
      if (duration > 0) {
        to.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration, easing: transition.easing })
          .finished.then(function () { if (current !== from.getAttribute("data-view")) from.classList.remove("is-active"); });
      } else {
        from.classList.remove("is-active");
      }
    }

    var cfg = TXN_SCREENS[id];
    announce(cfg ? cfg.announce : "Saisissez le montant. " + amountText() + " euros");

    var step = SEQUENCE[id];
    if (step) {
      holdTimer = setTimeout(function () {
        if (step.next === "amount-entry") newSale();
        else go(step.next, step.transition);
      }, step.hold);
    }

    if (id === "approved") {
      var btn = to.querySelector("[data-action='new-sale']");
      if (btn) btn.focus({ preventScroll: true });
    }
  }

  function newSale() {
    digits = "";
    renderAmount();
    go("amount-entry", DISSOLVE_300);
  }

  /* ------------------------------------------------------------------ *
   * Input                                                               *
   * ------------------------------------------------------------------ */

  function press(key) {
    if (current !== "amount-entry") return;

    if (/^[0-9]$/.test(key)) {
      if (digits === "" && key === "0") return;   // no leading zeros
      if (digits.length >= MAX_DIGITS) { shakeAmount(); return; }
      digits += key;
    } else if (key === "back") {
      digits = digits.slice(0, -1);
    } else if (key === "clear") {
      digits = "";
    } else if (key === "ok") {
      if (!digits) { shakeAmount(); return; }     // brief D5
      go("please-wait", DISSOLVE_300);
      return;
    }
    renderAmount();
  }

  screen.addEventListener("click", function (e) {
    var keyEl = e.target.closest("[data-key]");
    if (keyEl) { press(keyEl.getAttribute("data-key")); return; }

    var action = e.target.closest("[data-action]");
    if (action && action.getAttribute("data-action") === "cancel-transaction" && current === "present-card") {
      newSale();   // brief D2: cancel resets the sale
      return;
    }
    if (current === "approved" && e.target.closest(".view--approved")) {
      newSale();   // brief D1: tap anywhere on Approved
    }
  });

  /* ------------------------------------------------------------------ *
   * Start                                                               *
   * ------------------------------------------------------------------ */

  renderAmount();
  go("amount-entry", INSTANT);

  // Debug hook for review tooling: window.__terminal.go('approved')
  window.__terminal = {
    go: function (id) { clearTimeout(holdTimer); go(id, INSTANT); clearTimeout(holdTimer); },
    setAmount: function (d) { digits = String(d); renderAmount(); },
    state: function () { return current; }
  };
})();
