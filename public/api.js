// Intercept all outgoing fetch requests to automatically inject JWT authentication headers
// and manage global UI button loading states
(function() {
  let lastTriggeredButton = null;

  // Track the most recently clicked button
  document.addEventListener('click', function(e) {
    const btn = e.target.closest('button, input[type="submit"], input[type="button"], .btn');
    if (btn) {
      lastTriggeredButton = btn;
      setTimeout(() => {
        if (lastTriggeredButton === btn) lastTriggeredButton = null;
      }, 50);
    }
  }, true);

  // Track form submissions (e.g. hitting Enter)
  document.addEventListener('submit', function(e) {
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"], input[type="submit"], button:not([type="button"])');
    if (submitBtn) {
      lastTriggeredButton = submitBtn;
      setTimeout(() => {
        if (lastTriggeredButton === submitBtn) lastTriggeredButton = null;
      }, 50);
    }
  }, true);

  // Inject CSS for loading spinner
  const style = document.createElement('style');
  style.textContent = `
    .btn-loading-state {
      position: relative !important;
      pointer-events: none !important;
      opacity: 0.85 !important;
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      gap: 8px !important;
    }
    .btn-global-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: btn-spin 0.75s linear infinite;
      display: inline-block;
    }
    @keyframes btn-spin {
      to { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);

  const originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    const btn = lastTriggeredButton;
    let originalText = null;
    let originalWidth = null;

    if (btn && !btn.classList.contains('btn-loading-state') && !btn.disabled) {
      btn.classList.add('btn-loading-state');
      btn.disabled = true;
      originalText = btn.innerHTML;
      
      // Fix width to prevent UI jitter
      originalWidth = btn.offsetWidth;
      if (originalWidth > 0) {
          btn.style.width = originalWidth + 'px';
      }
      
      btn.innerHTML = '<span class="btn-global-spinner"></span> Processing...';
    }

    const token = localStorage.getItem("token");
    if (token) {
      options.headers = options.headers || {};
      if (options.headers instanceof Headers) {
        options.headers.set("Authorization", \`Bearer \${token}\`);
      } else if (Array.isArray(options.headers)) {
        const hasAuth = options.headers.some(h => h[0].toLowerCase() === 'authorization');
        if (!hasAuth) {
          options.headers.push(["Authorization", \`Bearer \${token}\`]);
        }
      } else {
        options.headers["Authorization"] = \`Bearer \${token}\`;
      }
    }

    try {
      return await originalFetch(url, options);
    } finally {
      if (btn && originalText !== null) {
        btn.innerHTML = originalText;
        btn.disabled = false;
        btn.style.width = '';
        btn.classList.remove('btn-loading-state');
      }
    }
  };
})();

// Dynamic base URL - automatically works on localhost, network IP, ngrok, or any domain
// This ensures the app works on: localhost:5000, 192.168.x.x:5000, ngrok URLs, and production domains
let baseOrigin = window.location.origin;

// If previewing locally via Live Server (which typically runs on ports like 5500, 5501)
// and the backend is on 5000, force API_BASE to point to the backend directly.
if (
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
  window.location.port && window.location.port !== "5000"
) {
  baseOrigin = `${window.location.protocol}//${window.location.hostname}:5000`;
}

window.API_BASE = baseOrigin;

window.getCartItemKey = function(item = {}) {
  return String(
    item.medicine_id ||
    item._id ||
    [item.medicine_name || "", item.seller_email || ""].join("::")
  );
};

window.getDistinctCartCount = function() {
  try {
    const cart = JSON.parse(localStorage.getItem("cart")) || [];
    return new Set(cart.map(window.getCartItemKey).filter(Boolean)).size;
  } catch (error) {
    console.error("Unable to read cart count:", error);
    return 0;
  }
};

window.getCartNavLabel = function() {
  return `Cart (${window.getDistinctCartCount()})`;
};

window.refreshCartNavLabel = function() {
  document.querySelectorAll('.navbar nav a[href="CARTPAGE.HTML"]').forEach(link => {
    link.textContent = window.getCartNavLabel();
  });
};

window.parseJsonResponse = async function(response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch (err) {
    console.error("Invalid JSON:", text);
    throw new Error("Server did not return JSON");
  }
};

window.getApiErrorMessage = function(error, fallbackMessage = "Server error or invalid response") {
  if (!error) {
    return fallbackMessage;
  }

  if (error.message === "Server did not return JSON") {
    return fallbackMessage;
  }

  return error.message || fallbackMessage;
};

window.fetchJson = async function(url, options = {}, fallbackMessage = "Server error or invalid response") {
  console.log("Calling API...", url);

  const token = localStorage.getItem('token');
  if (token) {
    options.headers = {
      ...options.headers,
      "Authorization": `Bearer ${token}`
    };
  }

  const response = await fetch(url, options);
  const data = await window.parseJsonResponse(response);

  if (!response.ok) {
    throw new Error(
      (data && (data.message || data.error)) || fallbackMessage
    );
  }

  return data;
};

// Global helper functions
function formatETA(eta) {
  const s = eta == null ? "" : String(eta).trim();
  if (!s || /^calculating/i.test(s)) {
    return "Location unavailable";
  }
  return s;
}

function formatDistance(d) {
  const n = Number(d);
  return Number.isFinite(n) ? n.toFixed(1) + " km" : "N/A";
}

// Attach to window for global access
window.formatETA = formatETA;
window.formatDistance = formatDistance;

/**
 * Format an order's time in the user's local timezone.
 * Prefers orderTimestamp (ISO string) > order_date/createdAt (Date) > orderTime (pre-formatted fallback).
 */
function formatOrderTime(order) {
  const raw = order.orderTimestamp || order.order_date || order.createdAt;
  if (raw) {
    const d = new Date(raw);
    if (!isNaN(d.getTime())) {
      return d.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true
      });
    }
  }
  return order.orderTime || "—";
}
window.formatOrderTime = formatOrderTime;

