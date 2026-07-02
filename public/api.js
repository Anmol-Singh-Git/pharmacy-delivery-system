// Intercept all outgoing fetch requests to automatically inject JWT authentication headers
(function() {
  const originalFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    const token = localStorage.getItem("token");
    if (token) {
      options.headers = options.headers || {};
      if (options.headers instanceof Headers) {
        options.headers.set("Authorization", `Bearer ${token}`);
      } else if (Array.isArray(options.headers)) {
        const hasAuth = options.headers.some(h => h[0].toLowerCase() === 'authorization');
        if (!hasAuth) {
          options.headers.push(["Authorization", `Bearer ${token}`]);
        }
      } else {
        options.headers["Authorization"] = `Bearer ${token}`;
      }
    }
    return originalFetch(url, options);
  };
})();

// Dynamic base URL for local development and Vercel production
window.API_BASE = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost') ? 'http://localhost:5000' : '';

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

  try {
    const token = localStorage.getItem('token');
    if (token) {
      options.headers = {
        ...options.headers,
        "Authorization": `Bearer ${token}`
      };
    }
  } catch(e) {
    console.warn("Storage access failed for token", e);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch (networkError) {
    console.error(`Network Fetch Error for ${url}:`, networkError);
    throw new Error("Network request failed: " + networkError.message);
  }

  const data = await window.parseJsonResponse(response);

  if (!response.ok) {
    console.error(`Server dropped request to ${url}. Status code: ${response.status}`);
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

    let buyerEmail = null;
    let sellerEmail = null;
    let cartLabel = "Cart";

    try {
      buyerEmail = localStorage.getItem("buyer_email");
      sellerEmail = localStorage.getItem("seller_email");
      cartLabel = window.getCartNavLabel ? window.getCartNavLabel() : "Cart";
    } catch (storageErr) {
      console.warn("Storage access failed, falling back to anonymous view", storageErr);
    }

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
          <img src="./images/logo.png" class="site-logo" alt="meddeliver logo">
        </a>
        <div id="navbar-search-container"></div>
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

window.isAuthenticated = function() {
  return !!(localStorage.getItem("token") && localStorage.getItem("buyer_email"));
};

window.requireAuth = function(callback) {
  if (window.isAuthenticated()) {
    return callback();
  }
  
  // Build and show auth modal if not authenticated
  const modalHtml = `
    <div id="authGuardModal" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(15, 23, 42, 0.75);display:flex;align-items:center;justify-content:center;z-index:9999;backdrop-filter:blur(4px);opacity:0;transition:opacity 0.2s ease;">
      <div style="background:#fff;padding:32px;border-radius:24px;max-width:400px;width:90%;box-shadow:0 24px 48px rgba(0,0,0,0.2);text-align:center;transform:translateY(20px);transition:transform 0.3s ease;">
        <div style="background:#fef3c7;color:#b45309;width:56px;height:56px;border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 16px;font-size:24px;">🔒</div>
        <h3 style="margin:0 0 12px;font-size:22px;color:#0f172a;">Login Required</h3>
        <p style="margin:0 0 24px;color:#475569;font-size:15px;line-height:1.6;">Sign up or log in as a buyer first to manage your cart and place orders.</p>
        <div style="display:flex;gap:12px;justify-content:center;">
          <button onclick="document.getElementById('authGuardModal').remove()" style="padding:12px 20px;border:none;background:#f1f5f9;color:#475569;border-radius:12px;font-weight:600;cursor:pointer;flex:1;">Cancel</button>
          <button onclick="window.location.href='LOGINPAGE.HTML'" style="padding:12px 20px;border:none;background:#0f6c78;color:#fff;border-radius:12px;font-weight:600;cursor:pointer;flex:1;">Login Now</button>
        </div>
      </div>
    </div>
  `;
  
  const div = document.createElement("div");
  div.innerHTML = modalHtml;
  document.body.appendChild(div.firstElementChild);
  
  // Trigger animation
  setTimeout(() => {
    const modal = document.getElementById('authGuardModal');
    if (modal) {
      modal.style.opacity = "1";
      modal.children[0].style.transform = "translateY(0)";
    }
  }, 10);
};
