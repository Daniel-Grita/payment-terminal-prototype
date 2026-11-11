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
        // Looping GIF from "Payment Animation.mp4"; a still frame when reduced motion is on.
        '<picture class="loader" aria-hidden="true">' +
        '  <source srcset="assets/loader-still.png" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/loader.gif" alt="">' +
        "</picture>";
    } else if (cfg.body === "card") {
      body =
        '<p class="panel__prompt panel__prompt--muted">' + cfg.prompt + "</p>" +
        '<img class="schemes" src="assets/card-schemes@2x.png" alt="CB, Visa, Mastercard, American Express, Diners Club, Discover, UnionPay, JCB">' +
        // Looping GIF from "POS Animation.mp4"; a still frame when reduced motion is on.
        '<picture class="terminal-art" aria-hidden="true">' +
        '  <source srcset="assets/present-card-still.png" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/present-card.gif" alt="">' +
        "</picture>" +
        '<button class="cta" type="button" data-action="cancel-transaction">cancel transaction</button>' +
        // Clicking anywhere on the screen stands in for tapping the card; this is the keyboard route.
        '<button class="sr-only" type="button" data-action="card-tapped">Tap card</button>';
    } else if (cfg.body === "approved") {
      body =
        // Plays once from "Payment animation 2.mp4" each time Approved appears (see replayBanner).
        '<picture class="banner">' +
        '  <source srcset="assets/approved-banner-still.png" media="(prefers-reduced-motion: reduce)">' +
        '  <img src="assets/approved-banner.gif" alt="Approved. Payment accepted" data-replay>' +
        "</picture>" +
        '<img class="cb-logo" src="assets/cb-logo@2x.png" alt="CB">';
    } else if (cfg.body === "receipt") {
      body =
        '<img class="banner" src="assets/approved-banner-still.png" alt="Approved. Payment accepted">' +
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
      ? '<button class="receipt-option receipt-option--' + key + '" type="button" data-action="' + action + '"' + style + ">" + inner + "</button>"
      : '<div class="receipt-option receipt-option--' + key + '"' + style + ">" + inner + "</div>";
  }

  // Figma "P3 / [Ticket] Ticket in Screen" (5987:4788): a 60% black overlay with the paper
  // receipt. Lines are live text so AMOUNT shows the amount actually entered.
  function ticketTemplate() {
    var line = function (t) { return '<p class="ticket__line">' + t + "</p>"; };
    var space = '<span class="ticket__space"></span>';
    var big = '<span class="ticket__space ticket__space--big"></span>';
    return (
      '<div class="ticket" role="dialog" aria-label="Customer receipt" hidden>' +
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
      line("ref.<br>amount: <span data-amount-value>0,00</span> eur") + big + big +
      line("sale<br>customer receipt<br>please keep") +
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

    if (id === "approved") replayBanner(to);
    if (id !== "receipt") closeTicket(false);
  }

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
    fetch("assets/approved-banner.gif").then(function (r) { return r.blob(); })
      .then(function (b) { bannerBlob = b; }).catch(function () {});
  }
  function replayBanner(view) {
    var img = view.querySelector("img[data-replay]");
    if (!img || reducedMotion.matches) return;
    if (img._url) URL.revokeObjectURL(img._url);
    img._url = bannerBlob ? URL.createObjectURL(bannerBlob) : null;
    img.src = img._url || "assets/approved-banner.gif?" + Date.now();
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

    var actionEl = e.target.closest("[data-action]");
    var action = actionEl && actionEl.getAttribute("data-action");

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
  go("amount-entry", INSTANT);

  // Debug hook for review tooling: window.__terminal.go('approved')
  window.__terminal = {
    go: function (id) { clearTimeout(holdTimer); go(id, INSTANT); clearTimeout(holdTimer); },
    setAmount: function (d) { digits = String(d); renderAmount(); },
    state: function () { return current; }
  };
})();