window.MD_LAT_KEY = "md_user_lat";
window.MD_LNG_KEY = "md_user_lng";

window.readMedDeliverStoredCoords = function readMedDeliverStoredCoords() {
  const lat = Number(localStorage.getItem(window.MD_LAT_KEY));
  const lng = Number(localStorage.getItem(window.MD_LNG_KEY));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { latitude: lat, longitude: lng };
  }
  return null;
};

window.calculateDistance = function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

window.getBuyerLatLngForEta = function getBuyerLatLngForEta() {
  let lat = Number(localStorage.getItem("lat"));
  let lng = Number(localStorage.getItem("lng"));
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng };
  }
  const r = window.readMedDeliverStoredCoords && window.readMedDeliverStoredCoords();
  if (r && Number.isFinite(r.latitude) && Number.isFinite(r.longitude)) {
    return { lat: r.latitude, lng: r.longitude };
  }
  try {
    const bp = JSON.parse(localStorage.getItem("buyer_profile") || "{}");
    const loc = bp.location;
    lat = Number(loc?.latitude ?? loc?.lat);
    lng = Number(loc?.longitude ?? loc?.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      return { lat, lng };
    }
  } catch (e) {
    /* ignore */
  }
  return null;
};

window.sellerLatLngFromProductData = function sellerLatLngFromProductData(sellerDetails) {
  if (!sellerDetails || typeof sellerDetails !== "object") {
    return null;
  }
  const lat = Number(
    sellerDetails.latitude ??
      sellerDetails.lat ??
      sellerDetails.location?.latitude ??
      sellerDetails.location?.lat
  );
  const lng = Number(
    sellerDetails.longitude ??
      sellerDetails.lng ??
      sellerDetails.location?.longitude ??
      sellerDetails.location?.lng
  );
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null;
  }
  return { lat, lng };
};

window.hydrateBuyerCoordsFromServer = async function hydrateBuyerCoordsFromServer() {
  if (window.getBuyerLatLngForEta && window.getBuyerLatLngForEta()) {
    return true;
  }
  const email = localStorage.getItem("buyer_email");
  if (!email) {
    return false;
  }
  try {
    const response = await fetch(
      `${window.API_BASE}/api/buyer-coords/${encodeURIComponent(email)}`
    );
    const data = await window.parseJsonResponse(response);
    if (!response.ok || !data || !data.success) {
      return false;
    }
    const lat = Number(data.latitude);
    const lng = Number(data.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return false;
    }
    try {
      localStorage.setItem("lat", String(lat));
      localStorage.setItem("lng", String(lng));
      localStorage.setItem(window.MD_LAT_KEY, String(lat));
      localStorage.setItem(window.MD_LNG_KEY, String(lng));
    } catch (e) {
      /* ignore */
    }
    try {
      const bp = JSON.parse(localStorage.getItem("buyer_profile") || "{}");
      bp.location = { latitude: lat, longitude: lng };
      localStorage.setItem("buyer_profile", JSON.stringify(bp));
    } catch (e) {
      /* ignore */
    }
    return true;
  } catch (e) {
    return false;
  }
};

