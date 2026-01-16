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

export async function initCustomer(){
  const sess = await requireRole("customer");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  qs("#who").textContent = sess.name;

  renderCart();
  renderOrders();

  qs("#btnCheckout").addEventListener("click", ()=>checkout());
}