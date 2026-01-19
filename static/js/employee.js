import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, requireRole, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

async function acceptOrder(orderId){
  try {
    await API.acceptOrder(orderId);
    toast("Accepted", `Order #${orderId} accepted. Stock updated.`, "ok");
    renderOrders();
  } catch (e) {
    toast("Error", e.message, "bad");
  }
}

async function renderOrders(){
  try {
    const orders = await API.getOrders();

    const pending = orders.filter(o => o.status === 'Pending');
    const mine = orders.filter(o => o.status !== 'Pending');

    // Pending orders
    const pb = qs("#pendingBody");
    if (pb){
      if (!pending.length){
        pb.innerHTML = `<tr><td colspan="6" class="muted">No pending orders.</td></tr>`;
      } else {
        pb.innerHTML = pending.map(o=>`
          <tr>
            <td><strong>#${o.order_id}</strong></td>
            <td>${escapeHtml(o.customer_first + ' ' + o.customer_last)}</td>
            <td>${new Date(o.order_date).toLocaleString()}</td>
            <td><strong>${formatCurrency(o.total_amount)}</strong></td>
            <td><a class="btn" href="order.html?id=${o.order_id}">View</a></td>
            <td><button class="btn ok" data-accept="${o.order_id}">Accept</button></td>
          </tr>
        `).join("");

        pb.querySelectorAll("button[data-accept]").forEach(btn=>{
          btn.addEventListener("click", ()=>{
            acceptOrder(Number(btn.dataset.accept));
          });
        });
      }
    }

    // My orders
    const mb = qs("#mineBody");
    if (mb){
      if (!mine.length){
        mb.innerHTML = `<tr><td colspan="6" class="muted">No orders assigned yet.</td></tr>`;
      } else {
        mb.innerHTML = mine.map(o=>`
          <tr>
            <td><strong>#${o.order_id}</strong></td>
            <td>${escapeHtml(o.customer_first + ' ' + o.customer_last)}</td>
            <td>${escapeHtml(o.status)}</td>
            <td><strong>${formatCurrency(o.total_amount)}</strong></td>
            <td><a class="btn" href="order.html?id=${o.order_id}">Details</a></td>
            <td></td>
          </tr>
        `).join("");
      }
    }
  } catch (e) {
    toast("Error", "Failed to load orders", "bad");
  }
}

// =====================
// Profile Edit Functions
// =====================

async function loadProfile() {
  try {
    const profile = await API.getEmployeeProfile();

    qs("#profFirstName").value = profile.first_name || "";
    qs("#profLastName").value = profile.last_name || "";
    qs("#profEmail").value = profile.email || "";
    qs("#profUsername").value = profile.username || "";
    qs("#profPhone").value = profile.phone || "";
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
    phone: qs("#profPhone").value.trim()
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
    await API.updateEmployeeProfile(data);
    toast("Saved", "Profile updated successfully.", "ok");
    hideProfilePanel();

    // Update the welcome message with new name
    qs("#who").textContent = `${data.first_name} ${data.last_name}`;
  } catch (e) {
    toast("Error", e.message, "bad");
  }
}

export async function initEmployee(){
  const sess = await requireRole("employee");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  qs("#who").textContent = sess.name;
  renderOrders();

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