window.computeEtaLabelForCartOrCheckout = function computeEtaLabelForCartOrCheckout(items) {
  const buyer = window.getBuyerLatLngForEta && window.getBuyerLatLngForEta();
  if (!buyer) {
    return "Location unavailable";
  }
  let maxKm = 0;
  let any = false;
  const seen = new Set();
  for (const item of items || []) {
    const key = String(item.seller_email || "").toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    const sl = window.sellerLatLngFromProductData(item.seller_details);
    if (!sl) {
      continue;
    }
    seen.add(key);
    any = true;
    const d = window.calculateDistance(buyer.lat, buyer.lng, sl.lat, sl.lng);
    if (Number.isFinite(d) && d > maxKm) {
      maxKm = d;
    }
  }
  if (!any) {
    return "Location unavailable";
  }
  const etaMin = Math.round(maxKm * 10);
  const etaMax = Math.round(maxKm * 15);
  return `${etaMin} - ${etaMax} mins`;
};

window.syncMedDeliverDeviceLocation = function syncMedDeliverDeviceLocation() {
  const buyerEmail = localStorage.getItem("buyer_email");
  const sellerEmail = localStorage.getItem("seller_email");
  const email = buyerEmail || sellerEmail;
  const role = buyerEmail ? "buyer" : "seller";
  if (!email || !navigator.geolocation) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const latitude = pos.coords.latitude;
        const longitude = pos.coords.longitude;
        try {
          localStorage.setItem(window.MD_LAT_KEY, String(latitude));
          localStorage.setItem(window.MD_LNG_KEY, String(longitude));
          localStorage.setItem("lat", String(latitude));
          localStorage.setItem("lng", String(longitude));
        } catch (e) {
          /* ignore */
        }

        if (buyerEmail) {
          try {
            const bp = JSON.parse(localStorage.getItem("buyer_profile") || "{}");
            bp.location = { latitude, longitude };
            localStorage.setItem("buyer_profile", JSON.stringify(bp));
          } catch (e) {
            /* ignore */
          }
        }

        try {
          await fetch(`${window.API_BASE}/api/update-location`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role, latitude, longitude })
          });
        } catch (e) {
          /* ignore — non-blocking */
        }
        resolve();
      },
      () => resolve(),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 120000 }
    );
  });
};

window.renderGlobalNavbar = function renderGlobalNavbar(activePage = "") {
  try {
    const navElement = document.getElementById("navbar") || document.getElementById("main-header");
    if (!navElement) return;

    const buyerEmail = localStorage.getItem("buyer_email");
    const sellerEmail = localStorage.getItem("seller_email");
    const cartLabel = window.getCartNavLabel ? window.getCartNavLabel() : "Cart";

    let linksHtml = "";
    if (!buyerEmail && !sellerEmail) {
      linksHtml = `
        <a href="HOMEPAGE.HTML" class="${activePage === 'home' ? 'active' : ''}">Home</a>
        <a href="LISTINGPAGE.HTML" class="${activePage === 'browse' ? 'active' : ''}">Browse</a>
        <a href="LOGINPAGE.HTML">Login</a>
        <a href="REGISTERPAGE.HTML">Register</a>
      `;
    } else if (buyerEmail) {
      linksHtml = `
        <a href="HOMEPAGE.HTML" class="${activePage === 'home' ? 'active' : ''}">Home</a>
        <a href="LISTINGPAGE.HTML" class="${activePage === 'browse' ? 'active' : ''}">Browse</a>
        <a href="CARTPAGE.HTML" class="${activePage === 'cart' ? 'active' : ''}">${cartLabel}</a>
        <a href="ORDERS.HTML" class="${activePage === 'orders' ? 'active' : ''}">Orders</a>
        <a href="#" onclick="window.logout(); return false;">Logout</a>
      `;
    } else {
      linksHtml = `
        <a href="SELLER-DASHBOARD.HTML" class="${activePage === 'dashboard' ? 'active' : ''}">Dashboard</a>
        <a href="#" onclick="window.logout(); return false;">Logout</a>
      `;
    }

    navElement.innerHTML = `
      <header class="navbar">
        <a href="HOMEPAGE.HTML" class="logo-container">
          <img src="/images/logo.png" class="site-logo" alt="meddeliver logo">
        </a>
        <nav>
          ${linksHtml}
        </nav>
      </header>
    `;
  } catch (err) {
    console.error("Critical error in window.loadNavbar:", err);
  }
};

window.logout = function logout() {
  localStorage.clear();
  window.location.href = "LOGINPAGE.HTML";
};
