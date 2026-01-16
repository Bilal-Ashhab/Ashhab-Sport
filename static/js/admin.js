import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, requireRole, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

// ==================== DASHBOARD ====================
export async function initAdminDashboard(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  qs("#who").textContent = sess.name;

  // Load stats
  try {
    const stats = await API.getAdminStats();
    qs("#totalSales").textContent = formatCurrency(stats.total_sales);
    qs("#totalPurchases").textContent = formatCurrency(stats.total_purchases);
    qs("#netEarnings").textContent = formatCurrency(stats.net_earnings);
    qs("#totalOrders").textContent = stats.total_orders;
    qs("#pendingOrders").textContent = stats.pending_orders;
    qs("#acceptedOrders").textContent = stats.accepted_orders;
    qs("#shippedOrders").textContent = stats.shipped_orders;
    qs("#totalProducts").textContent = stats.total_products;
  } catch (e) {
    console.error("Stats error:", e);
    toast("Error", "Failed to load statistics", "bad");
  }

  // Load top products
  try {
    const topProducts = await API.getTopProducts(10);
    const tbody = qs("#topProductsBody");

    if (!topProducts.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No sales data yet.</td></tr>';
    } else {
      tbody.innerHTML = topProducts.map((p, idx) => {
        return '<tr>' +
          '<td><strong>#' + (idx + 1) + '</strong></td>' +
          '<td><strong>' + escapeHtml(p.product_name) + '</strong></td>' +
          '<td>' + escapeHtml(p.category) + '</td>' +
          '<td><strong>' + p.total_sold + '</strong> units</td>' +
          '<td><strong>' + formatCurrency(p.total_revenue) + '</strong></td>' +
          '<td><a class="btn" href="product.html?id=' + p.product_id + '">View</a></td>' +
        '</tr>';
      }).join("");
    }
  } catch (e) {
    console.error("Top products error:", e);
    toast("Error", "Failed to load top products", "bad");
  }

  // Load recent orders
  try {
    const orders = await API.getOrders();
    const tbody = qs("#recentOrdersBody");
    const recent = orders.slice(0, 5);

    if (!recent.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="muted">No orders yet.</td></tr>';
    } else {
      tbody.innerHTML = recent.map(o => {
        const customerName = (o.customer_first || '') + ' ' + (o.customer_last || '');
        const orderDate = new Date(o.order_date).toLocaleDateString();
        return '<tr>' +
          '<td><strong>#' + o.order_id + '</strong></td>' +
          '<td>' + escapeHtml(customerName) + '</td>' +
          '<td>' + orderDate + '</td>' +
          '<td><span class="pill">' + escapeHtml(o.status) + '</span></td>' +
          '<td><strong>' + formatCurrency(o.total_amount) + '</strong></td>' +
          '<td><a class="btn" href="order.html?id=' + o.order_id + '">View</a></td>' +
        '</tr>';
      }).join("");
    }
  } catch (e) {
    console.error("Orders error:", e);
    toast("Error", "Failed to load orders", "bad");
  }
}

// ==================== EMPLOYEES ====================
export async function initAdminEmployees(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  async function renderEmployees(){
    try {
      const emps = await API.getEmployees();
      const tbody = qs("#empBody");

      tbody.innerHTML = emps.map(e => {
        const deleteBtn = e.username === "admin" ? '-' :
          '<button class="btn danger" data-del="' + e.employee_id + '">Delete</button>';

        return '<tr>' +
          '<td><strong>#' + e.employee_id + '</strong></td>' +
          '<td>' + escapeHtml(e.first_name) + ' ' + escapeHtml(e.last_name) + '</td>' +
          '<td>' + escapeHtml(e.username) + '</td>' +
          '<td>' + escapeHtml(e.email) + '</td>' +
          '<td>' + escapeHtml(e.phone || '-') + '</td>' +
          '<td><span class="pill">' + escapeHtml(e.role) + '</span></td>' +
          '<td>' + formatCurrency(e.salary || 0) + '</td>' +
          '<td>' + deleteBtn + '</td>' +
        '</tr>';
      }).join("");

      tbody.querySelectorAll("button[data-del]").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to delete this employee?")) return;

          try {
            await API.deleteEmployee(Number(btn.dataset.del));
            toast("Deleted", "Employee removed.", "ok");
            renderEmployees();
          } catch (e) {
            toast("Error", e.message, "bad");
          }
        });
      });
    } catch (e) {
      console.error("Employees error:", e);
      toast("Error", "Failed to load employees", "bad");
    }
  }

  const form = qs("#empForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      first_name: qs("#efirst").value.trim(),
      last_name: qs("#elast").value.trim(),
      email: qs("#eemail").value.trim(),
      username: qs("#euser").value.trim(),
      password: qs("#epass").value,
      role: qs("#erole").value,
      phone: qs("#ephone").value.trim()
    };

    if (!data.first_name || !data.last_name || !data.email || !data.username || !data.password) {
      toast("Missing fields", "Fill all required fields.", "bad");
      return;
    }

    try {
      await API.createEmployee(data);
      form.reset();
      toast("Added", "Employee created successfully.", "ok");
      renderEmployees();
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  });

  renderEmployees();
}

