import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, getSession } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

let allProducts = [];

function productCard(p){
  const firstVar = (p.variants && p.variants[0]) ? p.variants[0].variant_id : null;
  const stock = (p.variants || []).reduce((s,v)=>s+Number(v.stock_quantity||0),0);
  return `
  <article class="card">
    <a class="img" href="product.html?id=${p.product_id}">
      <img src="${p.image_url}" alt="${escapeHtml(p.product_name)}" onerror="this.src='/assets/img/products/placeholder.jpg'">
      <span class="badge">${escapeHtml(p.category)} • ${stock > 0 ? stock + " in stock" : "out of stock"}</span>
    </a>
    <div class="body">
      <div class="titleRow">
        <h3>${escapeHtml(p.product_name)}</h3>
        <div class="price">${formatCurrency(p.price)}</div>
      </div>
      <p>${escapeHtml(p.description || "")}</p>
      <div class="actions">
        <a class="btn" href="product.html?id=${p.product_id}">View</a>
        <button class="btn primary" data-add="${p.product_id},${firstVar ?? ""}" ${firstVar ? "" : "disabled"}>Quick add</button>
      </div>
    </div>
  </article>
  `;
}

function renderProducts(products){
  const grid = qs("#productsGrid");
  if (!grid) return;
  if (!products.length){
    grid.innerHTML = `<div class="panel" style="grid-column:1/-1">No products found.</div>`;
    return;
  }
  grid.innerHTML = products.map(productCard).join("");
  wireQuickAdd(grid);
}

function wireQuickAdd(root){
  qsa("button[data-add]", root).forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const [productId, variantId] = btn.dataset.add.split(',').map(Number);
      if (!variantId) return;

      const sess = await getSession();
      if (!sess || sess.type !== "customer"){
        toast("Login needed", "Please login as customer to add to cart.", "bad");
        setTimeout(()=> window.location.href="login.html", 650);
        return;
      }

      try {
        await API.addToCart(productId, variantId, 1);
        toast("Added to cart", "Open My Account to checkout.", "ok");
      } catch (e) {
        toast("Error", e.message, "bad");
      }
    });
  });
}

function applyFilters(){
  const q = (qs("#searchInput")?.value || "").trim().toLowerCase();
  const cat = (qs("#categorySelect")?.value || "All");

  let filtered = allProducts.slice();
  if (cat && cat !== "All") filtered = filtered.filter(p => p.category === cat);
  if (q) filtered = filtered.filter(p =>
    (p.product_name||"").toLowerCase().includes(q) ||
    (p.description||"").toLowerCase().includes(q) ||
    (p.category||"").toLowerCase().includes(q)
  );

  renderProducts(filtered);

  const rec = allProducts.filter(p => p.featured).slice(0,6);
  const recWrap = qs("#recommendedGrid");
  if (recWrap) {
    recWrap.innerHTML = rec.map(productCard).join("");
    wireQuickAdd(recWrap);
  }
}

export async function initMain(){
  await injectLayout("home");
  wireLogout();

  try {
    // Load products
    allProducts = await API.getProducts();

    // Load categories
    const categories = await API.getCategories();
    const cats = ["All", ...categories];

    // Render category filters
    const chips = qs("#categoryChips");
    const select = qs("#categorySelect");

    if (chips && select) {
      cats.forEach((c, idx)=>{
        const chip = document.createElement("div");
        chip.className = "chip" + (idx===0 ? " active" : "");
        chip.textContent = c;
        chip.dataset.cat = c;
        chips.appendChild(chip);

        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        select.appendChild(opt);
      });
    }

    // Wire events
    qs("#searchInput")?.addEventListener("input", ()=>applyFilters());
    qs("#categorySelect")?.addEventListener("change", ()=>{
      const v = qs("#categorySelect").value;
      qsa(".chip").forEach(ch => ch.classList.toggle("active", ch.dataset.cat === v));
      applyFilters();
    });
    qs("#categoryChips")?.addEventListener("click", (e)=>{
      const chip = e.target.closest(".chip");
      if (!chip) return;
      const v = chip.dataset.cat;
      qsa(".chip").forEach(ch => ch.classList.toggle("active", ch===chip));
      const sel = qs("#categorySelect");
      if (sel) sel.value = v;
      applyFilters();
    });

    applyFilters();
  } catch (e) {
    toast("Error", "Failed to load products", "bad");
    console.error(e);
  }
}