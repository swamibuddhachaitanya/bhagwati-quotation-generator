/* Bhagwati Printers Quotation Generator — editor + preview logic.
   Plain vanilla JavaScript, no dependencies. Scope per IDEA.md. */

/* ------------------------------------------------------------------ */
/* Fixed internal account (client-side check only — IDEA.md §3)        */
/* ------------------------------------------------------------------ */
var VALID_USERNAME = "admin@bhagwati.com";
var VALID_PASSWORD = "bhagwati#Printers.admin26";

/* ------------------------------------------------------------------ */
/* Fixed item catalogs (rates are fixed — IDEA.md §5, §6)              */
/* ------------------------------------------------------------------ */
var STANDARD_ITEMS = [
  { id: "preInk", name: "PRE INK STAMP", rate: 150 },
  { id: "selfInk", name: "SELF INK STAMP", rate: 250 },
  { id: "commanSeal", name: "COMMAN SEAL", rate: 2200 }
];

var RUBBER_STAMP_ITEMS = [
  { id: "round", name: "Round", rate: 80 },
  { id: "karta", name: "Karta", rate: 50 },
  { id: "proprietor", name: "Proprietor", rate: 50 },
  { id: "authorizedSignatory", name: "Authorized Signatory", rate: 50 },
  { id: "partner", name: "Partner", rate: 50 }
];

var GST_RATE = 0.18;

/* ------------------------------------------------------------------ */
/* Quotation state — one plain object (IDEA.md §7)                     */
/* ------------------------------------------------------------------ */
var quotation = {
  customer: "",
  date: today(),
  gstEnabled: false,
  gstNumber: "22AZZPS5834Q1Z6",
  signatureEnabled: true,
  standard: emptyQuantities(STANDARD_ITEMS),
  rubber: emptyRubberStamps(RUBBER_STAMP_ITEMS),
  custom: []   // { id, name, qty, rate }
};

