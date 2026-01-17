import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, getSession, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

function getParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function render(o){
  qs("#oId").textContent = `#${o.order_id}`;
  qs("#oStatus").textContent = o.status;
  qs("#oCustomer").textContent = `${o.customer_first} ${o.customer_last}`;
  qs("#oDate").textContent = new Date(o.order_date).toLocaleString();
  qs("#oTotal").textContent = formatCurrency(o.total_amount);

  const tbody = qs("#itemsBody");
  tbody.innerHTML = o.items.map(it=>{
    const line = it.price * it.quantity;
    return `
      <tr>
        <td><strong>${escapeHtml(it.product_name)}</strong><div class="small">${escapeHtml(it.size)} / ${escapeHtml(it.color)}</div></td>
        <td>${formatCurrency(it.price)}</td>
        <td>${it.quantity}</td>
        <td><strong>${formatCurrency(line)}</strong></td>
      </tr>
    `;
  }).join("");
}

export async function initOrder(){
  await injectLayout();
  wireLogout();

  const sess = await getSession();
  const id = Number(getParam("id") || 0);

  try {
    const o = await API.getOrderDetail(id);
    render(o);

    const actions = qs("#orderActions");
    if (!actions) return;

    if (sess && sess.type === "employee") {
      // Only show Cancel button for employees
      actions.innerHTML = `
        <button class="btn danger" id="btnCancel">Cancel Order</button>
      `;

      qs("#btnCancel").addEventListener("click", async ()=>{
        if (!confirm("Are you sure you want to cancel this order?")) return;
        try {
          await API.updateOrderStatus(id, "Cancelled");
          toast("Updated", "Order cancelled.", "ok");
          const o2 = await API.getOrderDetail(id);
          render(o2);
        } catch (e) {
          toast("Error", e.message, "bad");
        }
      });
    } else {
      actions.innerHTML = `<a class="btn" href="${sess && sess.type==='customer' ? 'customer.html' : 'main.html'}">Back</a>`;
    }
  } catch (e) {
    toast("Error", e.message, "bad");
    setTimeout(()=> window.location.href="main.html", 650);
  }
}