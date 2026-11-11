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
  var EASE_IN = "cubic-bezier(0.42, 0, 1, 1)";

  var INSTANT = { duration: 0 };
  var DISSOLVE_300 = { duration: 300, easing: EASE_OUT };
  var CARD_TAPPED = { duration: 800, easing: EASE_OUT };   // Present Card → Card Read

  // Automatic sequence: after `hold` ms on a state, go to `next` with `transition`.
  // Timings from Figma "PayXpress Compose" › Payment Flow (New), 2026-11-11.
  // Present Card has no timer: the participant clicks the screen to "tap" the card.
  var SEQUENCE = {
    "please-wait":   { hold: 2000, next: "present-card",  transition: INSTANT },
    "card-read":     { hold: 1000, next: "please-wait-2", transition: INSTANT },
    "please-wait-2": { hold: 800,  next: "authorization", transition: INSTANT },
    "authorization": { hold: 2000, next: "approved",      transition: INSTANT },
    "approved":      { hold: 2000, next: "receipt",       transition: DISSOLVE_300 }
  };

  // What each transaction screen shows (Figma frames 5735:43828 … 5987:6264).
  var TXN_SCREENS = {
    "please-wait":   { body: "loading", prompt: "please wait",                    announce: "Please wait" },
    "present-card":  { body: "card",    prompt: "Insert, swipe or tap<br>your card", announce: "Insert, swipe or tap your card", leds: true },
    "card-read":     { body: "loading", prompt: "card read",                      announce: "Card read" },
    "please-wait-2": { body: "loading", prompt: "please wait",                    announce: "Please wait" },
    "authorization": { body: "loading", prompt: "Authorization<br>Please wait",   announce: "Authorization, please wait", scheme: "CB" },
    "approved":      { body: "approved",                                          announce: "Approved. Payment accepted", date: true },
    "receipt":       { body: "receipt",                                           announce: "Approved. Cardholder receipt?", date: true }
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
        // Looping animation from "Payment Animation.mp4"; a still frame when reduced motion is on.
        '<picture class="loader" aria-hidden="true">' +
        '  <source srcset="assets/loader-still.webp" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/loader.webp" alt="">' +
        "</picture>";
    } else if (cfg.body === "card") {
      body =
        '<p class="panel__prompt panel__prompt--muted">' + cfg.prompt + "</p>" +
        '<img class="schemes" src="assets/card-schemes@2x.webp" alt="CB, Visa, Mastercard, American Express, Diners Club, Discover, UnionPay, JCB">' +
        // Looping animation from "POS Animation.mp4"; a still frame when reduced motion is on.
        '<picture class="terminal-art" aria-hidden="true">' +
        '  <source srcset="assets/present-card-still.webp" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/present-card.webp" alt="">' +
        "</picture>" +
        '<button class="cta" type="button" data-action="cancel-transaction">cancel transaction</button>' +
        // Clicking anywhere on the screen stands in for tapping the card; this is the keyboard route.
        '<button class="sr-only" type="button" data-action="card-tapped" data-autofocus>Tap card</button>';
    } else if (cfg.body === "approved") {
      body =
        // Plays once from "Payment animation 2.mp4" each time Approved appears (see replayBanner).
        '<picture class="banner">' +
        '  <source srcset="assets/approved-banner-still.webp" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/approved-banner.webp" alt="Approved. Payment accepted" data-replay>' +
        "</picture>" +
        '<img class="cb-logo" src="assets/cb-logo@2x.webp" alt="CB">';
    } else if (cfg.body === "receipt") {
      body =
        '<img class="banner" src="assets/approved-banner-still.webp" alt="Approved. Payment accepted">' +
        '<p class="receipt-title">Cardholder receipt?</p>' +
        '<p class="receipt-label receipt-label--digital">Digital receipt options</p>' +
        // View receipt opens the ticket (Figma wires "Send by email"; changed on request 2026-11-11).
        receiptOption("view", "view receipt", "icon-view.svg", 307, "open-ticket") +
        receiptOption("email", "send by email", "icon-email.svg", 432) +
        receiptOption("qr", "scan qr code", "icon-qr.svg", 557) +
        '<div class="receipt-or" aria-hidden="true"><span></span><span>or</span><span></span></div>' +
        '<p class="receipt-label receipt-label--print">Print your receipt</p>' +
        receiptOption("print", "print", "icon-printer.svg", 823) +
        // Not wired in Figma; ends the sale so the flow has no dead end.
        '<button class="cta cta--dark" type="button" data-action="skip">skip</button>';
    }

    var overlay = cfg.body === "receipt" ? ticketTemplate() : "";

    return (
      '<section class="view view--txn' + (cfg.body === "approved" ? " view--approved" : "") + (cfg.body === "card" ? " view--card" : "") + '" data-view="' + id + '">' +
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
      overlay +
      "</section>"
    );
  }

  // One row of the receipt options list. Only rows with an action respond; the rest are
  // shown as designed but inert (Figma wires nothing to them).
  function receiptOption(key, label, icon, top, action) {
    var inner =
      '<span class="receipt-option__icon"><img src="assets/' + icon + '" alt=""></span>' +
      '<span class="receipt-option__label">' + label + "</span>";
    var style = ' style="top:' + top + 'px"';
    return action
      ? '<button class="receipt-option receipt-option--' + key + '" type="button" data-action="' + action + '" data-autofocus' + style + ">" + inner + "</button>"
      : '<div class="receipt-option receipt-option--' + key + '"' + style + ">" + inner + "</div>";
  }

  // Figma "P3 / [Ticket] Ticket in Screen" (5987:4788): a 60% black overlay with the paper
  // receipt. Lines are live text so AMOUNT shows the amount actually entered.
  // With `details` it is the duplicate printed from Transaction's details (Figma 5991:12779):
  // same ticket, its amount taken from the chosen transaction, not the amount being entered.
  function ticketTemplate(details) {
    var line = function (t) { return '<p class="ticket__line">' + t + "</p>"; };
    var space = '<span class="ticket__space"></span>';
    var big = '<span class="ticket__space ticket__space--big"></span>';
    var amountAttr = details ? "data-detail-amount" : "data-amount-value";
    var copy = details ? '<span data-ticket-copy>customer</span>' : "customer";
    return (
      '<div class="ticket' + (details ? " ticket--details" : "") + '" role="dialog" aria-modal="true" aria-label="Customer receipt" hidden>' +
      '  <div class="statusbar statusbar--muted">' +
      '    <span class="statusbar__time">16:25</span>' +
      '    <img class="statusbar__icons" src="assets/status-icons-muted.svg" alt="">' +
      "  </div>" +
      '  <div class="ticket__paper">' +
      '    <img class="ticket__edge" src="assets/ticket-edge-top.svg" alt="">' +
      '    <div class="ticket__body">' +
      '      <p class="ticket__title">bank card</p>' +
      '      <div class="ticket__icon"><img src="assets/icon-contactless.svg" alt=""></div>' +
      big + line("contactless") + line("A0000000041010") + space +
      line("debit mastercard") + line("18/11/25 - 17:12:50") + space +
      line("payxpert france 69") + line("lyon") + big + big +
      line("0001695") + space + line("16808") + line("54003281000041") + space +
      line("XXXXXXXXXXXX4751") + line("D2429E7B493D9005") + space +
      line("200 001 000018 72 C @") + line("authorization: 777122") + big + big +
      line("ref.<br>amount: <span " + amountAttr + ">0,00</span> eur") + big + big +
      line("sale<br>" + copy + " receipt<br>please keep") +
      "    </div>" +
      '    <img class="ticket__edge" src="assets/ticket-edge-bottom.svg" alt="">' +
      "  </div>" +
      '  <div class="ticket__btn ticket__btn--email" aria-hidden="true"><img src="assets/icon-email.svg" alt=""></div>' +
      '  <div class="ticket__btn ticket__btn--print" aria-hidden="true"><img src="assets/icon-printer.svg" alt=""></div>' +
      '  <button class="ticket__close" type="button" data-action="close-ticket">close</button>' +
      "</div>"
    );
  }

  Object.keys(TXN_SCREENS).forEach(function (id) {
    screen.insertAdjacentHTML("beforeend", txnTemplate(id, TXN_SCREENS[id]));
  });
  screen.querySelectorAll("[data-view]").forEach(function (el) {
    views[el.getAttribute("data-view")] = el;
  });
  views["details"].insertAdjacentHTML("beforeend", ticketTemplate(true));

  /* ------------------------------------------------------------------ *
   * Scale the 720 × 1600 screen to fit the window                       *
   * ------------------------------------------------------------------ */

  var device = document.getElementById("device");
  var fit = document.getElementById("deviceFit");

  function fitDevice() {
    var w = device.offsetWidth;
    var h = device.offsetHeight;
    var margin = 24;
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

  var amountNodes = screen.querySelectorAll("[data-amount-value]");   // every screen's amount + the receipt ticket
  var entryAmount = views["amount-entry"].querySelector("[data-amount]");

  function renderAmount() {
    var text = amountText();
    amountNodes.forEach(function (el) { el.textContent = text; });
  }

  function shakeAmount() {
    if (reducedMotion.matches) return;
    entryAmount.animate(
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
    var prevId = current;
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
    announce(cfg ? cfg.announce : APP_ANNOUNCE[id] || "Enter the amount. " + amountText() + " euros");

    // Keyboard focus would otherwise stay on a control of the screen that just left.
    if (!to.contains(document.activeElement)) {
      var target = to.querySelector("[data-autofocus]");
      if (target) target.focus({ preventScroll: true });
      else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }

    var step = SEQUENCE[id];
    if (step) holdTimer = setTimeout(function () { go(step.next, step.transition); }, step.hold);

    if (id === "approved") { replayBanner(to); recordSale(); }
    if (id !== "receipt") closeTicket(false);
    if (id === "journal" && journalDirty) renderJournal();
    // Coming back from a transaction's details keeps the list still; any other arrival cascades it in.
    if (id === "journal" && prevId !== "details") cascadeJournal(120);
    if (id !== "journal") hideLayer(filtersLayer, 0);
    if (id !== "details") { hideLayer(printLayer, 0); hideLayer(copyTicket, 0); }
  }

  var APP_ANNOUNCE = {
    "journal": "Transaction’s history",
    "details": "Transactions’ details"
  };

  /* Ticket overlay on the Receipt screen. Figma: Smart Animate 300 ms ease-in to open,
     "Back" with no transition to close. */
  function ticketEl() { return views["receipt"].querySelector(".ticket"); }

  function openTicket() {
    var t = ticketEl();
    t.hidden = false;
    if (!reducedMotion.matches) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE_IN });
    t.querySelector("[data-action='close-ticket']").focus({ preventScroll: true });
    announce("Customer receipt");
  }

  function closeTicket(restoreFocus) {
    var t = ticketEl();
    if (t.hidden) return;
    t.hidden = true;
    if (restoreFocus) views["receipt"].querySelector("[data-action='open-ticket']").focus({ preventScroll: true });
  }

  // A GIF that plays once only restarts when it gets a new URL, so each visit to Approved
  // gets a fresh object URL for the same (already downloaded) file.
  var bannerBlob = null;
  if (window.fetch && location.protocol !== "file:") {
    fetch("assets/approved-banner.webp").then(function (r) { return r.blob(); })
      .then(function (b) { bannerBlob = b; }).catch(function () {});
  }
  function replayBanner(view) {
    var img = view.querySelector("img[data-replay]");
    if (!img || reducedMotion.matches) return;
    if (img._url) URL.revokeObjectURL(img._url);
    img._url = bannerBlob ? URL.createObjectURL(bannerBlob) : null;
    img.src = img._url || "assets/approved-banner.webp?" + Date.now();
  }

  function newSale() {
    digits = "";
    renderAmount();
    go("amount-entry", DISSOLVE_300);
  }

  /* ------------------------------------------------------------------ *
   * Transaction History flow                                            *
   * Figma "PayXpress Compose" › Transaction History (section 5991:6705) *
   * ------------------------------------------------------------------ */

  var EASE_IN_300 = { duration: 300, easing: EASE_IN };   // Smart Animate 300 ms ease-in
  var drawer = document.getElementById("drawer");
  var menuEl = drawer.querySelector(".menu");
  var scrim = drawer.querySelector(".drawer__scrim");
  var journalList = views["journal"].querySelector("[data-journal-list]");
  var filtersLayer = views["journal"].querySelector("[data-layer='filters']");
  var filterBadge = views["journal"].querySelector("[data-filter-badge]");
  var filterBtn = views["journal"].querySelector("[data-action='open-filters']");
  var printLayer = views["details"].querySelector("[data-layer='print']");
  var printBtn = views["details"].querySelector("[data-action='open-print']");
  var copyTicket = views["details"].querySelector(".ticket--details");

  // Figma 5991:7759: one day of card payments, 15,00 € each, in this order of outcomes.
  var transactions = "DAAADDADADDDDDDDDDDD".split("").map(function (s, i) {
    return {
      id: "f" + i, day: "17 janvier 2025", time: "14:20", cents: 1500,
      status: s === "A" ? "accepted" : "declined", date: "10/11/2025 at 17:12:04"
    };
  });
  var journalDirty = true;
  var collapsedDays = {};
  var detailTxn = null;

  function pad(n) { return (n < 10 ? "0" : "") + n; }
  function euros(cents) { return fmt.format(cents / 100) + " €"; }
  var dayFmt = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "long", year: "numeric" });

  // A sale approved in the payment flow shows up in the history, under today's date.
  function recordSale() {
    var now = new Date();
    transactions.unshift({
      id: "s" + now.getTime(),
      day: dayFmt.format(now),
      time: pad(now.getHours()) + ":" + pad(now.getMinutes()),
      cents: parseInt(digits || "0", 10),
      status: "accepted",
      date: pad(now.getDate()) + "/" + pad(now.getMonth() + 1) + "/" + now.getFullYear() +
        " at " + pad(now.getHours()) + ":" + pad(now.getMinutes()) + ":" + pad(now.getSeconds())
    });
    journalDirty = true;
  }

  /* ---- Filters: each group holds one value or none ("ALL") ---- */

  var applied = {};
  var draft = {};

  // The sample data is all CB debit card payments on one merchant account, already
  // collected, so only status really splits it; the other groups keep or empty the list.
  function matches(t, f) {
    if (f.type && f.type !== "debit") return false;
    if (f.status && f.status !== t.status) return false;
    if (f.scheme && f.scheme.indexOf("cb") !== 0) return false;
    if (f.collection === "not-collected") return false;
    return true;
  }

  function activeFilterCount() {
    return ["type", "status", "merchant", "scheme", "collection"].filter(function (g) { return applied[g]; }).length;
  }

  function renderBadge() {
    var n = activeFilterCount();
    filterBadge.hidden = n === 0;
    filterBadge.textContent = n;
    filterBtn.setAttribute("aria-label", n ? "Filters, " + n + " active" : "Filters");
  }

  function syncChips() {
    filtersLayer.querySelectorAll(".fchip").forEach(function (chip) {
      var v = chip.getAttribute("data-value");
      chip.setAttribute("aria-pressed", String(!!v && draft[chip.getAttribute("data-group")] === v));
    });
  }

  function pickChip(chip) {
    var g = chip.getAttribute("data-group");
    var v = chip.getAttribute("data-value");
    draft[g] = v && draft[g] !== v ? v : null;   // ALL, or the picked chip again, clears the group
    syncChips();
  }

  /* ---- History list ---- */

  function rowHtml(t) {
    var label = t.status === "accepted" ? "Debit accepted" : "Debit declined";
    return (
      '<button class="txn" type="button" data-action="open-details" data-id="' + t.id + '"' +
      ' aria-label="' + t.time + ", card ending 6666, " + label + ", " + euros(t.cents) + '">' +
      '<span class="txn__time"><span>' + t.time + '</span><img src="assets/icon-history.svg" alt="" width="32" height="32"></span>' +
      '<span class="txn__sep"></span>' +
      '<span class="txn__info">' +
      '<span class="txn__pan">∗∗∗∗ 6666<img src="assets/cb-small.svg" alt="" width="36" height="25"></span>' +
      '<span class="txn__status"><img src="assets/status-' + t.status + '.svg" alt="" width="32" height="32">' + label + "</span>" +
      "</span>" +
      '<span class="txn__amount">' + euros(t.cents) + "</span>" +
      '<img src="assets/icon-next.svg" alt="" width="32" height="32">' +
      "</button>"
    );
  }

  function renderJournal() {
    journalDirty = false;
    var shown = transactions.filter(function (t) { return matches(t, applied); });
    if (!shown.length) {
      journalList.innerHTML = '<p class="journal-empty">No transactions match these filters.</p>';
      return;
    }
    var groups = [];
    var byDay = {};
    shown.forEach(function (t) {
      if (!byDay[t.day]) { byDay[t.day] = { day: t.day, rows: [] }; groups.push(byDay[t.day]); }
      byDay[t.day].rows.push(t);
    });
    journalList.innerHTML = groups.map(function (g) {
      var total = g.rows.reduce(function (sum, t) { return sum + t.cents; }, 0);
      var open = !collapsedDays[g.day];
      return (
        '<div class="day-group">' +
        '<button class="day" type="button" data-action="toggle-day" data-day="' + g.day + '" aria-expanded="' + open + '">' +
        '<span class="day__label" lang="fr">' + g.day + "</span><span>" + euros(total) + "</span>" +
        '<img src="assets/icon-down.svg" alt=""></button>' +
        '<div class="day-rows"' + (open ? "" : " hidden") + ">" + g.rows.map(rowHtml).join("") + "</div>" +
        "</div>"
      );
    }).join("");
  }

  // Day headers and rows slide up and fade in one after another, top to bottom.
  // Only what is on screen animates; rows further down are already in place when scrolled to.
  var CASCADE = { step: 40, duration: 320, rise: 24 };
  function cascadeJournal(startDelay) {
    if (reducedMotion.matches) return;
    var listTop = journalList.getBoundingClientRect().top;
    var listBottom = journalList.getBoundingClientRect().bottom;
    var i = 0;
    journalList.querySelectorAll(".day, .txn, .journal-empty").forEach(function (el) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
      var r = el.getBoundingClientRect();
      if (r.height === 0 || r.top > listBottom || r.bottom < listTop) return;
      el.animate(
        [{ opacity: 0, transform: "translateY(" + CASCADE.rise + "px)" }, { opacity: 1, transform: "none" }],
        { duration: CASCADE.duration, delay: startDelay + i * CASCADE.step, easing: EASE_OUT, fill: "backwards" }
      );
      i++;
    });
  }

  function toggleDay(btn) {
    var day = btn.getAttribute("data-day");
    collapsedDays[day] = !collapsedDays[day];
    btn.setAttribute("aria-expanded", String(!collapsedDays[day]));
    btn.nextElementSibling.hidden = !!collapsedDays[day];
  }

  /* ---- Overlays: fade in/out (Smart Animate between frames reads as a dissolve) ---- */

  // Bottom sheets slide up from the bottom edge while their backdrop fades in, and slide
  // back down to close (prototype motion; Figma dissolves them).
  var SHEET_IN = { duration: 320, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" };
  var SHEET_OUT = { duration: 220, easing: EASE_IN };

  function cancelAll(el) {
    el.getAnimations({ subtree: true }).forEach(function (a) { a.cancel(); });
  }

  function showLayer(el, duration, focusSel) {
    el._token = {};
    cancelAll(el);
    el.hidden = false;
    var sheet = el.querySelector(".bsheet");
    if (duration && !reducedMotion.matches) {
      if (sheet) {
        el.querySelector(".sheet-layer__backdrop").animate([{ opacity: 0 }, { opacity: 1 }], { duration: SHEET_IN.duration, easing: EASE_OUT });
        sheet.animate([{ transform: "translateY(" + sheet.offsetHeight + "px)" }, { transform: "none" }], SHEET_IN);
      } else {
        el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: duration, easing: EASE_IN });
      }
    }
    var f = focusSel && el.querySelector(focusSel);
    if (f) f.focus({ preventScroll: true });
  }

  function hideLayer(el, duration, returnFocus) {
    if (el.hidden) return;
    var token = el._token = {};
    var done = function () {
      if (el._token !== token) return;
      cancelAll(el);
      el.hidden = true;
      if (returnFocus) returnFocus.focus({ preventScroll: true });
    };
    var sheet = el.querySelector(".bsheet");
    if (duration && !reducedMotion.matches && sheet) {
      el.querySelector(".sheet-layer__backdrop").animate([{ opacity: 1 }, { opacity: 0 }], { duration: SHEET_OUT.duration, easing: EASE_IN, fill: "forwards" });
      sheet.animate([{ transform: "none" }, { transform: "translateY(" + sheet.offsetHeight + "px)" }],
        { duration: SHEET_OUT.duration, easing: SHEET_OUT.easing, fill: "forwards" }).finished.then(done);
    } else if (duration && !reducedMotion.matches) {
      el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: duration, easing: EASE_IN, fill: "forwards" }).finished.then(done);
    } else {
      done();
    }
  }

  /* ---- H1 · Side menu ----
     Figma: ☰ dissolves (50 ms) to the dimmed screen, then the menu moves in from the left
     after 0.2 s (200 ms ease-in). Picking an entry shows it selected, and 0.2 s later the
     screen changes (Smart Animate 300 ms ease-in). */

  var menuOpener = null;
  var menuBusy = false;

  function sectionOf(id) { return id === "journal" || id === "details" ? "journal" : "amount-entry"; }

  function markMenu(target) {
    drawer.querySelectorAll("[data-target]").forEach(function (b) {
      var on = b.getAttribute("data-target") === target;
      b.classList.toggle("is-current", on);
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });
  }

  function openMenu(opener) {
    if (!drawer.hidden) return;
    menuOpener = opener;
    menuBusy = false;
    markMenu(sectionOf(current));
    drawer.style.zIndex = String(++z);
    drawer.hidden = false;
    cancelAll(drawer);
    if (!reducedMotion.matches) {
      scrim.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 50, easing: EASE_IN });
      menuEl.animate([{ transform: "translateX(-480px)" }, { transform: "translateX(0)" }],
        { duration: 200, delay: 200, easing: EASE_IN, fill: "backwards" });
    }
    drawer.querySelector("button.menu__item.is-current").focus({ preventScroll: true });
    announce("Menu");
  }

  function closeMenu(restoreFocus) {
    // Once an entry is picked the screen change is committed; don't close underneath it.
    if (drawer.hidden || menuBusy) return;
    var done = function () {
      cancelAll(drawer);
      drawer.hidden = true;
      if (restoreFocus && menuOpener) menuOpener.focus({ preventScroll: true });
    };
    if (reducedMotion.matches) { done(); return; }
    scrim.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: EASE_OUT, fill: "forwards" });
    menuEl.animate([{ transform: "translateX(0)" }, { transform: "translateX(-480px)" }],
      { duration: 200, easing: EASE_OUT, fill: "forwards" }).finished.then(done);
  }

  function menuGo(btn) {
    if (menuBusy) return;
    var target = btn.getAttribute("data-target");
    if (target === sectionOf(current)) { closeMenu(true); return; }
    menuBusy = true;
    markMenu(target);
    setTimeout(function () {
      go(target, EASE_IN_300);
      // The new screen fades in over the menu; then the menu goes away underneath it.
      setTimeout(function () { closeMenuNow(); }, reducedMotion.matches ? 0 : 300);
    }, 200);
  }

  function closeMenuNow() {
    cancelAll(drawer);
    drawer.hidden = true;
    menuBusy = false;
    var heading = views[current] && views[current].querySelector("[data-action='open-menu']");
    if (heading) heading.focus({ preventScroll: true });
  }

  /* ---- H3 · Details ---- */

  function openDetails(id) {
    var t = transactions.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    detailTxn = t;
    var d = views["details"];
    var amount = fmt.format(t.cents / 100);
    d.querySelector("[data-detail='amount']").textContent = amount;
    d.querySelector("[data-detail='date']").textContent = t.date;
    d.querySelector("[data-detail='status']").textContent = t.status === "accepted" ? "Debit accepted" : "Debit declined";
    d.querySelector("[data-detail='status-icon']").src = "assets/status-" + t.status + ".svg";
    copyTicket.querySelector("[data-detail-amount]").textContent = amount;
    go("details", EASE_IN_300);
    d.querySelector("[data-action='back-to-journal']").focus({ preventScroll: true });
  }

  function backToJournal() {
    go("journal", EASE_IN_300);
    var row = detailTxn && journalList.querySelector("[data-id='" + detailTxn.id + "']");
    if (row) row.focus({ preventScroll: true });
  }

  function closeCopy() {   // Figma: Back, no transition
    showLayer(printLayer, 0);
    hideLayer(copyTicket, 0, printLayer.querySelector("[data-copy='" + copyTicket.querySelector("[data-ticket-copy]").textContent + "']"));
  }

  // Returns true when the click belonged to the Transaction History flow.
  function handleHistoryClick(action, el, e) {
    switch (action) {
      case "open-menu": openMenu(el); return true;
      case "close-menu": closeMenu(true); return true;
      case "menu-go": menuGo(el); return true;
      case "toggle-day": toggleDay(el); return true;
      case "open-details": openDetails(el.getAttribute("data-id")); return true;
      case "open-filters":
        draft = Object.assign({}, applied);
        syncChips();
        showLayer(filtersLayer, 300, ".fchip");
        announce("Filters");
        return true;
      case "cancel-filters": hideLayer(filtersLayer, 300, filterBtn); return true;
      case "reset-filters": draft = {}; syncChips(); return true;
      case "apply-filters":
        applied = Object.assign({}, draft);
        renderBadge();
        renderJournal();
        journalList.scrollTop = 0;
        hideLayer(filtersLayer, 300, filterBtn);
        cascadeJournal(150);   // the new results cascade in as the sheet fades away
        announce(journalList.querySelectorAll(".txn").length + " transactions");
        return true;
      case "back-to-journal": backToJournal(); return true;
      case "open-print": showLayer(printLayer, 150, ".print-option"); announce("Editing a duplicate"); return true;
      case "close-print": hideLayer(printLayer, 150, printBtn); return true;
      case "open-copy":
        copyTicket.querySelector("[data-ticket-copy]").textContent = el.getAttribute("data-copy");
        copyTicket.setAttribute("aria-label", el.getAttribute("data-copy") === "merchant" ? "Merchant receipt" : "Customer receipt");
        // Figma 5991:12779 shows the ticket over the details alone; Back returns to the sheet.
        showLayer(copyTicket, 300, ".ticket__close");
        setTimeout(function () { if (!copyTicket.hidden) hideLayer(printLayer, 0); }, reducedMotion.matches ? 0 : 300);
        return true;
      case "close-ticket":
        if (current !== "details") return false;
        closeCopy();
        return true;
    }
    var chip = e.target.closest(".fchip");
    if (chip) { pickChip(chip); return true; }
    return false;
  }

  // The open modal layer, if any: menu, then the overlays of the current screen.
  function openModal() {
    if (!drawer.hidden) return drawer;
    var layers = { details: [copyTicket, printLayer], journal: [filtersLayer], receipt: [ticketEl()] }[current] || [];
    for (var i = 0; i < layers.length; i++) if (!layers[i].hidden) return layers[i];
    return null;
  }

  document.addEventListener("keydown", function (e) {
    var modal = openModal();
    if (!modal) return;

    // Tab stays inside the open menu, sheet or receipt (they are aria-modal).
    if (e.key === "Tab") {
      var items = Array.prototype.filter.call(modal.querySelectorAll("button"), function (b) { return b.offsetParent !== null; });
      if (!items.length) return;
      var first = items[0], last = items[items.length - 1];
      if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) { last.focus(); e.preventDefault(); }
      else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) { first.focus(); e.preventDefault(); }
      return;
    }

    if (e.key !== "Escape") return;
    if (modal === drawer) closeMenu(true);
    else if (modal === copyTicket) closeCopy();
    else if (modal === printLayer) hideLayer(printLayer, 150, printBtn);
    else if (modal === filtersLayer) hideLayer(filtersLayer, 300, filterBtn);
    else closeTicket(true);
  });

  // Mouse drag scrolls the chip rows and the list, as a finger would on the terminal.
  (function dragToScroll() {
    var drag = null;
    var swallowClick = false;
    screen.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      var el = e.target.closest(".hscroll, .journal-list");
      if (!el) return;
      var r = el.getBoundingClientRect();
      drag = {
        el: el, x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop,
        horizontal: el.classList.contains("hscroll"),
        kx: r.width / el.offsetWidth, ky: r.height / el.offsetHeight, moved: false
      };
    });
    window.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - drag.x;
      var dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(drag.horizontal ? dx : dy) < 6) return;
      drag.moved = true;
      document.body.classList.add("is-dragging");
      if (drag.horizontal) drag.el.scrollLeft = drag.left - dx / drag.kx;
      else drag.el.scrollTop = drag.top - dy / drag.ky;
    });
    window.addEventListener("pointerup", function () {
      if (drag && drag.moved) {
        swallowClick = true;
        setTimeout(function () { swallowClick = false; }, 0);
      }
      drag = null;
      document.body.classList.remove("is-dragging");
    });
    screen.addEventListener("click", function (e) {
      if (swallowClick) { e.stopPropagation(); e.preventDefault(); swallowClick = false; }
    }, true);
  })();

  /* ------------------------------------------------------------------ *
   * Input                                                               *
   * ------------------------------------------------------------------ */

  function press(key) {
    if (current !== "amount-entry" || !drawer.hidden) return;

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

    var actionEl = e.target.closest("[data-action]");
    var action = actionEl && actionEl.getAttribute("data-action");

    if (handleHistoryClick(action, actionEl, e)) return;

    if (current === "present-card") {
      if (action === "cancel-transaction") { newSale(); return; }   // brief D2: cancel resets the sale
      // Any other click on Present Card = the customer taps their card.
      if (e.target.closest(".view--card")) go("card-read", CARD_TAPPED);
      return;
    }

    if (current === "receipt") {
      if (action === "open-ticket") openTicket();
      else if (action === "close-ticket") closeTicket(true);
      else if (action === "skip") newSale();
    }
  });

  /* ------------------------------------------------------------------ *
   * Start                                                               *
   * ------------------------------------------------------------------ */

  renderAmount();
  renderBadge();
  go("amount-entry", INSTANT);

  // Debug hook for review tooling: window.__terminal.go('approved')
  window.__terminal = {
    go: function (id) { clearTimeout(holdTimer); go(id, INSTANT); clearTimeout(holdTimer); },
    setAmount: function (d) { digits = String(d); renderAmount(); },
    state: function () { return current; }
  };
})();