var customIdCounter = 0;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function today() {
  var d = new Date();
  var local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function emptyQuantities(catalog) {
  var map = {};
  catalog.forEach(function (item) { map[item.id] = 0; });
  return map;
}

function emptyRubberStamps(catalog) {
  var map = {};
  catalog.forEach(function (item) {
    map[item.id] = { enabled: false, qty: 0, pricingMode: "normal", directPrice: 0 };
  });
  return map;
}

/* Invalid or negative input resolves to 0 — never NaN. */
function toNonNegative(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return n;
}

/* Round to 2 decimals and format with Indian grouping. */
function fmt(value) {
  var n = Math.round((Number(value) || 0) * 100) / 100;
  return n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function money(value) {
  return "₹" + fmt(value);
}

function customItemById(id) {
  for (var i = 0; i < quotation.custom.length; i++) {
    if (quotation.custom[i].id === id) return quotation.custom[i];
  }
  return null;
}

function catalogItem(catalog, id) {
  for (var i = 0; i < catalog.length; i++) {
    if (catalog[i].id === id) return catalog[i];
  }
  return null;
}

function formatDate(iso) {
  if (!iso) return "";
  var parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return parts[2] + "/" + parts[1] + "/" + parts[0];
}

/* ------------------------------------------------------------------ */
/* Login                                                               */
/* ------------------------------------------------------------------ */

function onLogin(e) {
  e.preventDefault();
  var username = document.getElementById("username").value.trim();
  var password = document.getElementById("password").value;
  var error = document.getElementById("login-error");

  if (username === VALID_USERNAME && password === VALID_PASSWORD) {
    showEditor();
  } else {
    error.textContent = "Invalid username or password.";
    error.hidden = false;
  }
}

function showEditor() {
  document.getElementById("login-section").hidden = true;
  document.getElementById("editor-section").hidden = false;
  document.getElementById("customer").focus();
}

function showLogin() {
  document.getElementById("editor-section").hidden = true;
  document.getElementById("login-section").hidden = false;
  document.getElementById("login-error").hidden = true;
  document.getElementById("password").value = "";
  document.getElementById("username").focus();
}

/* ------------------------------------------------------------------ */
/* Options (GST / Signature)                                           */
/* ------------------------------------------------------------------ */

function updateGstUi() {
  var btn = document.getElementById("gst-toggle");
  btn.textContent = quotation.gstEnabled ? "ON" : "OFF";
  btn.classList.toggle("is-on", quotation.gstEnabled);
  btn.setAttribute("aria-pressed", quotation.gstEnabled ? "true" : "false");
  document.getElementById("gst-number").hidden = !quotation.gstEnabled;
}

function updateSignatureUi() {
  var btn = document.getElementById("signature-toggle");
  btn.textContent = quotation.signatureEnabled ? "ON" : "OFF";
  btn.classList.toggle("is-on", quotation.signatureEnabled);
  btn.setAttribute("aria-pressed", quotation.signatureEnabled ? "true" : "false");
}

/* ------------------------------------------------------------------ */
/* Standard item section (fixed rates, quantity controls)              */
/* ------------------------------------------------------------------ */

function renderFixedSection(containerId, catalog, stateKey) {
  var container = document.getElementById(containerId);

  catalog.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "item-row";
    row.dataset.id = item.id;
    row.innerHTML =
      '<span class="item-name"></span>' +
      '<div class="qty-control">' +
      '<button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">−</button>' +
      '<input type="number" class="qty-input" min="0" step="any" inputmode="numeric" value="0">' +
      '<button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>' +
      '</div>' +
      '<span class="item-rate"></span>' +
      '<span class="item-amount">₹0</span>';
    row.querySelector(".item-name").textContent = item.name;
    row.querySelector(".item-rate").textContent = money(item.rate);
    container.appendChild(row);
  });

  container.addEventListener("click", function (e) {
    var btn = e.target.closest(".qty-btn");
    if (!btn) return;
    var row = btn.closest(".item-row");
    var input = row.querySelector(".qty-input");
    var next = toNonNegative((Number(input.value) || 0) + (btn.dataset.action === "inc" ? 1 : -1));
    input.value = next;
    quotation[stateKey][row.dataset.id] = next;
    updateAmounts();
  });

  container.addEventListener("input", function (e) {
    if (!e.target.classList.contains("qty-input")) return;
    var row = e.target.closest(".item-row");
    quotation[stateKey][row.dataset.id] = toNonNegative(e.target.value);
    e.target.value = quotation[stateKey][row.dataset.id];
    updateAmounts();
  });
}

/* ------------------------------------------------------------------ */
/* Rubber Stamp section — individually selectable + direct pricing     */
/* ------------------------------------------------------------------ */

function renderRubberSection() {
  var container = document.getElementById("rubber-items");
  container.textContent = "";

  RUBBER_STAMP_ITEMS.forEach(function (item) {
    var rs = quotation.rubber[item.id];

    var block = document.createElement("div");
    block.className = "rubber-item";
    block.dataset.id = item.id;

    var row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML =
      '<span class="item-name"></span>' +
      '<button type="button" class="btn rubber-toggle" aria-label="Toggle ' + item.name + '"></button>' +
      '<div class="qty-control rubber-qty" hidden>' +
      '<button type="button" class="qty-btn" data-action="dec" aria-label="Decrease quantity">−</button>' +
      '<input type="number" class="qty-input" min="0" step="any" inputmode="numeric">' +
      '<button type="button" class="qty-btn" data-action="inc" aria-label="Increase quantity">+</button>' +
      '</div>' +
      '<span class="item-rate rubber-rate" hidden></span>' +
      '<span class="item-amount" hidden>₹0</span>';
    row.querySelector(".item-name").textContent = item.name;
    block.appendChild(row);

    var pricing = document.createElement("div");
    pricing.className = "pricing-row";
    pricing.hidden = true;
    pricing.innerHTML =
      '<label class="pricing-option"><input type="radio" name="pricing-' + item.id + '" value="normal"> Rate × Quantity</label>' +
      '<label class="pricing-option"><input type="radio" name="pricing-' + item.id + '" value="direct"> Direct Price</label>' +
      '<label class="direct-price-field" hidden>Direct Price: <input type="number" class="direct-price" min="0" step="any" inputmode="decimal"></label>';
    block.appendChild(pricing);

    container.appendChild(block);
    applyRubberRowState(item);
  });
}

