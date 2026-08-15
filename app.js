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

var GST_RATE = 0.18;
var GSTIN = "22AZZPS5834Q1Z6";

/* ------------------------------------------------------------------ */
/* Quotation state — one plain object (IDEA.md §7)                     */
/* ------------------------------------------------------------------ */
var quotation = {
  customer: "",
  date: today(),
  gstEnabled: false,
  signatureEnabled: true,
  standard: emptyQuantities(STANDARD_ITEMS),
  rubber: { added: false, price: 0 },
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
/* Rubber Stamp section — one simple item with a direct price          */
/* ------------------------------------------------------------------ */

function renderRubberStamp() {
  var container = document.getElementById("rubber-stamp");
  container.textContent = "";

  if (!quotation.rubber.added) {
    var addBtn = document.createElement("button");
    addBtn.type = "button";
    addBtn.id = "add-rubber-btn";
    addBtn.className = "btn btn-secondary";
    addBtn.textContent = "+ Add Rubber Stamp";
    addBtn.addEventListener("click", function () {
      quotation.rubber.added = true;
      renderRubberStamp();
      updateAmounts();
    });
    container.appendChild(addBtn);
    return;
  }

  var row = document.createElement("div");
  row.className = "rubber-added";
  row.innerHTML =
    '<label class="direct-price-field">Direct Price: ' +
    '<input type="number" id="rubber-price" class="direct-price" min="0" step="any" inputmode="decimal" value="0">' +
    '</label>' +
    '<span class="item-amount" id="rubber-amount">₹0</span>' +
    '<button type="button" id="remove-rubber-btn" class="btn btn-danger">Remove</button>';
  container.appendChild(row);

  var priceInput = row.querySelector("#rubber-price");
  priceInput.value = quotation.rubber.price;
  priceInput.addEventListener("input", function (e) {
    quotation.rubber.price = toNonNegative(e.target.value);
    e.target.value = quotation.rubber.price;
    updateAmounts();
  });

  row.querySelector("#remove-rubber-btn").addEventListener("click", function () {
    quotation.rubber.added = false;
    quotation.rubber.price = 0;
    renderRubberStamp();
    updateAmounts();
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

function updateAmounts() {
  var subtotal = 0;
  subtotal += updateFixedSection("standard-items", STANDARD_ITEMS, quotation.standard);
  subtotal += updateRubberAmount();
  subtotal += updateCustomSection();

  var gst = quotation.gstEnabled ? Math.round(subtotal * GST_RATE * 100) / 100 : 0;
  var grand = Math.round((subtotal + gst) * 100) / 100;

  document.getElementById("subtotal").textContent = money(subtotal);
  document.getElementById("gst-amount").textContent = money(gst);
  document.getElementById("gst-line").hidden = !quotation.gstEnabled;
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

function updateRubberAmount() {
  var amountEl = document.getElementById("rubber-amount");
  var amount = quotation.rubber.added ? quotation.rubber.price : 0;
  if (amountEl) amountEl.textContent = money(amount);
  return amount;
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

  /* GSTIN row — only exists in the DOM when GST is enabled. */
  var metaRight = document.getElementById("preview-meta-right");
  var oldGstRow = metaRight.querySelector("#preview-gst-row");
  if (oldGstRow) oldGstRow.remove();
  if (quotation.gstEnabled) {
    var gstRow = document.createElement("p");
    gstRow.id = "preview-gst-row";
    gstRow.innerHTML = "<strong>GSTIN:</strong> <span id=\"preview-gst-number\"></span>";
    gstRow.querySelector("#preview-gst-number").textContent = GSTIN;
    metaRight.appendChild(gstRow);
  }

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

  if (quotation.rubber.added && quotation.rubber.price > 0) {
    sr++;
    subtotal += quotation.rubber.price;
    addPreviewRow(tbody, sr, "RUBBER STAMP", 1, quotation.rubber.price, quotation.rubber.price);
  }

  quotation.custom.forEach(function (item) {
    var amount = item.qty * item.rate;
    if (amount <= 0) return;
    sr++;
    subtotal += amount;
    addPreviewRow(tbody, sr, item.name || "—", item.qty, item.rate, amount);
  });

  var gst = quotation.gstEnabled ? Math.round(subtotal * GST_RATE * 100) / 100 : 0;
  var grand = Math.round((subtotal + gst) * 100) / 100;

  /* Totals — GST row is only created in the DOM when GST is enabled. */
  var totalsBox = document.getElementById("preview-totals");
  totalsBox.textContent = "";
  totalsBox.appendChild(totalRow("Subtotal", money(subtotal), false));
  if (quotation.gstEnabled) {
    totalsBox.appendChild(totalRow("GST (18%)", money(gst), false));
  }
  totalsBox.appendChild(totalRow("Grand Total", money(grand), true));
}

function totalRow(label, value, grand) {
  var row = document.createElement("div");
  row.className = grand ? "q-total-line q-grand-total" : "q-total-line";
  var labelSpan = document.createElement("span");
  labelSpan.textContent = label;
  var valueSpan = document.createElement("span");
  valueSpan.textContent = value;
  row.appendChild(labelSpan);
  row.appendChild(valueSpan);
  return row;
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
  renderFixedSection("standard-items", STANDARD_ITEMS, "standard");
  renderRubberStamp();
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
