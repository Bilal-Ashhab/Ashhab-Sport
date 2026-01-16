import { API } from './api.js';

export function formatCurrency(n) {
  const num = Number(n || 0);
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(num);
}

export function toast(title, message = "", type = "ok") {
  let wrap = document.querySelector(".toastWrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "toastWrap";
    document.body.appendChild(wrap);
  }
  const t = document.createElement("div");
  t.className = `toast ${type === "bad" ? "bad" : type === "ok" ? "ok" : ""}`;
  t.innerHTML = `
    <div class="t">${escapeHtml(title)}</div>
    ${message ? `<div class="m">${escapeHtml(message)}</div>` : ""}
  `;
  wrap.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateY(6px)";
    setTimeout(() => t.remove(), 220);
  }, 2200);
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

let currentSession = null;

export async function getSession() {
  if (!currentSession) {
    try {
      const data = await API.getSession();
      currentSession = data.logged_in ? data.user : null;
    } catch (e) {
      currentSession = null;
    }
  }
  return currentSession;
}

export function clearSessionCache() {
  currentSession = null;
}

export function roleLabel(sess) {
  if (!sess) return "Guest";
  if (sess.type === "customer") return "Customer";
  if (sess.type === "employee") return sess.role === "ADMIN" ? "Admin" : "Employee";
  return "User";
}

export async function injectLayout(active = "") {
  const sess = await getSession();
  const header = document.getElementById("appHeader");
  const footer = document.getElementById("appFooter");

  if (header) {
    header.innerHTML = `
      <header class="header">
        <div class="container">
          <div class="nav">
            <a class="brand" href="main.html">
              <span class="logo"></span>
              <span>Ashhab Sport</span>
            </a>

            <nav class="navlinks">
              <a href="main.html" ${active==="home" ? 'style="color:var(--text);background:rgba(255,255,255,.06)"' : ""}>Store</a>
              <a href="main.html#categories">Categories</a>
              <a href="main.html#recommended">Recommendations</a>
              <a href="main.html#contact">Contact</a>
            </nav>

            <div class="navright">
              <span class="pill"><strong>${roleLabel(sess)}</strong></span>
              ${navActions(sess)}
            </div>
          </div>
        </div>
      </header>
    `;
  }

  if (footer) {
    footer.innerHTML = `
      <footer class="footer">
        <div class="container">
          <div class="footerGrid">
            <div>
              <h4>Ashhab Sport</h4>
              <div class="small">Sportswear & streetwear store. Browse as a guest, or login to place orders.</div>
              <div class="small" style="margin-top:8px;">Ramallah • Palestine</div>
            </div>
            <div>
              <h4>Quick links</h4>
              <div class="small"><a href="main.html">Store</a></div>
              <div class="small"><a href="main.html#recommended">Recommendations</a></div>
              <div class="small"><a href="main.html#contact">Contact</a></div>
            </div>
            <div>
              <h4>Accounts</h4>
              ${footerAccounts(sess)}
            </div>
          </div>
        </div>
      </footer>
    `;
  }
}

function navActions(sess){
  if (!sess) {
    return `
      <a class="btn" href="login.html">Login</a>
      <a class="btn primary" href="signup.html">Sign up</a>
    `;
  }
  if (sess.type === "customer") {
    return `
      <a class="btn" href="customer.html">My Account</a>
      <button class="btn danger" id="btnLogout">Logout</button>
    `;
  }
  if (sess.type === "employee" && sess.role === "ADMIN") {
    return `
      <a class="btn" href="admin.html">Admin</a>
      <button class="btn danger" id="btnLogout">Logout</button>
    `;
  }
  return `
    <a class="btn" href="employee.html">Employee</a>
    <button class="btn danger" id="btnLogout">Logout</button>
  `;
}

function footerAccounts(sess){
  if (!sess) {
    return `
      <div class="small">Customer signup: <a href="signup.html">Create account</a></div>
      <div class="small">Staff login: <a href="login.html">Employee/Admin</a></div>
    `;
  }
  return `<div class="small">You are logged in. <a href="main.html">Go to store</a></div>`;
}

export function wireLogout(){
  const btn = document.getElementById("btnLogout");
  if (btn) {
    btn.addEventListener("click", async () => {
      try {
        await API.logout();
        clearSessionCache();
        toast("Logged out", "See you soon!", "ok");
        setTimeout(() => (window.location.href = "main.html"), 450);
      } catch (e) {
        toast("Error", "Logout failed", "bad");
      }
    });
  }
}

export async function requireRole(allowed) {
  const sess = await getSession();

  if (!sess) {
    toast("Login required", "Please login first.", "bad");
    setTimeout(() => (window.location.href = "login.html"), 650);
    return null;
  }

  if (allowed === "customer" && sess.type !== "customer") {
    toast("Access denied", "Customer account required.", "bad");
    setTimeout(() => (window.location.href = "main.html"), 650);
    return null;
  }

  if (allowed === "employee" && sess.type !== "employee") {
    toast("Access denied", "Employee login required.", "bad");
    setTimeout(() => (window.location.href = "main.html"), 650);
    return null;
  }

  if (allowed === "admin" && !(sess.type === "employee" && sess.role === "ADMIN")) {
    toast("Access denied", "Admin only.", "bad");
    setTimeout(() => (window.location.href = "main.html"), 650);
    return null;
  }

  return sess;
}