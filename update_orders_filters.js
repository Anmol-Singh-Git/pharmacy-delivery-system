const fs = require('fs');

// 1. Fix ORDERS.CSS
let ordersCss = fs.readFileSync('public/ORDERS.CSS', 'utf8');
const validCssEndIndex = ordersCss.indexOf('}\r\n. f i l t e r s - p a n e l');
if (validCssEndIndex !== -1) {
    ordersCss = ordersCss.substring(0, validCssEndIndex + 1) + '\n';
}

const sellerCssLines = fs.readFileSync('public/SELLER-PAST-ORDERS.CSS', 'utf8').split('\n');
const filterCss = sellerCssLines.slice(97, 247).join('\n'); // approx lines 98 to 247 containing filters-panel to calendar-actions
fs.writeFileSync('public/ORDERS.CSS', ordersCss + '\n' + filterCss);

// 2. Fix ORDERS.HTML HTML
let ordersHtml = fs.readFileSync('public/ORDERS.HTML', 'utf8');

const oldFilterHtml = `<section class="filters-panel" style="background:rgba(255,255,255,0.95); border:1px solid rgba(166,184,201,0.5); border-radius:28px; padding:22px; box-shadow:0 24px 60px rgba(20,32,49,0.06); margin-bottom:24px;">
<div class="filters-grid" style="display:flex; gap:16px;">
<div class="filter-field" style="flex:1;">
<label for="dateRangeButton" style="font-size:12px; font-weight:700; color:#526579; display:block; margin-bottom:10px;">Date range</label>
<button id="dateRangeButton" type="button" class="range-picker-btn" style="width:100%; padding:14px 16px; border-radius:16px; border:1px solid #d6e0ea; background:#ffffff; font-size:14px; color:#102033; text-align:left;">Select date range</button>
<div id="dateRangePopup" class="date-range-popup hidden" aria-hidden="true"></div>
</div>
</div>
</section>`;

const newFilterHtml = `<section class="filters-panel">
<div class="filters-grid">
<div class="filter-field">
<label for="orderSearch">Search</label>
<input id="orderSearch" placeholder="Search by order id, medicine..." type="search">
</div>

<div class="filter-field">
<label for="categoryFilter">Order type</label>
<select id="categoryFilter">
<option value="all">All Types</option>
<option value="TABLET">Tablet</option>
<option value="SYRUP">Syrup</option>
<option value="CAPSULE">Capsule</option>
<option value="INJECTION">Injection</option>
<option value="HEALTHCARE_DEVICES">Healthcare Devices</option>
<option value="PERSONAL_CARE">Personal Care</option>
<option value="BABY_CARE">Baby Care</option>
<option value="NUTRITION">Nutrition</option>
<option value="AYURVEDIC">Ayurvedic</option>
<option value="HOME_ESSENTIALS">Home Essentials</option>
</select>
</div>

<div class="filter-field">
<label for="priceSort">Price</label>
<select id="priceSort">
<option value="default">Sort by Price</option>
<option value="low">Low to High</option>
<option value="high">High to Low</option>
</select>
</div>

<div class="filter-field">
<label for="dateRangeButton">Date range</label>
<button id="dateRangeButton" type="button" class="range-picker-btn">Select date range</button>
<div id="dateRangePopup" class="date-range-popup hidden" aria-hidden="true"></div>
</div>
</div>
</section>`;

ordersHtml = ordersHtml.replace(oldFilterHtml, newFilterHtml);

// 3. Fix ORDERS.HTML JavaScript
// We need to update renderOrders to include search, category, and price filtering.
// And add event listeners for the new inputs.

const oldRenderOrdersStart = "function renderOrders(){";
const oldRenderOrdersCode = `function renderOrders(){
  const container = document.getElementById("orders-container");
  let filteredOrders = currentOrders;

  if(dateRangeState.start && dateRangeState.end){
    filteredOrders = currentOrders.filter(order => {
      const orderIso = formatDateInput(order.order_date);
      return orderIso && orderIso >= dateRangeState.start && orderIso <= dateRangeState.end;
    });
  }`;

const newRenderOrdersCode = `function getOrderTypes(order){
  const categories = new Set();
  const items = Array.isArray(order.medicines) ? order.medicines : [];
  items.forEach(item => {
    if(item.category) categories.add(item.category);
  });
  return [...categories];
}

function getOrderTypeLabel(order){
  const types = getOrderTypes(order);
  if(types.length === 0) return "Unknown";
  if(types.length === 1) return types[0].replace(/_/g, " ");
  return "Mixed";
}

function orderMatchesFilters(order){
  const search = document.getElementById("orderSearch").value.trim().toLowerCase();
  const selectedCategory = document.getElementById("categoryFilter").value;
  const orderTypes = getOrderTypes(order);
  if(selectedCategory !== "all" && !orderTypes.includes(selectedCategory)){
    return false;
  }

  if(dateRangeState.start && dateRangeState.end){
    const orderIso = formatDateInput(order.order_date);
    if(!orderIso || orderIso < dateRangeState.start || orderIso > dateRangeState.end){
      return false;
    }
  }

  if(search){
    const terms = [
      order._id,
      order.order_status,
      order.status,
      getOrderTypeLabel(order),
      order.orderTime
    ].filter(Boolean).join(" ").toLowerCase();

    const items = Array.isArray(order.medicines) ? order.medicines : [];
    const itemText = items.map(item => [item.medicine_name, item.brand, item.category].filter(Boolean).join(" ")).join(" ").toLowerCase();

    if(!terms.includes(search) && !itemText.includes(search)){
      return false;
    }
  }

  return true;
}

function sortByPrice(a, b){
  const sortType = document.getElementById("priceSort").value;
  const priceA = Number(a.total_price) || 0;
  const priceB = Number(b.total_price) || 0;
  if(sortType === "low") return priceA - priceB;
  if(sortType === "high") return priceB - priceA;
  return new Date(b.order_date).getTime() - new Date(a.order_date).getTime();
}

function renderOrders(){
  const container = document.getElementById("orders-container");
  
  let filteredOrders = currentOrders.filter(orderMatchesFilters);
  filteredOrders.sort(sortByPrice);

  if(!filteredOrders.length){`;

ordersHtml = ordersHtml.replace(oldRenderOrdersCode, newRenderOrdersCode);

// Add event listeners initialization
const oldInitDateRange = `function initializeDateRangePicker(){
  document.getElementById("dateRangeButton").addEventListener("click", event => {`;

const newInitDateRange = `function initializeDateRangePicker(){
  document.getElementById("orderSearch").addEventListener("input", renderOrders);
  document.getElementById("categoryFilter").addEventListener("change", renderOrders);
  document.getElementById("priceSort").addEventListener("change", renderOrders);

  document.getElementById("dateRangeButton").addEventListener("click", event => {`;

ordersHtml = ordersHtml.replace(oldInitDateRange, newInitDateRange);

fs.writeFileSync('public/ORDERS.HTML', ordersHtml);

console.log("Done");