function applyRubberRowState(item) {
  var rs = quotation.rubber[item.id];
  var block = document.querySelector('.rubber-item[data-id="' + item.id + '"]');
  if (!block) return;

  var toggle = block.querySelector(".rubber-toggle");
  toggle.textContent = rs.enabled ? "ON" : "OFF";
  toggle.classList.toggle("is-on", rs.enabled);
  toggle.setAttribute("aria-pressed", rs.enabled ? "true" : "false");

  var on = rs.enabled;
  block.querySelector(".rubber-qty").hidden = !on;
  block.querySelector(".rubber-rate").hidden = !on;
  block.querySelector(".item-amount").hidden = !on;
  block.querySelector(".qty-input").value = rs.qty;
  block.querySelector(".rubber-rate").textContent = money(item.rate);
  block.querySelector(".pricing-row").hidden = !on;

  block.querySelectorAll('.pricing-row input[type="radio"]').forEach(function (r) {
    r.checked = (r.value === rs.pricingMode);
  });

  var directField = block.querySelector(".direct-price-field");
  directField.hidden = rs.pricingMode !== "direct";
  block.querySelector(".direct-price").value = rs.directPrice;
}

function wireRubberSection() {
  var container = document.getElementById("rubber-items");

  container.addEventListener("click", function (e) {
    var block = e.target.closest(".rubber-item");
    if (!block) return;
    var id = block.dataset.id;
    var rs = quotation.rubber[id];

    if (e.target.classList.contains("rubber-toggle")) {
      rs.enabled = !rs.enabled;
      if (rs.enabled && rs.qty === 0) rs.qty = 1;
      renderRubberSection();
      updateAmounts();
      return;
    }

    var btn = e.target.closest(".qty-btn");
    if (btn) {
      var input = block.querySelector(".qty-input");
      rs.qty = toNonNegative((Number(input.value) || 0) + (btn.dataset.action === "inc" ? 1 : -1));
      input.value = rs.qty;
      updateAmounts();
    }
  });

  container.addEventListener("change", function (e) {
    if (!(e.target.name && e.target.name.indexOf("pricing-") === 0)) return;
    var block = e.target.closest(".rubber-item");
    quotation.rubber[block.dataset.id].pricingMode = e.target.value;
    applyRubberRowState(catalogItem(RUBBER_STAMP_ITEMS, block.dataset.id));
    updateAmounts();
  });

  container.addEventListener("input", function (e) {
    var block = e.target.closest(".rubber-item");
    if (!block) return;
    var rs = quotation.rubber[block.dataset.id];

    if (e.target.classList.contains("qty-input")) {
      rs.qty = toNonNegative(e.target.value);
      e.target.value = rs.qty;
      updateAmounts();
    } else if (e.target.classList.contains("direct-price")) {
      rs.directPrice = toNonNegative(e.target.value);
      e.target.value = rs.directPrice;
      updateAmounts();
    }
  });
}

/* ------------------------------------------------------------------ */
/* Custom items                                                        */
/* ------------------------------------------------------------------ */

function addCustomItem() {
  customIdCounter += 1;
  quotation.custom.push({ id: "custom-" + customIdCounter, name: "", qty: 0, rate: 0 });
  renderCustomItems();
}

function renderCustomItems() {
  var container = document.getElementById("custom-items");
  container.textContent = "";

  quotation.custom.forEach(function (item) {
    var row = document.createElement("div");
    row.className = "item-row custom-row";
    row.dataset.id = item.id;
    row.innerHTML =
      '<input type="text" class="custom-name" placeholder="Item name">' +
      '<input type="number" class="custom-qty" min="0" step="any" inputmode="numeric">' +
      '<input type="number" class="custom-rate" min="0" step="any" inputmode="decimal">' +
      '<span class="item-amount">₹0</span>' +
      '<button type="button" class="btn btn-danger remove-btn">Remove</button>';
    row.querySelector(".custom-name").value = item.name;
    row.querySelector(".custom-qty").value = item.qty;
    row.querySelector(".custom-rate").value = item.rate;
    container.appendChild(row);
  });

  updateAmounts();
}