// ==================== PRODUCTS ====================
export async function initAdminProducts(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  let allProducts = [];

  async function renderProducts(filter){
    filter = filter || "";
    try {
      allProducts = await API.getProducts();
      const tbody = qs("#productsBody");

      const filtered = filter ?
        allProducts.filter(p =>
          p.product_name.toLowerCase().includes(filter.toLowerCase()) ||
          p.category.toLowerCase().includes(filter.toLowerCase())
        ) : allProducts;

      tbody.innerHTML = filtered.map(p => {
        const featuredText = p.featured ? '⭐ Yes' : 'No';
        return '<tr>' +
          '<td><strong>#' + p.product_id + '</strong></td>' +
          '<td>' +
            '<strong>' + escapeHtml(p.product_name) + '</strong>' +
            '<div class="small">' + escapeHtml(p.description || '') + '</div>' +
          '</td>' +
          '<td>' + escapeHtml(p.category) + '</td>' +
          '<td><strong>' + formatCurrency(p.price) + '</strong></td>' +
          '<td>' + featuredText + '</td>' +
          '<td>' + p.variants.length + ' variants</td>' +
          '<td>' +
            '<a class="btn" href="product.html?id=' + p.product_id + '">View</a> ' +
            '<button class="btn danger" data-del="' + p.product_id + '">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join("");

      tbody.querySelectorAll("button[data-del]").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Delete this product? This will also delete all variants.")) return;

          try {
            await API.deleteProduct(Number(btn.dataset.del));
            toast("Deleted", "Product removed.", "ok");
            renderProducts(filter);
          } catch (e) {
            toast("Error", e.message, "bad");
          }
        });
      });
    } catch (e) {
      console.error("Products error:", e);
      toast("Error", "Failed to load products", "bad");
    }
  }

  const form = qs("#productForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const data = {
      product_name: qs("#pname").value.trim(),
      description: qs("#pdesc").value.trim(),
      price: parseFloat(qs("#pprice").value),
      category: qs("#pcategory").value,
      image_url: qs("#pimage").value.trim() || "/assets/img/products/placeholder.jpg",
      featured: qs("#pfeatured").checked ? 1 : 0
    };

    if (!data.product_name || !data.price) {
      toast("Missing fields", "Name and price are required.", "bad");
      return;
    }

    try {
      await API.createProduct(data);
      form.reset();
      toast("Added", "Product created successfully.", "ok");
      renderProducts("");
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  });

  const searchInput = qs("#searchProducts");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderProducts(e.target.value);
    });
  }

  renderProducts("");
}

