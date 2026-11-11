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
    "approved":      { hold: 2000, next: "receipt",       transition: DISSOLVE_300 },
    "approved-old":  { hold: 2000, next: "receipt",       transition: DISSOLVE_300 }
  };

  // The stage menu's Interface switch sets <html data-ui="old">; then the end of the payment
  // shows the old software's screens instead of the new ones.
  var OLD_UI_SCREENS = { "approved": "approved-old", "receipt": "receipt-old" };
  function resolveScreen(id) {
    return document.documentElement.getAttribute("data-ui") === "old" && OLD_UI_SCREENS[id] || id;
  }
  var OLD_ANNOUNCE = {
    "approved-old": "Débit, CB. Paiement sans contact accepté",
    "receipt-old": "Paiement accepté. Ticket commerçant ?"
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
  // `copy` ("customer" by default) picks which receipt it is; the Old UI shows the merchant's.
  function ticketTemplate(details, copy) {
    var line = function (t) { return '<p class="ticket__line">' + t + "</p>"; };
    var space = '<span class="ticket__space"></span>';
    var big = '<span class="ticket__space ticket__space--big"></span>';
    var amountAttr = details ? "data-detail-amount" : "data-amount-value";
    var label = copy === "merchant" ? "Merchant receipt" : "Customer receipt";
    copy = details ? '<span data-ticket-copy>customer</span>' : copy || "customer";
    return (
      '<div class="ticket' + (details ? " ticket--details" : "") + '" role="dialog" aria-modal="true" aria-label="' + label + '" hidden>' +
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

  /* ---- Old UI: the previous software's two end-of-payment screens ----
     Chosen in the stage menu (Interface › Old). Everything up to Authorization is shared;
     "approved" and "receipt" are swapped for these. Built from screenshots of the old
     software (no Figma frames), so positions are measured off the images. */
  function oldHeader() {
    return (
      '<div class="statusbar old-statusbar">' +
      '  <span class="statusbar__time">16:25</span>' +
      '  <img class="statusbar__icons" src="assets/status-icons.svg" alt="">' +
      "</div>" +
      '<div class="old-title">Transaction terminée</div>' +
      '<div class="old-band"></div>'
    );
  }
  function oldAmount(cls) {
    return '<p class="old-amount ' + cls + '" data-amount><span data-amount-value>0,00</span> €</p>';
  }
  screen.insertAdjacentHTML("beforeend",
    '<section class="view view--old" data-view="approved-old" lang="fr">' +
      oldHeader() +
      '<p class="old-scheme-label old-debit--top">Débit</p>' +
      '<p class="old-cb">CB</p>' +
      oldAmount("old-amount--approved") +
      '<p class="old-message">Paiement sans contact<br>accepte</p>' +
    "</section>" +
    '<section class="view view--old" data-view="receipt-old" lang="fr">' +
      oldHeader() +
      '<div class="old-card">' +
      '  <p class="old-card__head">Paiement accepte</p>' +
      '  <p class="old-card__date" data-old-date>Le 05/08/26 a 12:13:44</p>' +
      '  <img class="old-card__cb" src="assets/cb-logo@2x.webp" alt="CB">' +
      '  <p class="old-scheme-label old-card__debit">Débit</p>' +
         oldAmount("old-amount--card") +
      '  <svg class="old-card__check" viewBox="0 0 50 50" aria-hidden="true"><circle cx="25" cy="25" r="25"/><path d="M14 25.5l7.5 7.5L36.5 18"/></svg>' +
      "</div>" +
      '<p class="old-question">Ticket commerçant ?</p>' +
      '<button class="old-btn old-btn--view" type="button" data-action="open-ticket" data-autofocus aria-label="Voir le ticket"><img src="assets/icon-view.svg" alt=""></button>' +
      '<div class="old-btn old-btn--email" aria-hidden="true"><img src="assets/icon-email.svg" alt=""></div>' +
      '<div class="old-btn old-btn--print" aria-hidden="true"><img src="assets/icon-printer.svg" alt=""></div>' +
      '<button class="old-btn old-btn--close" type="button" data-action="skip">Fermer</button>' +
      ticketTemplate(false, "merchant") +
    "</section>"
  );
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
    id = resolveScreen(id);
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
    announce(cfg ? cfg.announce : APP_ANNOUNCE[id] || OLD_ANNOUNCE[id] || "Enter the amount. " + amountText() + " euros");

    // Keyboard focus would otherwise stay on a control of the screen that just left.
    if (!to.contains(document.activeElement)) {
      var target = to.querySelector("[data-autofocus]");
      if (target) target.focus({ preventScroll: true });
      else if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    }

    var step = SEQUENCE[id];
    if (step) holdTimer = setTimeout(function () { go(step.next, step.transition); }, step.hold);

    if (id === "approved") { replayBanner(to); recordSale(); }
    if (id === "approved-old") { recordSale(); stampOldDate(); }
    if (id !== "receipt" && id !== "receipt-old") closeTicket(false);
    if (id === "journal" && journalDirty) renderJournal();
    // Coming back from a transaction's details keeps the list still; any other arrival cascades it in.
    if (id === "journal" && prevId !== "details") cascadeJournal(120);
    if (id !== "journal") hideLayer(filtersLayer, 0);
    if (id !== "details") { hideLayer(printLayer, 0); hideLayer(copyTicket, 0); }
    // Daily summary always opens on the last business day that has ended, on Operations.
    if (id === "summary") { dsDay = lastCompleteDay(new Date()); selectTab("ops", false, false); renderSummary(); cascadeRows(activePanel(), 120); }
    if (id === "settings" && prevId !== "summary-settings") cascadeRows(views["settings"], 120, ".set-row");
    if (id === "summary-settings") renderHours();
    else hideLayer(timeLayer, 0);
    if (id === "collections") enterCollections();
    else leaveCollections();
  }

  var APP_ANNOUNCE = {
    "journal": "Transaction’s history",
    "details": "Transactions’ details",
    "summary": "Daily summary",
    "settings": "Settings",
    "summary-settings": "Daily summary settings",
    "collections": "File collection’s history"
  };

  /* Ticket overlay on the Receipt screen. Figma: Smart Animate 300 ms ease-in to open,
     "Back" with no transition to close. */
  // The receipt screen on show: the new one, or the Old UI's.
  function receiptView() { return views[current === "receipt-old" ? "receipt-old" : "receipt"]; }
  function ticketEl() { return receiptView().querySelector(".ticket"); }

  function openTicket() {
    var t = ticketEl();
    t.hidden = false;
    if (!reducedMotion.matches) t.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, easing: EASE_IN });
    t.querySelector("[data-action='close-ticket']").focus({ preventScroll: true });
    announce(t.getAttribute("aria-label"));
  }

  function closeTicket(restoreFocus) {
    ["receipt", "receipt-old"].forEach(function (id) {
      var t = views[id].querySelector(".ticket");
      if (t.hidden) return;
      t.hidden = true;
      if (restoreFocus) views[id].querySelector("[data-action='open-ticket']").focus({ preventScroll: true });
    });
  }

  // The Old UI's receipt card shows when the sale was approved: "Le 11/11/26 a 14:05:09".
  function stampOldDate() {
    var d = new Date();
    var p = function (n) { return (n < 10 ? "0" : "") + n; };
    views["receipt-old"].querySelector("[data-old-date]").textContent =
      "Le " + p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + String(d.getFullYear()).slice(2) +
      " a " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
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
    // …and counts in the daily summary of the business day it falls in.
    summaryTxns.push({ ts: now, kind: "debit", cents: parseInt(digits || "0", 10), tip: 0, scheme: "cb", mode: "quick", status: "accepted" });   // keyed in on the terminal
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

  // The menu entry a screen belongs to.
  var SECTIONS = { details: "journal", journal: "journal", summary: "summary", settings: "settings", "summary-settings": "settings", collections: "collections" };
  function sectionOf(id) { return SECTIONS[id] || "amount-entry"; }

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

  /* ------------------------------------------------------------------ *
   * Daily summary (menu › Daily summary) and its business-day hours     *
   * (menu › Settings › Daily summary). No Figma frames: built from the  *
   * PayXpress manual's "Total journalier" screens.                      *
   * ------------------------------------------------------------------ */

  var dsView = views["summary"];
  var dsSetView = views["summary-settings"];
  var timeLayer = dsSetView.querySelector("[data-layer='time']");
  var customSwitch = dsSetView.querySelector("[data-ds-custom]");
  var timesBox = dsSetView.querySelector("[data-ds-times]");

  // Business-day hours in minutes after midnight. With the option off a business day is
  // the calendar day, 00:00–23:59. The custom hours are kept while it is off.
  var DEFAULT_HOURS = { start: 0, end: 23 * 60 + 59 };
  var dayHours = { custom: false, start: 17 * 60, end: 2 * 60 + 30 };

  function hoursInUse() { return dayHours.custom ? dayHours : DEFAULT_HOURS; }
  function overnight(h) { return h.end <= h.start; }
  function hhmm(min) { return pad(Math.floor(min / 60)) + ":" + pad(min % 60); }
  function midnight(d) { var m = new Date(d); m.setHours(0, 0, 0, 0); return m; }
  function addDays(d, n) { var m = new Date(d); m.setDate(m.getDate() + n); return m; }
  function at(day, min) { var m = new Date(day); m.setHours(0, min, 0, 0); return m; }

  // The business day that opens on `day`, as [start, end). The end minute counts in full:
  // 00:00–23:59 is the whole day, 17:00–02:30 runs to 02:30:59 the next morning.
  function windowFor(day) {
    var h = hoursInUse();
    var end = h.end === h.start
      ? at(addDays(day, 1), h.start)                                // same time: a full 24 h
      : at(addDays(day, overnight(h) ? 1 : 0), h.end + 1);
    return { start: at(day, h.start), end: end };
  }

  // The last business day that has ended (what the summary opens on, as in the manual).
  function lastCompleteDay(now) {
    var day = midnight(now);
    while (windowFor(day).end > now) day = addDays(day, -1);
    return day;
  }

  // Sample activity for the last five days, spread over day and night so that changing the
  // business-day hours visibly changes what is counted. Times past 24:00 are the next morning.
  // Mode: "ecr" = started from the cash machine, "quick" = keyed in on the terminal alone.
  // [time, kind, cents, tip cents, scheme, mode, status]
  var DAY_PATTERN = [
    ["08:45", "debit", 1250, 0, "cb", "ecr"],
    ["10:05", "debit", 1900, 0, "conecs", "ecr"],
    ["11:20", "debit", 800, 100, "cb", "ecr"],
    ["12:05", "debit", 2340, 0, "mastercard", "ecr"],
    ["12:40", "debit", 950, 0, "conecs", "quick"],
    ["13:10", "credit", 100, 0, "conecs", "ecr"],
    ["14:30", "debit", 1500, 0, "cb", "ecr", "declined"],
    ["15:25", "debit", 4200, 0, "visa", "ecr"],
    ["17:40", "debit", 1800, 200, "cb", "quick"],
    ["18:30", "debit", 3000, 0, "qr-cb", "ecr"],
    ["19:15", "debit", 3200, 0, "cb", "ecr"],
    ["20:10", "debit", 2000, 150, "qr-cb", "quick"],
    ["21:50", "debit", 1450, 150, "mastercard", "ecr"],
    ["22:35", "cancellation", 1450, 0, "mastercard", "ecr"],
    ["24:40", "debit", 2200, 0, "cb", "ecr"],
    ["25:55", "debit", 900, 100, "cb", "quick"],
    ["27:10", "credit", 500, 0, "cb", "ecr"]
  ];
  var summaryTxns = [];
  (function seedSummary() {
    var now = new Date();
    var today = midnight(now);
    for (var d = -5; d <= 0; d++) {
      DAY_PATTERN.forEach(function (p, i) {
        var hm = p[0].split(":");
        var ts = at(addDays(today, d), Number(hm[0]) * 60 + Number(hm[1]));
        if (ts > now) return;
        var nudge = p[1] === "debit" ? ((d + 5) * 3 + i) % 5 * 50 : 0;   // so each day's totals differ
        summaryTxns.push({ ts: ts, kind: p[1], cents: p[2] + nudge, tip: p[3], scheme: p[4], mode: p[5], status: p[6] || "accepted" });
      });
    }
  })();

  // Accepted operations in a business day: by type, by mode and by scheme. Declined ones don't
  // count. Every figure on both tabs comes from here, so the totals always agree.
  function totalsFor(w) {
    function bucket() { return { n: 0, base: 0, tipN: 0, tips: 0 }; }
    var t = { debitN: 0, base: 0, tipN: 0, tips: 0, cancelN: 0, cancel: 0, creditN: 0, credit: 0,
      modes: { ecr: bucket(), quick: bucket() }, schemes: {} };
    summaryTxns.forEach(function (x) {
      if (x.status !== "accepted" || x.ts < w.start || x.ts >= w.end) return;
      var s = t.schemes[x.scheme] || (t.schemes[x.scheme] = { n: 0, debits: 0, cancel: 0, credit: 0 });
      s.n++;
      if (x.kind === "debit") {
        var m = t.modes[x.mode === "quick" ? "quick" : "ecr"];
        t.debitN++; t.base += x.cents; s.debits += x.cents + x.tip;
        m.n++; m.base += x.cents;
        if (x.tip) { t.tipN++; t.tips += x.tip; m.tipN++; m.tips += x.tip; }
      } else if (x.kind === "cancellation") {
        t.cancelN++; t.cancel += x.cents; s.cancel += x.cents;
      } else {
        t.creditN++; t.credit += x.cents; s.credit += x.cents;
      }
    });
    t.debits = t.base + t.tips;
    t.total = t.debits - t.cancel - t.credit;
    return t;
  }

  // Payment methods, grouped as in Figma 1850:5027. Logos are drawn at the size they have there.
  var METHOD_GROUPS = [
    { id: "cards", name: "Cards", schemes: [
      { id: "cb", name: "CB", logo: "assets/cb-small.svg", w: 44, h: 30 },
      { id: "mastercard", name: "Mastercard", logo: "assets/scheme-mastercard.svg", w: 44, h: 31 },
      { id: "visa", name: "Visa", logo: "assets/scheme-visa.svg", w: 63, h: 31 }
    ] },
    { id: "conecs", name: "Conecs TR", schemes: [
      { id: "conecs", name: "Conecs", logo: "assets/scheme-conecs.svg", w: 44, h: 19 }
    ] },
    { id: "qr", name: "QR codes", schemes: [
      { id: "qr-cb", name: "CB", logo: "assets/cb-small.svg", w: 44, h: 30 }
    ] }
  ];
  var collapsedGroups = {};

  // Upcoming features, switched from the stage menu (☰, top-left of the page) and remembered per browser.
  var FLAGS_KEY = "payment-terminal:feature-flags";
  var flags = { "ecr-modes": false };
  try { var savedFlags = JSON.parse(localStorage.getItem(FLAGS_KEY) || "{}"); if (savedFlags && savedFlags["ecr-modes"] === true) flags["ecr-modes"] = true; } catch (e) { /* storage blocked */ }

  // "10 Nov 2026 17:00" (Figma: "16 jan 2025 16:00")
  var periodFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });
  function stamp(d) { return periodFmt.format(d) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function minus(cents) { return cents ? "-" + euros(cents) : euros(0); }     // never "-0,00 €"
  function cell(cents, neg) { return cents ? (neg ? "-" : "") + euros(cents) : "-"; }  // empty grid cells read "-"
  function signed(cents) { return cents < 0 ? "-" + euros(-cents) : euros(cents); }
  function tr(cls, label, amount) { return '<tr class="' + cls + '"><td>' + label + "</td><td>" + amount + "</td></tr>"; }
  function table(heading, body, total) {
    return '<table class="ds-table"><thead><tr><th scope="col">' + heading + '</th><th scope="col">Amount</th></tr></thead>' +
      body + "<tfoot>" + tr("", "Total", total) + "</tfoot></table>";
  }

  var dsDay = null;   // midnight of the day the business day on show opens on

  // Accepted debits, split by mode when "ECR & Quick mode" is on (Figma 2563:15083).
  function debitRows(t) {
    var head = tr("ds-main", "Accepted debits (" + t.debitN + ")", euros(t.debits));
    if (!flags["ecr-modes"]) {
      return head +
        tr("ds-sub", "Debits (" + t.debitN + ")", euros(t.base)) +
        tr("ds-sub", "Tips (" + t.tipN + ")", euros(t.tips));
    }
    function mode(label, m) {
      return tr("ds-sub", label + " (" + m.n + ")", euros(m.base + m.tips)) +
        tr("ds-sub ds-sub--2", "Debits", euros(m.base)) +
        tr("ds-sub ds-sub--2", "Tips (" + m.tipN + ")", euros(m.tips));
    }
    return head + mode("ECR mode*", t.modes.ecr) + mode("Quick mode**", t.modes.quick);
  }

  function infoBlock(t) {
    var n = t.modes.quick.n;
    var html = '<div class="ds-info"><h2 class="ds-info__head">More info</h2><div class="ds-info__body">' +
      "<p>* Payments made with the cash machine connected<br>** Payments made on the terminal, without the cash machine</p>";
    if (n) {
      html += "<p>" + n + (n === 1 ? " transaction was" : " transactions were") + " made without the cash machine.</p>" +
        "<p>Add " + (n === 1 ? "it" : "them") + " to the cash machine by hand, otherwise its total won’t match the one on the terminal.</p>";
    }
    return html + "</div></div>";
  }

  function methodGroup(g, t) {
    var rows = [], sum = { n: 0, debits: 0, cancel: 0, credit: 0 };
    g.schemes.forEach(function (s) {
      var v = t.schemes[s.id];
      if (!v || !v.n) return;
      sum.n += v.n; sum.debits += v.debits; sum.cancel += v.cancel; sum.credit += v.credit;
      rows.push('<tr><th scope="row"><span class="ds-type"><img src="' + s.logo + '" alt="' + s.name + '" width="' + s.w + '" height="' + s.h + '">(' + v.n + ")</span></th>" +
        "<td>" + cell(v.debits) + "</td><td>" + cell(v.cancel, true) + "</td><td>" + cell(v.credit, true) + "</td></tr>");
    });
    if (!rows.length) return "";
    var open = !collapsedGroups[g.id];
    return '<section class="ds-group">' +
      '<button class="ds-group__head" type="button" data-action="toggle-ds-group" data-group="' + g.id + '" aria-expanded="' + open + '" aria-controls="dsGrid-' + g.id + '">' +
        '<span class="ds-group__name">' + g.name + " (" + sum.n + ")</span><span>" + signed(sum.debits - sum.cancel - sum.credit) + "</span>" +
        '<img src="assets/icon-down.svg" alt=""></button>' +
      '<table class="ds-grid" id="dsGrid-' + g.id + '"' + (open ? "" : " hidden") + ">" +
        '<thead><tr><th scope="col">Type</th><th scope="col">Debits</th><th scope="col">Cancellations</th><th scope="col">Credits</th></tr></thead>' +
        "<tbody>" + rows.join("") + "</tbody>" +
        '<tfoot><tr><th scope="row">Total</th><td>' + cell(sum.debits) + "</td><td>" + cell(sum.cancel, true) + "</td><td>" + cell(sum.credit, true) + "</td></tr></tfoot>" +
      "</table></section>";
  }

  function renderSummary() {
    var w = windowFor(dsDay);
    var t = totalsFor(w);
    dsView.querySelector("[data-ds-period]").textContent = stamp(w.start) + " → " + stamp(new Date(w.end - 60000));
    dsView.querySelector("[data-ds-total]").textContent = signed(t.total);

    dsView.querySelector("[data-ds-panel='ops']").innerHTML = table("Type (transaction volume)",
      "<tbody>" + debitRows(t) + "</tbody>" +
      "<tbody>" + tr("ds-main", "Accepted cancellations (" + t.cancelN + ")", minus(t.cancel)) + "</tbody>" +
      "<tbody>" + tr("ds-main", "Accepted refunds (" + t.creditN + ")", minus(t.credit)) + "</tbody>",
      signed(t.total)) + (flags["ecr-modes"] ? infoBlock(t) : "");

    dsView.querySelector("[data-ds-panel='methods']").innerHTML =
      '<div class="ds-groups">' + METHOD_GROUPS.map(function (g) { return methodGroup(g, t); }).join("") + "</div>";
  }

  function toggleDsGroup(btn) {
    var id = btn.getAttribute("data-group");
    collapsedGroups[id] = !collapsedGroups[id];
    btn.setAttribute("aria-expanded", String(!collapsedGroups[id]));
    btn.nextElementSibling.hidden = !!collapsedGroups[id];
  }

  // Stage menu › Upcoming features. Re-renders the summary in place if it is on screen.
  document.querySelectorAll("[data-flag]").forEach(function (input) {
    var key = input.getAttribute("data-flag");
    input.checked = !!flags[key];
    input.addEventListener("change", function () {
      flags[key] = input.checked;
      try { localStorage.setItem(FLAGS_KEY, JSON.stringify(flags)); } catch (e) { /* not remembered */ }
      if (dsDay) renderSummary();
    });
  });

  function activePanel() { return dsView.querySelector("[data-ds-panel]:not([hidden])"); }

  // Rows rise and fade in one after another, as in the history list.
  function cascadeRows(container, startDelay, selector) {
    if (reducedMotion.matches) return;
    container.querySelectorAll(selector || ".ds-table tbody tr, .ds-table tfoot tr, .ds-info, .ds-group__head, .ds-grid tr").forEach(function (el, i) {
      el.getAnimations().forEach(function (a) { a.cancel(); });
      el.animate(
        [{ opacity: 0, transform: "translateY(" + CASCADE.rise + "px)" }, { opacity: 1, transform: "none" }],
        { duration: CASCADE.duration, delay: startDelay + i * CASCADE.step, easing: EASE_OUT, fill: "backwards" }
      );
    });
  }

  function selectTab(tab, focus, animate) {
    dsView.querySelectorAll(".ds-tab").forEach(function (b) {
      var on = b.getAttribute("data-tab") === tab;
      b.setAttribute("aria-selected", String(on));
      b.tabIndex = on ? 0 : -1;
      if (on && focus) b.focus({ preventScroll: true });
    });
    dsView.querySelectorAll("[data-ds-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-ds-panel") !== tab;
    });
    if (animate) cascadeRows(activePanel(), 0);
  }

  // Tabs follow the ARIA pattern: arrow keys move between them.
  dsView.querySelector(".ds-tabs").addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight" && e.key !== "Home" && e.key !== "End") return;
    e.preventDefault();
    var selected = dsView.querySelector(".ds-tab[aria-selected='true']").getAttribute("data-tab");
    var tab = e.key === "Home" ? "ops" : e.key === "End" ? "methods" : selected === "ops" ? "methods" : "ops";
    if (tab !== selected) selectTab(tab, true, true);
  });

  /* ---- Settings › Daily summary ---- */

  function renderHours() {
    customSwitch.checked = dayHours.custom;
    timesBox.hidden = !dayHours.custom;
    dsSetView.querySelector("[data-time-value='start']").textContent = hhmm(dayHours.start);
    dsSetView.querySelector("[data-time-value='end']").textContent = hhmm(dayHours.end) + (overnight(dayHours) ? " (next day)" : "");
  }

  customSwitch.addEventListener("change", function () {
    dayHours.custom = customSwitch.checked;
    renderHours();
    if (dayHours.custom && !reducedMotion.matches) {
      timesBox.animate([{ opacity: 0, transform: "translateY(-16px)" }, { opacity: 1, transform: "none" }], { duration: 240, easing: EASE_OUT });
    }
    announce(dayHours.custom
      ? "Custom hours on. " + hhmm(dayHours.start) + " to " + hhmm(dayHours.end)
      : "Custom hours off. 00:00 to 23:59");
  });

  /* ---- Time dialog ----
     As on the terminal: the hour field opens focused; typing replaces its value, and two
     digits (or a first digit above 2) move on to the minute. Arrow keys and the mouse
     wheel also step a field; Enter confirms, Esc or a tap on the dimmed screen cancels. */

  var timeDraft = null;   // { which: "start" | "end", h, m }
  var timeOpener = null;
  var timeFields = { h: timeLayer.querySelector("[data-unit='h']"), m: timeLayer.querySelector("[data-unit='m']") };
  var TIME_MAX = { h: 23, m: 59 };

  function openTime(btn) {
    var which = btn.getAttribute("data-which");
    timeOpener = btn;
    timeDraft = { which: which, h: Math.floor(dayHours[which] / 60), m: dayHours[which] % 60 };
    var title = which === "start" ? "Start time" : "End time";
    timeLayer.querySelector("[data-time-title]").textContent = title;
    renderField("h");
    renderField("m");
    markField("h");
    showLayer(timeLayer, 150, "[data-autofocus-time]");
    announce(title + ", " + hhmm(dayHours[which]));
  }

  // The field being edited: outlined, and the next digit typed replaces its value.
  function markField(unit) {
    timeFields.h.classList.toggle("is-active", unit === "h");
    timeFields.m.classList.toggle("is-active", unit === "m");
    timeFields[unit]._fresh = true;
  }

  function renderField(unit) {
    timeFields[unit].value = pad(timeDraft[unit]);
    timeFields[unit].setAttribute("aria-valuenow", String(timeDraft[unit]));
  }

  // Takes what was typed into a field (an empty field keeps its last value).
  function commitField(unit) {
    var v = parseInt(timeFields[unit].value, 10);
    if (!isNaN(v)) timeDraft[unit] = Math.min(v, TIME_MAX[unit]);
    renderField(unit);
  }

  function stepTime(unit, dir) {
    commitField(unit);
    timeDraft[unit] = (timeDraft[unit] + dir + TIME_MAX[unit] + 1) % (TIME_MAX[unit] + 1);
    renderField(unit);
    timeFields[unit]._fresh = true;
  }

  function closeTime(apply) {
    if (timeLayer.hidden) return;
    if (apply) {
      commitField("h");
      commitField("m");
      dayHours[timeDraft.which] = timeDraft.h * 60 + timeDraft.m;
      renderHours();
      announce((timeDraft.which === "start" ? "Start time " : "End time ") + hhmm(dayHours[timeDraft.which]));
    }
    hideLayer(timeLayer, 150, timeOpener);
  }

  Object.keys(timeFields).forEach(function (unit) {
    var f = timeFields[unit];
    // Caret at the start, as on the terminal; the next digit typed replaces the value.
    f.addEventListener("focus", function () {
      markField(unit);
      requestAnimationFrame(function () { if (document.activeElement === f) f.setSelectionRange(0, 0); });
    });
    f.addEventListener("blur", function () { if (!timeLayer.hidden) commitField(unit); });
    f.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); closeTime(true); return; }
      var dir = { ArrowUp: 1, PageUp: 1, ArrowDown: -1, PageDown: -1 }[e.key];
      if (dir) { e.preventDefault(); stepTime(unit, dir); return; }
      if (!/^[0-9]$/.test(e.key) || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      var typed = (f._fresh || f.value.length >= 2 ? "" : f.value) + e.key;
      f._fresh = false;
      f.value = typed;
      f.setSelectionRange(typed.length, typed.length);
      if (unit === "h" && (typed.length === 2 || Number(typed) > 2)) { commitField("h"); markField("m"); timeFields.m.focus(); }
      else if (unit === "m" && typed.length === 2) commitField("m");
    });
    // Anything else that reaches the field (paste, an on-screen keyboard) is kept to two digits.
    f.addEventListener("input", function () {
      var clean = f.value.replace(/\D/g, "").slice(0, 2);
      if (clean !== f.value) f.value = clean;
      f._fresh = false;
    });
  });

  var wheelAcc = 0;
  timeLayer.addEventListener("wheel", function (e) {
    var f = e.target.closest(".tdialog__field");
    if (!f) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    while (Math.abs(wheelAcc) >= 80) {
      var dir = wheelAcc < 0 ? 1 : -1;
      stepTime(f.getAttribute("data-unit"), dir);
      wheelAcc += dir * 80;
    }
  }, { passive: false });

  // Returns true when the click belonged to the Daily summary screens.
  function handleSummaryClick(action, el) {
    switch (action) {
      case "toggle-ds-group": toggleDsGroup(el); return true;
      case "summary-tab":
        if (el.getAttribute("aria-selected") !== "true") selectTab(el.getAttribute("data-tab"), false, true);
        return true;
      case "open-summary-settings":
        go("summary-settings", EASE_IN_300);
        dsSetView.querySelector("[data-action='back-to-settings']").focus({ preventScroll: true });
        return true;
      case "back-to-settings":
        go("settings", EASE_IN_300);
        views["settings"].querySelector("[data-action='open-summary-settings']").focus({ preventScroll: true });
        return true;
      case "edit-time": openTime(el); return true;
      case "cancel-time": closeTime(false); return true;
      case "confirm-time": closeTime(true); return true;
    }
    return false;
  }

  /* ------------------------------------------------------------------ *
   * File collection's history (menu › File collection's history)        *
   * Figma "PayXpress Compose" › File Collection (section 5991:7592).    *
   * ------------------------------------------------------------------ */

  var collView = views["collections"];
  var collList = collView.querySelector("[data-coll-list]");
  var collDays = collView.querySelector("[data-coll-days]");
  var collSkeleton = collView.querySelector("[data-coll-skeleton]");
  var collUpload = collView.querySelector("[data-coll-upload]");
  var collBarSpinner = collView.querySelector(".coll-spinner--bar");
  var sendLayer = collView.querySelector("[data-layer='send']");
  var cticket = collView.querySelector("[data-layer='cticket']");
  var cticketBody = cticket.querySelector("[data-cticket-body]");
  var mailLayer = collView.querySelector("[data-layer='mail']");
  var mailDialog = mailLayer.querySelector(".cdialog");
  var mailInput = mailLayer.querySelector("[data-mail-input]");

  // Prototype timings (Figma "After delay" on each frame)
  var COLL_T = {
    open: 2500,      // Frame 6: placeholders, then the list
    sending: 2500,   // Frame 8: spinner in the app bar
    reload: 1500,    // Frame 52: placeholders again, then the list with today's reports
    dim: 200,        // Frames 53 / 54: the dim, then the dialog or ticket
    typing: 800,     // Frame 44: the address types itself in
    mailSend: 1500   // Frame 46: "sending in progress", then "sent"
  };

  // Reports as in the Figma frames (11, 49, 9). "today" is 02/09/2026, the prototype's date.
  function report(title, status, contract, ref, debits, credits, cancels, refused, ticket) {
    return { title: title, status: status, contract: contract, ref: ref, debits: debits, credits: credits, cancels: cancels, refused: refused, ticket: ticket };
  }
  var COLL_DAYS = [
    { day: "01/09/2026", reports: [
      report("Contact v4", "issued", "3445567", "File collection n° 56 - 01/09/2026 at 21:03:32", [5, "900,38"], [2, "20,23"], [0, "0,00"], 1,
        { app: "CB CONTACT", date: "01/09/2026", time: "21:03:32", no: "#56", file: "#000004" }),
      report("Restaurant ticket - acct", "failed", "3190564", "File collection created - 01/09/2026 at 21:03:12", [7, "346,46"], [1, "5,04"], [0, "0,00"], 0,
        { app: "RESTAURANT TICKET", date: "01/09/2026", time: "21:03:12", no: "created", file: "#000002" }),
      report("Contactless v4", "issued", "3127683", "File collection n° 45 - 01/09/2026 at 21:03:01", [12, "783,97"], [0, "0,00"], [1, "9,99"], 2,
        { app: "CB CONTACT", date: "01/09/2026", time: "21:03:01", no: "#45", file: "#000003" })
    ] },
    { day: "31/08/2026", reports: [
      report("Contact v4", "issued", "3445567", "File collection n° 125 - 31/08/2026 at 21:07:29", [5, "30,00"], [2, "4,00"], [0, "0,00"], 1,
        { app: "CB CONTACT", date: "31/08/2026", time: "21:07:29", no: "#125", file: "#000001" }),
      report("Contactless v4", "issued", "3127683", "File collection n° 43 - 31/08/2026 at 10:23:02", [5, "548,25"], [0, "0,00"], [0, "0,00"], 3,
        { app: "CB CONTACTLESS", date: "31/08/2026", time: "10:23:02", no: "#43", file: "#000002" })
    ] },
    { day: "30/08/2026", reports: [
      report("Contactless v4", "issued", "7435567", "File collection n° 102 - 30/08/2026 at 20:59:01", [5, "1431,97"], [0, "0,00"], [0, "0,00"], 0,
        { app: "CB CONTACTLESS", date: "30/08/2026", time: "20:59:01", no: "#102", file: "#000001" })
    ] }
  ];
  // What "send" adds (Frame 9)
  var COLL_SENT = { day: "02/09/2026", reports: [
    report("VISA", "issued", "7435567", "File collection n° 61 - 02/09/2026 at 16:25:57", [5, "900,38"], [2, "20,23"], [0, "0,00"], 1,
      { app: "VISA", date: "02/09/2026", time: "16:25:57", no: "#61", file: "#000006" }),
    report("Contactless v4", "issued", "3127683", "File collection n° 54 - 02/09/2026 at 16:25:28", [12, "783,97"], [0, "0,00"], [1, "9,99"], 2,
      { app: "CB CONTACTLESS", date: "02/09/2026", time: "16:25:28", no: "#54", file: "#000005" })
  ] };
  var collSent = false;
  var collTimers = [];
  var collOpener = null;   // the @ / print button that opened the ticket
  var collReport = null;
  var collCollapsed = {};

  // Screen timers (loading, sending) and email-dialog timers are kept apart, so closing
  // the email dialog never cancels a send that is still running.
  var mailTimers = [];
  function collLater(fn, ms, list) { (list || collTimers).push(setTimeout(fn, reducedMotion.matches ? Math.min(ms, 600) : ms)); }
  function mailLater(fn, ms) { collLater(fn, ms, mailTimers); }
  function clearMailTimers() { mailTimers.forEach(clearTimeout); mailTimers = []; }
  function collClearTimers() { collTimers.forEach(clearTimeout); collTimers = []; clearMailTimers(); }

  function collAllDays() { return collSent ? [COLL_SENT].concat(COLL_DAYS) : COLL_DAYS; }

  function reportHtml(r, id) {
    return (
      '<article class="coll-item">' +
      '<div class="coll-item__head"><h2 class="coll-item__title">' + r.title + "</h2>" +
      '<span class="coll-chip coll-chip--' + r.status + '">' + r.status + "</span></div>" +
      '<p class="coll-line">Contrat #' + r.contract + "</p>" +
      '<p class="coll-line">' + r.ref + "</p>" +
      '<p class="coll-desc">' + r.debits[0] + " debits: " + r.debits[1] + " €<br>" +
        r.credits[0] + " credits: " + r.credits[1] + " €<br>" +
        r.cancels[0] + " cancellations: " + r.cancels[1] + " €<br>" +
        r.refused + " refused (TNA)</p>" +
      '<div class="coll-item__actions">' +
      '<button class="coll-btn" type="button" data-action="open-cticket" data-report="' + id + '" aria-label="' + r.title + ', email the report"><img src="assets/icon-email.svg" alt=""></button>' +
      '<button class="coll-btn" type="button" data-action="open-cticket" data-report="' + id + '" aria-label="' + r.title + ', print the report"><img src="assets/icon-printer.svg" alt=""></button>' +
      "</div></article>"
    );
  }

  function renderCollections() {
    collDays.innerHTML = collAllDays().map(function (d, di) {
      var open = !collCollapsed[d.day];
      return (
        '<div class="day-group">' +
        '<button class="day coll-day" type="button" data-action="toggle-coll-day" data-day="' + d.day + '" aria-expanded="' + open + '">' +
        '<span class="day__label">' + d.day + '</span><img src="assets/icon-down.svg" alt=""></button>' +
        '<div class="coll-rows"' + (open ? "" : " hidden") + ">" +
        d.reports.map(function (r, ri) { return reportHtml(r, di + "-" + ri); }).join("") +
        "</div></div>"
      );
    }).join("");
  }

  function findReport(id) {
    var p = String(id).split("-");
    var d = collAllDays()[Number(p[0])];
    return d && d.reports[Number(p[1])];
  }

  // Placeholders over the list, then the list (Frame 6 → 1 → 11, and 52 → 9).
  function collLoad(ms, then) {
    collSkeleton.hidden = false;
    collDays.style.visibility = "hidden";   // the intro stays, as in Figma
    collLater(function () {
      renderCollections();
      collList.scrollTop = 0;
      collSkeleton.hidden = true;
      collDays.style.visibility = "";
      if (then) then();
    }, ms);
  }

  function enterCollections() {
    collClearTimers();
    collView.classList.remove("is-sending");
    collBarSpinner.classList.remove("is-on");
    collUpload.disabled = false;
    collLoad(COLL_T.open, function () { announce(collAllDays().length + " days of file collection reports"); });
  }

  function leaveCollections() {
    collClearTimers();
    [mailLayer, cticket, sendLayer].forEach(function (l) { hideLayer(l, 0); });
  }

  // Day header: the chevron flips and the reports slide shut, or open (Frames 50 → 48 → 49, Smart Animate 300 ms ease-out).
  function toggleCollDay(btn) {
    var day = btn.getAttribute("data-day");
    var rows = btn.nextElementSibling;
    var open = !!collCollapsed[day];   // opening if it was collapsed
    collCollapsed[day] = !open;
    btn.setAttribute("aria-expanded", String(open));
    rows.getAnimations().forEach(function (a) { a.cancel(); });
    if (open) rows.hidden = false;
    if (reducedMotion.matches) { rows.hidden = !open; return; }
    var h = rows.scrollHeight;
    rows.animate([{ height: (open ? 0 : h) + "px" }, { height: (open ? h : 0) + "px" }], { duration: 300, easing: EASE_OUT })
      .finished.then(function () { if (!open) rows.hidden = true; }, function () {});
  }

  /* ---- Send the file collections now (Frames 53 → 4 → 8 → 52 → 9) ---- */

  // Dim first, then the dialog or ticket fades in over it (Figma: two 200 ms dissolves).
  function showOverDim(layer, focusSel) {
    showLayer(layer, 0, focusSel);
    if (reducedMotion.matches) return;
    layer.firstElementChild.animate([{ opacity: 0 }, { opacity: 1 }], { duration: COLL_T.dim, easing: EASE_IN });
    Array.prototype.slice.call(layer.children, 1).forEach(function (el) {
      el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: COLL_T.dim, delay: COLL_T.dim, easing: EASE_OUT, fill: "backwards" });
    });
  }

  function openSend() {
    if (collView.classList.contains("is-sending")) return;
    showOverDim(sendLayer, "[data-action='cancel-send']");
    announce("Send file collections? This triggers sending on all your active contracts.");
  }

  function confirmSend() {
    hideLayer(sendLayer, 300, null);
    collView.classList.add("is-sending");
    collBarSpinner.classList.add("is-on");
    collUpload.disabled = true;
    announce("Sending file collections");
    collLater(function () {
      collView.classList.remove("is-sending");
      collBarSpinner.classList.remove("is-on");
      collUpload.disabled = false;
      collSent = true;
      collLoad(COLL_T.reload, function () {
        collUpload.focus({ preventScroll: true });
        announce("File collections sent. Today's reports added.");
      });
    }, COLL_T.sending);
  }

  /* ---- Report ticket (Frames 54 → 55) ---- */

  function line(t) { return '<p class="cticket__line">' + t + "</p>"; }
  var GAP = '<span class="cticket__gap"></span>';

  function openCticket(btn) {
    var r = findReport(btn.getAttribute("data-report"));
    if (!r) return;
    collOpener = btn;
    collReport = r;
    var t = r.ticket;
    cticketBody.innerHTML =
      '<p class="cticket__title">File collection for<br>' + t.app + " application</p>" + GAP +
      line("the " + t.date) + line("at " + t.time) + GAP +
      line("payxpert france 69 lyon") + GAP +
      line("001696") + line("16808") + line("54003281000041") + line("2010") + GAP +
      line("7372") + line("10") + GAP +
      line("001") + GAP +
      line(t.no === "created" ? "file collection created" : "file collection " + t.no) + line("file " + t.file) + GAP +
      line("nb transactions in eur:") + GAP +
      line("debits: " + r.debits[0]) + GAP +
      line("credits: " + r.credits[0]) + GAP +
      line("cancellations: " + r.cancels[0]);
    showOverDim(cticket, ".cticket__close");
    announce("File collection report, " + r.title);
  }

  // Back to the button that opened the ticket, or the upload button if its day was collapsed meanwhile.
  function collReturn() { return collOpener && collOpener.offsetParent ? collOpener : collUpload; }

  function closeCticket() { hideLayer(cticket, 0, collReturn()); }   // Figma: Close, no transition

  /* ---- Email the report (Frames 56 → 43 → 44 → 45 → 46 → 47) ---- */

  function setMailState(state) {
    mailDialog.setAttribute("data-mail-state", state);
    mailLayer.querySelector("[data-mail-title]").textContent = state === "enter" ? "Please enter your email" : "File collection’s reports";
  }

  function openMail() {
    clearMailTimers();
    setMailState("enter");
    mailInput.value = "";
    mailInput._typed = false;
    showOverDim(mailLayer, "[data-mail-input]");
    announce("Please enter your email");
  }

  // Figma types "example@email.com" in when the field is tapped (Frame 44, 0.8 s).
  function typeExampleMail() {
    if (mailInput.value || mailInput._typed) return;
    mailInput._typed = true;
    var text = "example@email.com";
    var step = COLL_T.typing / text.length;
    text.split("").forEach(function (ch, i) {
      mailLater(function () { if (mailInput.value.length === i) mailInput.value += ch; }, Math.round(step * (i + 1)));
    });
  }

  function validateMail() {
    if (!mailInput.value.trim()) { mailInput.focus(); typeExampleMail(); return; }
    setMailState("sending");
    announce("Electronic ticket sending in progress");
    if (mailLayer.contains(document.activeElement)) document.activeElement.blur();
    mailLater(function () {
      setMailState("sent");
      mailLayer.querySelector("[data-action='mail-ok']").focus({ preventScroll: true });
    }, COLL_T.mailSend);
  }

  function closeMail(toList) {
    clearMailTimers();
    if (toList) {   // OK on "Ticket has been sent": back to the list (Frame 47 → 11)
      hideLayer(mailLayer, 0);
      hideLayer(cticket, 0, collReturn());
    } else {
      hideLayer(mailLayer, 0, cticket.querySelector("[data-action='open-mail']"));
    }
  }

  mailLayer.querySelector(".cdialog__field").addEventListener("pointerdown", typeExampleMail);
  mailInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") { e.preventDefault(); validateMail(); }
  });

  function handleCollectionsClick(action, el) {
    switch (action) {
      case "toggle-coll-day": toggleCollDay(el); return true;
      case "open-send": openSend(); return true;
      case "cancel-send": hideLayer(sendLayer, 0, collUpload); return true;
      case "confirm-send": confirmSend(); return true;
      case "open-cticket": openCticket(el); return true;
      case "close-cticket": closeCticket(); return true;
      case "open-mail": openMail(); return true;
      case "dim-mail": if (mailDialog.getAttribute("data-mail-state") === "enter") closeMail(false); return true;
      case "cancel-mail": closeMail(false); return true;
      case "validate-mail": validateMail(); return true;
      case "mail-ok": closeMail(true); return true;
    }
    return false;
  }

  // The open modal layer, if any: menu, then the overlays of the current screen.
  function openModal() {
    if (!drawer.hidden) return drawer;
    var layers = { details: [copyTicket, printLayer], journal: [filtersLayer], "summary-settings": [timeLayer], collections: [mailLayer, cticket, sendLayer], receipt: [ticketEl()], "receipt-old": [ticketEl()] }[current] || [];
    for (var i = 0; i < layers.length; i++) if (!layers[i].hidden) return layers[i];
    return null;
  }

  document.addEventListener("keydown", function (e) {
    var modal = openModal();
    if (!modal) return;

    // Tab stays inside the open menu, sheet or receipt (they are aria-modal).
    if (e.key === "Tab") {
      var items = Array.prototype.filter.call(modal.querySelectorAll("button:not([tabindex='-1']), input, [tabindex='0']"), function (b) { return b.offsetParent !== null; });
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
    else if (modal === timeLayer) closeTime(false);
    else if (modal === mailLayer) { var ms = mailDialog.getAttribute("data-mail-state"); if (ms !== "sending") closeMail(ms === "sent"); }
    else if (modal === cticket) closeCticket();
    else if (modal === sendLayer) hideLayer(sendLayer, 0, collUpload);
    else closeTicket(true);
  });

  // Mouse drag scrolls the chip rows and the list, as a finger would on the terminal.
  (function dragToScroll() {
    var drag = null;
    var swallowClick = false;
    screen.addEventListener("pointerdown", function (e) {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      var el = e.target.closest(".hscroll, .journal-list, .ds-panel, .coll-list");
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
    if (handleSummaryClick(action, actionEl)) return;
    if (handleCollectionsClick(action, actionEl)) return;

    if (current === "present-card") {
      if (action === "cancel-transaction") { newSale(); return; }   // brief D2: cancel resets the sale
      // Any other click on Present Card = the customer taps their card.
      if (e.target.closest(".view--card")) go("card-read", CARD_TAPPED);
      return;
    }

    if (current === "receipt" || current === "receipt-old") {
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
