const fs = require('fs');

let html = fs.readFileSync('public/ORDERS.HTML', 'utf8');

// The calendar JS from SELLER-PAST-ORDERS.HTML
const calendarJs = `
const dateRangeState = {
  start:null,
  end:null,
  viewYear:new Date().getFullYear(),
  viewMonth:new Date().getMonth()
};

function formatDateInput(value){
  if(!value) return "";
  const date = new Date(value);
  if(Number.isNaN(date.getTime())) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return \`\${y}-\${m}-\${d}\`;
}

function updateDateRangeButton(){
  const button = document.getElementById("dateRangeButton");
  if(dateRangeState.start && dateRangeState.end){
    button.textContent = \`\${formatDate(dateRangeState.start)} — \${formatDate(dateRangeState.end)}\`;
    button.classList.add("range-selected");
  }
  else if(dateRangeState.start){
    button.textContent = \`\${formatDate(dateRangeState.start)}\`;
    button.classList.add("range-selected");
  }
  else {
    button.textContent = "Select date range";
    button.classList.remove("range-selected");
  }
}

function renderCalendar(year, month){
  const popup = document.getElementById("dateRangePopup");
  const monthNames = ["January","February","March","April","May","June","July","August","September","October","November","December"];
  const weekdayNames = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const firstDay = new Date(year, month, 1);
  const dayCount = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay.getDay();

  let html = \`
    <div class="calendar-shell">
      <div class="calendar-header">
        <div class="calendar-nav">
          <button type="button" id="calendarPrevMonth" aria-label="Previous month">‹</button>
          <div class="calendar-heading">
            <select id="calendarMonth" class="calendar-select"></select>
            <select id="calendarYear" class="calendar-select"></select>
          </div>
          <button type="button" id="calendarNextMonth" aria-label="Next month">›</button>
        </div>
      </div>
      <div class="calendar-weekdays">\`;

  weekdayNames.forEach(day => {
    html += \`<div class="calendar-weekday">\${day}</div>\`;
  });
  html += \`</div><div class="calendar-days">\`;

  for(let i=0;i<startOffset;i++){
    html += \`<span class="calendar-day empty"></span>\`;
  }

  for(let day=1;day<=dayCount;day++){
    const date = new Date(year, month, day);
    const isoDate = formatDateInput(date);
    const selectedStart = dateRangeState.start === isoDate;
    const selectedEnd = dateRangeState.end === isoDate;
    const inRange = dateRangeState.start && dateRangeState.end && isoDate >= dateRangeState.start && isoDate <= dateRangeState.end;
    const classes = ["calendar-day", selectedStart ? "selected-start" : "", selectedEnd ? "selected-end" : "", inRange ? "in-range" : ""].filter(Boolean).join(" ");

    html += \`<button type="button" class="\${classes}" data-date="\${isoDate}">\${day}</button>\`;
  }

  html += \`</div>
      <div class="calendar-actions">
        <button type="button" id="calendarClear" class="secondary-btn">Clear</button>
        <button type="button" id="calendarCancel" class="ghost-btn">Cancel</button>
        <button type="button" id="calendarApply" class="primary-btn">Apply</button>
      </div>
    </div>
  \`;

  popup.innerHTML = html;

  const monthSelect = document.getElementById("calendarMonth");
  const yearSelect = document.getElementById("calendarYear");
  monthNames.forEach((name,index) => {
    const option = document.createElement("option");
    option.value = index;
    option.textContent = name;
    if(index === month) option.selected = true;
    monthSelect.append(option);
  });

  const currentYear = new Date().getFullYear();
  for(let offset = -5; offset <= 5; offset++){
    const yearOption = document.createElement("option");
    const value = currentYear + offset;
    yearOption.value = value;
    yearOption.textContent = value;
    if(value === year) yearOption.selected = true;
    yearSelect.append(yearOption);
  }

  monthSelect.addEventListener("change", () => {
    dateRangeState.viewMonth = Number(monthSelect.value);
    renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
  });

  yearSelect.addEventListener("change", () => {
    dateRangeState.viewYear = Number(yearSelect.value);
    renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
  });

  document.getElementById("calendarPrevMonth").addEventListener("click", () => {
    if(dateRangeState.viewMonth === 0){
      dateRangeState.viewMonth = 11;
      dateRangeState.viewYear -= 1;
    } else {
      dateRangeState.viewMonth -= 1;
    }
    renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
  });

  document.getElementById("calendarNextMonth").addEventListener("click", () => {
    if(dateRangeState.viewMonth === 11){
      dateRangeState.viewMonth = 0;
      dateRangeState.viewYear += 1;
    } else {
      dateRangeState.viewMonth += 1;
    }
    renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
  });

  popup.querySelectorAll(".calendar-day[data-date]").forEach(button => {
    button.addEventListener("click", () => {
      const selectedDate = button.dataset.date;
      if(!dateRangeState.start || (dateRangeState.start && dateRangeState.end)){
        dateRangeState.start = selectedDate;
        dateRangeState.end = null;
      }
      else if(selectedDate < dateRangeState.start){
        dateRangeState.end = dateRangeState.start;
        dateRangeState.start = selectedDate;
      }
      else {
        dateRangeState.end = selectedDate;
      }
      renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
      updateDateRangeButton();
    });
  });

  document.getElementById("calendarApply").addEventListener("click", () => {
    if(dateRangeState.start && !dateRangeState.end){
      dateRangeState.end = dateRangeState.start;
    }
    renderOrders();
    closeDateRangePopup();
  });

  document.getElementById("calendarCancel").addEventListener("click", () => {
    closeDateRangePopup();
  });

  document.getElementById("calendarClear").addEventListener("click", () => {
    dateRangeState.start = null;
    dateRangeState.end = null;
    updateDateRangeButton();
    renderOrders();
    renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
  });
}

function openDateRangePopup(){
  const popup = document.getElementById("dateRangePopup");
  popup.classList.remove("hidden");
  popup.setAttribute("aria-hidden","false");
  renderCalendar(dateRangeState.viewYear, dateRangeState.viewMonth);
}

function closeDateRangePopup(){
  const popup = document.getElementById("dateRangePopup");
  popup.classList.add("hidden");
  popup.setAttribute("aria-hidden","true");
}

function initializeDateRangePicker(){
  document.getElementById("dateRangeButton").addEventListener("click", event => {
    event.stopPropagation();
    openDateRangePopup();
  });

  const popup = document.getElementById("dateRangePopup");
  popup.addEventListener("click", event => event.stopPropagation());

  document.addEventListener("click", () => {
    if(!popup.classList.contains("hidden")) closeDateRangePopup();
  });

  updateDateRangeButton();
}

function renderOrders(){
  const container = document.getElementById("orders-container");
  
  let filteredOrders = currentOrders;
  if(dateRangeState.start && dateRangeState.end){
    filteredOrders = currentOrders.filter(order => {
      const orderIso = formatDateInput(order.order_date);
      return orderIso && orderIso >= dateRangeState.start && orderIso <= dateRangeState.end;
    });
  }
  
  if(!filteredOrders.length){
    container.innerHTML = \`<div class="empty-state"><h2>No orders yet</h2><p>You have not placed any orders yet, or no orders match the selected date range.</p><a href="LISTINGPAGE.HTML" class="primary-link">Browse Products</a></div>\`;
    return;
  }

  container.innerHTML = filteredOrders.map((order, index) => {
    const items = Array.isArray(order.medicines) ? order.medicines : [];
    const medicineList = items.map(item => \`
    <li class="order-item">
    <img src="\${item.image && item.image !== 'default.png' ? escapeHtml(item.image) : 'placeholder-med.png'}" alt="\${escapeHtml(item.medicine_name || "Product")}">
    <div>
    <strong>\${escapeHtml(item.medicine_name || "Medicine")}</strong>
    <p>Qty: \${item.quantity || 1} | \${formatCurrency(item.price)}</p>
    </div>
    </li>
    \`).join("");

    const orderStatus = getOrderStatusText(order);
    const isActive = ["Pending", "Accepted", "Out for Delivery"].includes(orderStatus);
    let pinMarkup = "";
    if (isActive && order.deliveryPin) {
        pinMarkup = \`
        <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #be123c; margin: 0 0 4px 0;">Delivery PIN: <span style="font-size: 18px; letter-spacing: 2px;">\${escapeHtml(order.deliveryPin)}</span></p>
            <p style="font-size: 12px; color: #be123c; margin: 0; font-weight: 500;">Security Notice: DO NOT share this PIN over the phone or any external source. Disclose only to the delivery executive at your doorstep.</p>
        </div>
        \`;
    }

    let contactMarkup = "";
    if (orderStatus === "Out for Delivery" && order.deliveryDetails && order.deliveryDetails.assignedDriverName) {
        contactMarkup = \`
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #166534; margin: 0 0 4px 0;">Delivery Executive:</p>
            <p style="font-size: 14px; color: #15803d; margin: 0 0 2px 0;">Name: <strong>\${escapeHtml(order.deliveryDetails.assignedDriverName)}</strong></p>
            <p style="font-size: 14px; color: #15803d; margin: 0;">Phone: <strong>\${escapeHtml(order.deliveryDetails.assignedDriverPhone)}</strong></p>
        </div>
        \`;
    } else if (orderStatus === "Pending" || orderStatus === "Accepted") {
        contactMarkup = \`
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; margin: 12px 0;">
            <p style="font-size: 14px; font-weight: 600; color: #1e3a8a; margin: 0 0 4px 0;">Contact ADM Pharmacy</p>
            <p style="font-size: 14px; color: #1d4ed8; margin: 0 0 2px 0;">Phone: <strong>1-800-ADM-PHARMACY</strong></p>
            <p style="font-size: 12px; color: #1e40af; margin: 0;">Your delivery partner will be assigned once the order is ready.</p>
        </div>
        \`;
    }

    return \`
    <article class="order-card">
    <div class="order-top">
    <div>
    <p class="order-label">Order Date</p>
    <h3>\${formatDate(order.order_date)}</h3>
    <p>Order Time: \${window.formatOrderTime ? window.formatOrderTime(order) : (order.orderTime || "")}</p>
    </div>
    <span class="status-pill \${getStatusClass(getOrderStatusText(order))}">\${escapeHtml(getOrderStatusText(order))}</span>
    </div>

    <div class="order-meta">
    <span>Total: \${formatCurrency(order.total_price)}</span>
    <span>Items: \${items.length}</span>
    <span>Estimated Delivery: \${escapeHtml(formatOrderEtaDisplay(order))}</span>
    <span>Prescription Status: \${escapeHtml(getPrescriptionStatusText(order))}</span>
    </div>

    \${contactMarkup}
    \${pinMarkup}

    <div class="products-block">
    <h4>Products</h4>
    <ul class="order-items">
    \${medicineList}
    </ul>
    </div>

    <div class="order-actions">
    <button type="button" class="track-btn secondary-track-btn" onclick="openProductDetails(\${index})">View Details</button>
    <button type="button" class="track-btn" onclick="trackOrder(\${index})">Track Order</button>
    </div>
    </article>
    \`;
  }).join("");
}
`;

