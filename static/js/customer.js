import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, requireRole, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

async function renderCart(){
  const tbody = qs("#cartBody");
  const totalEl = qs("#cartTotal");
  if (!tbody) return;

  try {
    const items = await API.getCart();

    if (!items.length){
      tbody.innerHTML = `<tr><td colspan="6" class="muted">Your cart is empty.</td></tr>`;
      totalEl.textContent = formatCurrency(0);
      return;
    }

    let total = 0;
    tbody.innerHTML = items.map(item=>{
      const line = item.price * item.quantity;
      total += line;
      return `
        <tr>
          <td><strong>${escapeHtml(item.product_name)}</strong><div class="small">${escapeHtml(item.category)}</div></td>
          <td>${escapeHtml(item.size)} / ${escapeHtml(item.color)}</td>
          <td>${formatCurrency(item.price)}</td>
          <td><input data-qty="${item.cart_item_id}" value="${item.quantity}" style="width:90px"/></td>
          <td><strong>${formatCurrency(line)}</strong></td>
          <td><button class="btn danger" data-remove="${item.cart_item_id}">Remove</button></td>
        </tr>
      `;
    }).join("");

    totalEl.textContent = formatCurrency(total);

    // Wire qty change
    tbody.querySelectorAll("input[data-qty]").forEach(inp=>{
      inp.addEventListener("change", async ()=>{
        const id = Number(inp.dataset.qty);
        let q = Number(inp.value || 0);
        if (!Number.isFinite(q) || q <= 0) q = 1;
        try {
          await API.updateCartItem(id, q);
          renderCart();
        } catch (e) {
          toast("Error", e.message, "bad");
        }
      });
    });

    // Wire remove
    tbody.querySelectorAll("button[data-remove]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = Number(btn.dataset.remove);
        try {
          await API.deleteCartItem(id);
          renderCart();
        } catch (e) {
          toast("Error", e.message, "bad");
        }
      });
    });
  } catch (e) {
    toast("Error", "Failed to load cart", "bad");
  }
}

async function checkout(){
  try {
    const result = await API.createOrder();
    toast("Order placed", `Order #${result.order_id} is now pending.`, "ok");
    renderCart();
    renderOrders();
  } catch (e) {
    // If backend tells us payment info is required, send the user to the payment page.
    if (e?.data?.redirect === "payment-info") {
      window.location.href = "payment-info.html?required=1";
      return;
    }
    toast("Error", e.message, "bad");
  }
}

async function renderOrders(){
  const tbody = qs("#ordersBody");
  if (!tbody) return;

  try {
    const orders = await API.getOrders();

    if (!orders.length){
      tbody.innerHTML = `<tr><td colspan="5" class="muted">No orders yet.</td></tr>`;
      return;
    }

    tbody.innerHTML = orders.map(o=>`
      <tr>
        <td><strong>#${o.order_id}</strong></td>
        <td>${new Date(o.order_date).toLocaleString()}</td>
        <td>${escapeHtml(o.status)}</td>
        <td><strong>${formatCurrency(o.total_amount)}</strong></td>
        <td><a class="btn" href="order.html?id=${o.order_id}">Details</a></td>
      </tr>
    `).join("");
  } catch (e) {
    toast("Error", "Failed to load orders", "bad");
  }
}

// =====================
// Profile Edit Functions
// =====================

async function loadProfile() {
  try {
    const profile = await API.getCustomerProfile();

    qs("#profFirstName").value = profile.first_name || "";
    qs("#profLastName").value = profile.last_name || "";
    qs("#profEmail").value = profile.email || "";
    qs("#profPhone").value = profile.phone || "";
    qs("#profAddress").value = profile.address || "";
    qs("#profPassword").value = ""; // Always clear password field
  } catch (e) {
    toast("Error", "Failed to load profile", "bad");
  }
}

function showProfilePanel() {
  const panel = qs("#profilePanel");
  if (panel) {
    panel.style.display = "block";
    loadProfile();
  }
}

function hideProfilePanel() {
  const panel = qs("#profilePanel");
  if (panel) {
    panel.style.display = "none";
  }
}

async function saveProfile(e) {
  e.preventDefault();

  const data = {
    first_name: qs("#profFirstName").value.trim(),
    last_name: qs("#profLastName").value.trim(),
    email: qs("#profEmail").value.trim(),
    phone: qs("#profPhone").value.trim(),
    address: qs("#profAddress").value.trim()
  };

  // Only include password if user entered a new one
  const newPassword = qs("#profPassword").value;
  if (newPassword) {
    data.password = newPassword;
  }

  // Validation
  if (!data.first_name || !data.last_name || !data.email) {
    toast("Missing fields", "First name, last name, and email are required.", "bad");
    return;
  }

  try {
    await API.updateCustomerProfile(data);
    toast("Saved", "Profile updated successfully.", "ok");
    hideProfilePanel();

    // Update the welcome message with new name
    qs("#who").textContent = `${data.first_name} ${data.last_name}`;
  } catch (e) {
    toast("Error", e.message, "bad");
  }
}

