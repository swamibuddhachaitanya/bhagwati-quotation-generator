/* Bhagwati Printers Quotation Generator — editor logic.
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

/* ------------------------------------------------------------------ */
/* Quotation state — one plain object (IDEA.md §7)                     */
/* ------------------------------------------------------------------ */
var quotation = {
  customer: "",
  date: today(),
  standard: emptyQuantities(STANDARD_ITEMS),
  rubber: emptyQuantities(RUBBER_STAMP_ITEMS),
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

/* Invalid or negative input resolves to 0 — never NaN (IDEA.md §8). */
function toNonNegative(value) {
  var n = Number(value);
  if (!isFinite(n) || n < 0) return 0;
  return n;
}

function money(value) {
  var n = Math.round((Number(value) || 0) * 100) / 100;
  return "₹" + n.toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function customItemById(id) {
  for (var i = 0; i < quotation.custom.length; i++) {
    if (quotation.custom[i].id === id) return quotation.custom[i];
  }
  return null;
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
/* Fixed item sections (standard items + rubber stamp)                 */
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
/* Calculation — amount = quantity × rate; total = sum of all lines    */
/* ------------------------------------------------------------------ */

function updateAmounts() {
  var total = 0;
  total += updateFixedSection("standard-items", STANDARD_ITEMS, quotation.standard);
  total += updateFixedSection("rubber-items", RUBBER_STAMP_ITEMS, quotation.rubber);
  total += updateCustomSection();
  document.getElementById("total").textContent = money(total);
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
/* Init                                                                */
/* ------------------------------------------------------------------ */

function init() {
  document.getElementById("date").value = quotation.date;
  renderFixedSection("standard-items", STANDARD_ITEMS, "standard");
  renderFixedSection("rubber-items", RUBBER_STAMP_ITEMS, "rubber");

  document.getElementById("login-form").addEventListener("submit", onLogin);
  document.getElementById("logout-btn").addEventListener("click", showLogin);
  document.getElementById("add-item-btn").addEventListener("click", addCustomItem);

  var customContainer = document.getElementById("custom-items");
  customContainer.addEventListener("input", onCustomInput);
  customContainer.addEventListener("click", onCustomClick);

  document.getElementById("customer").addEventListener("input", function (e) {
    quotation.customer = e.target.value;
  });
  document.getElementById("date").addEventListener("change", function (e) {
    quotation.date = e.target.value;
  });

  updateAmounts();
}

init();
