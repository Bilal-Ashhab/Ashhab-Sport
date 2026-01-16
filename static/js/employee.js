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

export async function initEmployee(){
  const sess = await requireRole("employee");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  qs("#who").textContent = sess.name;
  renderOrders();
}