// ==================== STOCK ====================
export async function initAdminStock(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  let allStock = [];

  async function renderStock(filter){
    filter = filter || "";
    try {
      allStock = await API.getStock();
      const tbody = qs("#stockBody");
      const lowStockBody = qs("#lowStockBody");

      const filtered = filter ?
        allStock.filter(s => s.product_name.toLowerCase().includes(filter.toLowerCase()))
        : allStock;

      tbody.innerHTML = filtered.map(s => {
        return '<tr>' +
          '<td>' +
            '<strong>#' + s.product_id + '</strong> ' +
            '<div class="small">' + escapeHtml(s.product_name) + '</div>' +
          '</td>' +
          '<td>' + escapeHtml(s.size) + ' / ' + escapeHtml(s.color) + '</td>' +
          '<td>' + escapeHtml(s.category) + '</td>' +
          '<td>' + formatCurrency(s.price) + '</td>' +
          '<td>' +
            '<input data-stock="' + s.variant_id + '" value="' + s.stock_quantity + '" ' +
                   'style="width:90px" type="number" min="0"/>' +
          '</td>' +
        '</tr>';
      }).join("");

      // Low stock alert
      const lowStock = allStock.filter(s => s.stock_quantity < 5);
      if (lowStock.length === 0) {
        lowStockBody.innerHTML = '<tr><td colspan="4" class="muted">All products are well stocked! 🎉</td></tr>';
      } else {
        lowStockBody.innerHTML = lowStock.map(s => {
          return '<tr style="background:rgba(255,204,102,0.1)">' +
            '<td><strong>' + escapeHtml(s.product_name) + '</strong></td>' +
            '<td>' + escapeHtml(s.size) + ' / ' + escapeHtml(s.color) + '</td>' +
            '<td><strong style="color:var(--warn)">' + s.stock_quantity + '</strong></td>' +
            '<td><button class="btn" data-focus="' + s.variant_id + '">Update Stock</button></td>' +
          '</tr>';
        }).join("");

        // Add focus handlers
        lowStockBody.querySelectorAll("button[data-focus]").forEach(btn => {
          btn.addEventListener("click", () => {
            const inp = document.querySelector('[data-stock="' + btn.dataset.focus + '"]');
            if (inp) {
              inp.focus();
              inp.select();
            }
          });
        });
      }

      tbody.querySelectorAll("input[data-stock]").forEach(inp => {
        inp.addEventListener("change", async () => {
          const variantId = Number(inp.dataset.stock);
          let q = Number(inp.value || 0);
          if (!Number.isFinite(q) || q < 0) q = 0;

          try {
            await API.updateStock(variantId, q);
            toast("Stock updated", "Variant #" + variantId + " = " + q, "ok");
            renderStock(filter);
          } catch (e) {
            toast("Error", e.message, "bad");
          }
        });
      });
    } catch (e) {
      console.error("Stock error:", e);
      toast("Error", "Failed to load stock", "bad");
    }
  }

  const searchInput = qs("#searchStock");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      renderStock(e.target.value);
    });
  }

  renderStock("");
}

// ==================== ORDERS ====================
export async function initAdminOrders(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  let allOrders = [];

  async function renderOrders(statusFilter, searchFilter){
    statusFilter = statusFilter || "All";
    searchFilter = searchFilter || "";

    try {
      allOrders = await API.getOrders();
      const tbody = qs("#ordersBody");
      const noOrders = qs("#noOrders");

      let filtered = allOrders;

      if (statusFilter !== "All") {
        filtered = filtered.filter(o => o.status === statusFilter);
      }

      if (searchFilter) {
        const search = searchFilter.toLowerCase();
        filtered = filtered.filter(o => {
          const customerName = (o.customer_first || '') + ' ' + (o.customer_last || '');
          return String(o.order_id).includes(search) ||
                 customerName.toLowerCase().includes(search);
        });
      }

      if (filtered.length === 0) {
        tbody.innerHTML = "";
        noOrders.style.display = "block";
      } else {
        noOrders.style.display = "none";
        tbody.innerHTML = filtered.map(o => {
          const statusColors = {
            'Pending': 'var(--warn)',
            'Accepted': 'var(--ok)',
            'Shipped': 'var(--brand)',
            'Cancelled': 'var(--bad)'
          };
          const statusColor = statusColors[o.status] || 'var(--text)';
          const customerName = (o.customer_first || '') + ' ' + (o.customer_last || '');
          const employeeName = o.employee_first ?
            (o.employee_first + ' ' + o.employee_last) : '-';
          const orderDate = new Date(o.order_date).toLocaleString();

          return '<tr>' +
            '<td><strong>#' + o.order_id + '</strong></td>' +
            '<td>' + escapeHtml(customerName) + '</td>' +
            '<td>' + orderDate + '</td>' +
            '<td><span class="pill" style="background:' + statusColor + '20;color:' + statusColor + ';border-color:' + statusColor + '40">' +
              escapeHtml(o.status) + '</span></td>' +
            '<td><strong>' + formatCurrency(o.total_amount) + '</strong></td>' +
            '<td>' + escapeHtml(employeeName) + '</td>' +
            '<td>' +
              '<a class="btn ghost" href="order.html?id=' + o.order_id + '">View Items</a>' +
            '</td>' +
            '<td>' +
              '<a class="btn" href="order.html?id=' + o.order_id + '">Details</a>' +
            '</td>' +
          '</tr>';
        }).join("");
      }
    } catch (e) {
      console.error("Orders error:", e);
      toast("Error", "Failed to load orders", "bad");
    }
  }

  const filterStatus = qs("#filterStatus");
  const searchOrder = qs("#searchOrder");

  if (filterStatus) {
    filterStatus.addEventListener("change", (e) => {
      renderOrders(e.target.value, searchOrder ? searchOrder.value : "");
    });
  }

  if (searchOrder) {
    searchOrder.addEventListener("input", (e) => {
      renderOrders(filterStatus ? filterStatus.value : "All", e.target.value);
    });
  }

  renderOrders("All", "");
}