function onCustomInput(e) {
  var row = e.target.closest(".custom-row");
  if (!row) return;
  var item = customItemById(row.dataset.id);
  if (!item) return;
  if (e.target.classList.contains("custom-name")) item.name = e.target.value;
  if (e.target.classList.contains("custom-qty")) {
    item.qty = toNonNegative(e.target.value);
    e.target.value = item.qty;
  }
  if (e.target.classList.contains("custom-rate")) {
    item.rate = toNonNegative(e.target.value);
    e.target.value = item.rate;
  }
  updateAmounts();
}

function onCustomClick(e) {
  if (!e.target.classList.contains("remove-btn")) return;
  var row = e.target.closest(".custom-row");
  quotation.custom = quotation.custom.filter(function (item) {
    return item.id !== row.dataset.id;
  });
  renderCustomItems();
}

/* ------------------------------------------------------------------ */
/* Calculation — subtotal, GST (18% of subtotal), grand total          */
/* ------------------------------------------------------------------ */

function rubberAmount(item, rs) {
  if (!rs.enabled) return 0;
  return rs.pricingMode === "direct" ? rs.directPrice : rs.qty * item.rate;
}

function updateAmounts() {
  var subtotal = 0;
  subtotal += updateFixedSection("standard-items", STANDARD_ITEMS, quotation.standard);
  subtotal += updateRubberSection();
  subtotal += updateCustomSection();

  var gst = quotation.gstEnabled ? Math.round(subtotal * GST_RATE * 100) / 100 : 0;
  var grand = Math.round((subtotal + gst) * 100) / 100;

  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("gst-amount").textContent = money(gst);
  document.getElementById("grand-total").textContent = money(grand);
}

function updateFixedSection(containerId, catalog, quantities) {
  var container = document.getElementById(containerId);
  var total = 0;
  catalog.forEach(function (item) {
    var row = container.querySelector('.item-row[data-id="' + item.id + '"]');
    var amount = quantities[item.id] * item.rate;
    row.querySelector(".item-amount").textContent = money(amount);
    total += amount;
  });
  return total;
}

function updateRubberSection() {
  var container = document.getElementById("rubber-items");
  var total = 0;
  RUBBER_STAMP_ITEMS.forEach(function (item) {
    var rs = quotation.rubber[item.id];
    var block = container.querySelector('.rubber-item[data-id="' + item.id + '"]');
    var amount = rubberAmount(item, rs);
    block.querySelector(".item-amount").textContent = money(amount);
    total += amount;
  });
  return total;
}

function updateCustomSection() {
  var total = 0;
  quotation.custom.forEach(function (item) {
    var row = document.querySelector('.custom-row[data-id="' + item.id + '"]');
    var amount = item.qty * item.rate;
    row.querySelector(".item-amount").textContent = money(amount);
    total += amount;
  });
  return total;
}

/* ------------------------------------------------------------------ */
/* Preview                                                             */
/* ------------------------------------------------------------------ */

function showPreview() {
  buildPreview();
  document.getElementById("editor-section").hidden = true;
  document.getElementById("preview-section").hidden = false;
  window.scrollTo(0, 0);
}

function backToEditor() {
  document.getElementById("preview-section").hidden = true;
  document.getElementById("editor-section").hidden = false;
}