// Replace loadOrders logic
const oldLoadOrdersStr = \`async function loadOrders(){
const container = document.getElementById("orders-container");

try{
const userOrders = await window.fetchJson(
\${BASE_URL}/api/orders?buyer_email=\${encodeURIComponent(buyerEmail)},
{},
"Server error or invalid response"
);

if (JSON.stringify(userOrders) === JSON.stringify(currentOrders)) {
  return;
}
currentOrders = userOrders;

if(!userOrders.length){
container.innerHTML = \\\`
<div class="empty-state">
<h2>No orders yet</h2>
<p>You have not placed any orders yet. Browse products and your next order will appear here.</p>
<a href="LISTINGPAGE.HTML" class="primary-link">Browse Products</a>
</div>
\\\`;
return;
}

container.innerHTML = userOrders.map((order, index) => {
const items = Array.isArray(order.medicines) ? order.medicines : [];
const medicineList = items.map(item => \\\`
<li class="order-item">
<img src="\${item.image && item.image !== 'default.png' ? escapeHtml(item.image) : 'placeholder-med.png'}" alt="\${escapeHtml(item.medicine_name || "Product")}">
<div>
<strong>\${escapeHtml(item.medicine_name || "Medicine")}</strong>
<p>Qty: \${item.quantity || 1} | \${formatCurrency(item.price)}</p>
</div>
</li>
\\\`).join("");

const orderStatus = getOrderStatusText(order);
const isActive = ["Pending", "Accepted", "Out for Delivery"].includes(orderStatus);
let pinMarkup = "";
if (isActive && order.deliveryPin) {
    pinMarkup = \\\`
    <div style="background: #fff1f2; border: 1px solid #fecdd3; padding: 12px; border-radius: 8px; margin: 12px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #be123c; margin: 0 0 4px 0;">Delivery PIN: <span style="font-size: 18px; letter-spacing: 2px;">\${escapeHtml(order.deliveryPin)}</span></p>
        <p style="font-size: 12px; color: #be123c; margin: 0; font-weight: 500;">Security Notice: DO NOT share this PIN over the phone or any external source. Disclose only to the delivery executive at your doorstep.</p>
    </div>
    \\\`;
}

let contactMarkup = "";
if (orderStatus === "Out for Delivery" && order.deliveryDetails && order.deliveryDetails.assignedDriverName) {
    contactMarkup = \\\`
    <div style="background: #f0fdf4; border: 1px solid #bbf7d0; padding: 12px; border-radius: 8px; margin: 12px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #166534; margin: 0 0 4px 0;">Delivery Executive:</p>
        <p style="font-size: 14px; color: #15803d; margin: 0 0 2px 0;">Name: <strong>\${escapeHtml(order.deliveryDetails.assignedDriverName)}</strong></p>
        <p style="font-size: 14px; color: #15803d; margin: 0;">Phone: <strong>\${escapeHtml(order.deliveryDetails.assignedDriverPhone)}</strong></p>
    </div>
    \\\`;
} else if (orderStatus === "Pending" || orderStatus === "Accepted") {
    contactMarkup = \\\`
    <div style="background: #eff6ff; border: 1px solid #bfdbfe; padding: 12px; border-radius: 8px; margin: 12px 0;">
        <p style="font-size: 14px; font-weight: 600; color: #1e3a8a; margin: 0 0 4px 0;">Contact ADM Pharmacy</p>
        <p style="font-size: 14px; color: #1d4ed8; margin: 0 0 2px 0;">Phone: <strong>1-800-ADM-PHARMACY</strong></p>
        <p style="font-size: 12px; color: #1e40af; margin: 0;">Your delivery partner will be assigned once the order is ready.</p>
    </div>
    \\\`;
}

return \\\`
<article class="order-card">
<div class="order-top">
<div>
<p class="order-label">Order Date</p>
<h3>\${formatDate(order.order_date)}</h3>
<p>Order Time: \${window.formatOrderTime ? window.formatOrderTime(order) : (order.orderTime || "")}</p>
</div>
<span class="status-pill \${getStatusClass(getOrderStatusText(order))}">\${escapeHtml(getOrderStatusText(order))}</span>
</div>

<div class="order-meta">
<span>Total: \${formatCurrency(order.total_price)}</span>
<span>Items: \${items.length}</span>
<span>Estimated Delivery: \${escapeHtml(formatOrderEtaDisplay(order))}</span>
<span>Prescription Status: \${escapeHtml(getPrescriptionStatusText(order))}</span>
</div>

\${contactMarkup}
\${pinMarkup}



<div class="products-block">
<h4>Products</h4>
<ul class="order-items">
\${medicineList}
</ul>
</div>

<div class="order-actions">
<button type="button" class="track-btn secondary-track-btn" onclick="openProductDetails(\${index})">View Details</button>
<button type="button" class="track-btn" onclick="trackOrder(\${index})">Track Order</button>
</div>
</article>
\\\`;
}).join("");
}
catch(err){
console.error("Error loading orders:", err);
container.innerHTML = \\\`
<div class="empty-state">
<h2>Unable to load orders</h2>
<p>\${window.getApiErrorMessage(err)}</p>
</div>
\\\`;
}
}\`;

const newLoadOrdersStr = \`async function loadOrders(){
  const container = document.getElementById("orders-container");

  try{
    const userOrders = await window.fetchJson(
      \${BASE_URL}/api/orders?buyer_email=\${encodeURIComponent(buyerEmail)},
      {},
      "Server error or invalid response"
    );

    if (JSON.stringify(userOrders) === JSON.stringify(currentOrders)) {
      return;
    }
    currentOrders = userOrders;
    renderOrders();
  }
  catch(err){
    console.error("Error loading orders:", err);
    container.innerHTML = \\\`<div class="empty-state"><h2>Unable to load orders</h2><p>\${window.getApiErrorMessage(err)}</p></div>\\\`;
  }
}\`;

html = html.replace(oldLoadOrdersStr, newLoadOrdersStr + "\\n\\n" + calendarJs);

html = html.replace("loadOrders();", "initializeDateRangePicker();\\nloadOrders();");

fs.writeFileSync('public/ORDERS.HTML', html);
