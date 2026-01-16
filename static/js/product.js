import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, getSession, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

function getParam(name){
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

function unique(list){
  return Array.from(new Set(list));
}

export async function initProduct(){
  await injectLayout();
  wireLogout();

  const id = getParam("id");

  try {
    const p = await API.getProduct(id);

    qs("#pName").textContent = p.product_name;
    qs("#pDesc").textContent = p.description || "";
    qs("#pPrice").textContent = formatCurrency(p.price);
    qs("#pCat").textContent = p.category;

    const img = qs("#pImg");
    img.src = p.image_url;
    img.onerror = () => { img.src = "/assets/img/products/placeholder.jpg"; };

    const vars = p.variants;
    const sizes = unique(vars.map(v=>v.size));
    const colors = unique(vars.map(v=>v.color));

    const selSize = qs("#selSize");
    const selColor = qs("#selColor");

    selSize.innerHTML = sizes.map(s => `<option value="${s}">${s}</option>`).join("");
    selColor.innerHTML = colors.map(c => `<option value="${c}">${c}</option>`).join("");

    function refresh(){
      const v = vars.find(x => x.size === selSize.value && x.color === selColor.value);
      const stock = v ? v.stock_quantity : 0;
      qs("#pStock").textContent = stock > 0 ? `${stock} available` : "out of stock";
      qs("#btnAdd").disabled = !(v && stock > 0);
      qs("#btnAdd").dataset.variant = v ? String(v.variant_id) : "";
      qs("#btnAdd").dataset.product = String(p.product_id);
    }

    selSize.addEventListener("change", refresh);
    selColor.addEventListener("change", refresh);
    refresh();

    qs("#btnAdd").addEventListener("click", async ()=>{
      const sess = await getSession();
      if (!sess || sess.type !== "customer"){
        toast("Login needed", "Please login as customer.", "bad");
        setTimeout(()=> window.location.href="login.html", 650);
        return;
      }

      const productId = Number(qs("#btnAdd").dataset.product);
      const variantId = Number(qs("#btnAdd").dataset.variant || 0);
      const qty = Number(qs("#qty").value || 1);

      if (!variantId || qty <= 0){
        toast("Invalid", "Choose variant and quantity.", "bad");
        return;
      }

      try {
        await API.addToCart(productId, variantId, qty);
        toast("Added", "Added to cart. Checkout from My Account.", "ok");
      } catch (e) {
        toast("Error", e.message, "bad");
      }
    });
  } catch (e) {
    toast("Not found", "Product does not exist.", "bad");
    setTimeout(()=>window.location.href="main.html", 650);
  }
}