export async function initCustomer(){
  const sess = await requireRole("customer");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  qs("#who").textContent = sess.name;

  renderCart();
  renderOrders();

  qs("#btnCheckout").addEventListener("click", ()=>checkout());

  // Wire profile edit buttons
  const btnEditProfile = qs("#btnEditProfile");
  const btnCloseProfile = qs("#btnCloseProfile");
  const btnCancelProfile = qs("#btnCancelProfile");
  const profileForm = qs("#profileForm");

  if (btnEditProfile) {
    btnEditProfile.addEventListener("click", showProfilePanel);
  }

  if (btnCloseProfile) {
    btnCloseProfile.addEventListener("click", hideProfilePanel);
  }

  if (btnCancelProfile) {
    btnCancelProfile.addEventListener("click", hideProfilePanel);
  }

  if (profileForm) {
    profileForm.addEventListener("submit", saveProfile);
  }
}

// =====================
// Payment Info page
// =====================

function normalizeCardNumber(raw){
  return String(raw || "").replace(/\s+/g, "").trim();
}

function formatCardNumberForInput(raw){
  const digits = normalizeCardNumber(raw).replace(/[^0-9]/g, "");
  // Group as 4-4-4-4 (keeps up to 19 digits for some cards)
  return digits.replace(/(.{4})/g, "$1 ").trim().slice(0, 19);
}

function validYear(y){
  return /^\d{4}$/.test(String(y || ""));
}

async function renderPaymentMethods(){
  const tbody = qs("#paymentsBody");
  const table = qs("#paymentsTable");
  const empty = qs("#noPayments");
  if (!tbody || !table || !empty) return;

  try {
    const list = await API.getPaymentInfo();

    if (!list.length){
      table.style.display = "none";
      empty.style.display = "block";
      return;
    }

    empty.style.display = "none";
    table.style.display = "table";

    tbody.innerHTML = list.map(p => {
      const masked = p.card_number_masked || (p.card_number ? ("**** **** **** " + String(p.card_number).slice(-4)) : "—");
      return `
        <tr>
          <td>${escapeHtml(p.card_type || "—")}</td>
          <td>${escapeHtml(p.card_holder_name || "—")}</td>
          <td>${escapeHtml(masked)}</td>
          <td>${escapeHtml(p.expiry_month || "")} / ${escapeHtml(p.expiry_year || "")}</td>
          <td>${p.is_default ? "Yes" : "—"}</td>
          <td>
            <button class="btn danger" data-paydel="${p.payment_info_id}">Delete</button>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll("button[data-paydel]").forEach(btn => {
      btn.addEventListener("click", async () => {
        const id = Number(btn.dataset.paydel);
        if (!Number.isFinite(id)) return;
        if (!confirm("Delete this payment method?") ) return;
        try {
          await API.deletePaymentInfo(id);
          toast("Deleted", "Payment method removed.", "ok");
          renderPaymentMethods();
        } catch (e) {
          toast("Error", e.message, "bad");
        }
      });
    });
  } catch (e) {
    toast("Error", "Failed to load payment methods", "bad");
  }
}

export async function initPaymentInfo(){
  const sess = await requireRole("customer");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  // Show the warning banner if the user arrived from checkout.
  const params = new URLSearchParams(window.location.search);
  const required = params.get("required") === "1";
  const alertBox = qs("#paymentRequiredAlert");
  if (alertBox && required) alertBox.style.display = "block";

  // Card number formatting as the user types
  const cardNumberEl = qs("#cardNumber");
  if (cardNumberEl) {
    cardNumberEl.addEventListener("input", () => {
      const before = cardNumberEl.value;
      cardNumberEl.value = formatCardNumberForInput(before);
    });
  }

  // Wire form submit
  const form = qs("#paymentForm");
  if (form) {
    form.addEventListener("submit", async (ev) => {
      ev.preventDefault();

      const card_type = qs("#cardType")?.value || "";
      const card_holder_name = (qs("#cardHolderName")?.value || "").trim();
      const card_number_raw = qs("#cardNumber")?.value || "";
      const card_number = normalizeCardNumber(card_number_raw).replace(/[^0-9]/g, "");
      const expiry_month = qs("#expiryMonth")?.value || "";
      const expiry_year = (qs("#expiryYear")?.value || "").trim();
      const cvv = (qs("#cvv")?.value || "").trim();
      const is_default = qs("#isDefault")?.checked ? 1 : 0;

      // Basic validation (backend will still validate/accept)
      if (!card_type || !card_holder_name || !card_number || !expiry_month || !expiry_year || !cvv) {
        toast("Missing info", "Please fill all fields.", "bad");
        return;
      }
      if (card_number.length < 12 || card_number.length > 19) {
        toast("Card number", "Card number looks invalid.", "bad");
        return;
      }
      if (!validYear(expiry_year)) {
        toast("Expiry year", "Use 4 digits (YYYY).", "bad");
        return;
      }
      if (!/^\d{3,4}$/.test(cvv)) {
        toast("CVV", "CVV must be 3–4 digits.", "bad");
        return;
      }

      try {
        await API.addPaymentInfo({
          card_type,
          card_holder_name,
          card_number,
          expiry_month,
          expiry_year,
          cvv,
          is_default
        });
        toast("Saved", "Payment method added.", "ok");
        form.reset();

        // If they came from checkout, send them back to the dashboard.
        if (required) {
          setTimeout(() => (window.location.href = "customer.html"), 450);
          return;
        }

        renderPaymentMethods();
      } catch (e) {
        toast("Error", e.message, "bad");
      }
    });
  }

  renderPaymentMethods();
}