function buildPreview() {
  document.getElementById("preview-customer").textContent = quotation.customer || "—";
  document.getElementById("preview-date").textContent = formatDate(quotation.date);

  var gstRow = document.getElementById("preview-gst-row");
  gstRow.hidden = !quotation.gstEnabled;
  document.getElementById("preview-gst-number").textContent = quotation.gstNumber;

  document.getElementById("preview-signature").hidden = !quotation.signatureEnabled;

  var tbody = document.getElementById("preview-table-body");
  tbody.textContent = "";
  var sr = 0;
  var subtotal = 0;

  STANDARD_ITEMS.forEach(function (item) {
    var qty = quotation.standard[item.id];
    if (qty <= 0) return;
    sr++;
    var amount = qty * item.rate;
    subtotal += amount;
    addPreviewRow(tbody, sr, item.name, qty, item.rate, amount);
  });

  RUBBER_STAMP_ITEMS.forEach(function (item) {
    var rs = quotation.rubber[item.id];
    if (!rs.enabled) return;
    var amount = rubberAmount(item, rs);
    if (amount <= 0) return;
    sr++;
    subtotal += amount;
    var qty = rs.pricingMode === "direct" ? "—" : rs.qty;
    var rate = rs.pricingMode === "direct" ? "—" : item.rate;
    addPreviewRow(tbody, sr, item.name, qty, rate, amount);
  });

  quotation.custom.forEach(function (item) {
    var amount = item.qty * item.rate;
    if (amount <= 0) return;
    sr++;
    subtotal += amount;
    addPreviewRow(tbody, sr, item.name || "—", item.qty, item.rate, amount);
  });

  var gst = quotation.gstEnabled ? Math.round(subtotal * GST_RATE * 100) / 100 : 0;
  var grand = Math.round((subtotal + gst) * 100) / 100;

  document.getElementById("preview-subtotal").textContent = money(subtotal);
  document.getElementById("preview-gst-line").hidden = !quotation.gstEnabled;
  document.getElementById("preview-gst-amount").textContent = money(gst);
  document.getElementById("preview-grand-total").textContent = money(grand);
}

function addPreviewRow(tbody, sr, name, qty, rate, amount) {
  var tr = document.createElement("tr");
  var cells = [
    { text: sr, cls: "col-sr" },
    { text: name, cls: "col-particulars" },
    { text: typeof qty === "number" ? fmt(qty) : qty, cls: "col-qty" },
    { text: typeof rate === "number" ? fmt(rate) : rate, cls: "col-rate" },
    { text: fmt(amount), cls: "col-amount" }
  ];
  cells.forEach(function (c) {
    var td = document.createElement("td");
    td.className = c.cls;
    td.textContent = c.text;
    tr.appendChild(td);
  });
  tbody.appendChild(tr);
}

/* ------------------------------------------------------------------ */
/* Init                                                                */
/* ------------------------------------------------------------------ */

function init() {
  document.getElementById("date").value = quotation.date;
  document.getElementById("gst-number").value = quotation.gstNumber;
  renderFixedSection("standard-items", STANDARD_ITEMS, "standard");
  renderRubberSection();
  wireRubberSection();
  renderCustomItems();

  document.getElementById("login-form").addEventListener("submit", onLogin);
  document.getElementById("logout-btn").addEventListener("click", showLogin);
  document.getElementById("add-item-btn").addEventListener("click", addCustomItem);
  document.getElementById("preview-btn").addEventListener("click", showPreview);
  document.getElementById("back-btn").addEventListener("click", backToEditor);
  document.getElementById("print-btn").addEventListener("click", function () { window.print(); });

  document.getElementById("gst-toggle").addEventListener("click", function () {
    quotation.gstEnabled = !quotation.gstEnabled;
    updateGstUi();
    updateAmounts();
  });
  document.getElementById("gst-number").addEventListener("input", function (e) {
    quotation.gstNumber = e.target.value;
  });
  document.getElementById("signature-toggle").addEventListener("click", function () {
    quotation.signatureEnabled = !quotation.signatureEnabled;
    updateSignatureUi();
  });

  var customContainer = document.getElementById("custom-items");
  customContainer.addEventListener("input", onCustomInput);
  customContainer.addEventListener("click", onCustomClick);

  document.getElementById("customer").addEventListener("input", function (e) {
    quotation.customer = e.target.value;
  });
  document.getElementById("date").addEventListener("change", function (e) {
    quotation.date = e.target.value;
  });

  updateGstUi();
  updateSignatureUi();
  updateAmounts();
}

init();
