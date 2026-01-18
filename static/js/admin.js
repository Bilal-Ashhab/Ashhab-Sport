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
    qs("#cancelledOrders").textContent = stats.cancelled_orders || 0;
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

  let currentEditId = null;

  async function renderEmployees(){
    try {
      const emps = await API.getEmployees();
      const tbody = qs("#empBody");

      tbody.innerHTML = emps.map(e => {
        const deleteBtn = e.username === "admin" ? '-' :
          '<button class="btn danger" data-del="' + e.employee_id + '">Delete</button>';

        const salary = e.salary ? parseFloat(e.salary) : 0;

        return '<tr>' +
          '<td><strong>#' + e.employee_id + '</strong></td>' +
          '<td>' + escapeHtml(e.first_name) + ' ' + escapeHtml(e.last_name) + '</td>' +
          '<td>' + escapeHtml(e.username) + '</td>' +
          '<td>' + escapeHtml(e.email) + '</td>' +
          '<td>' + escapeHtml(e.phone || '-') + '</td>' +
          '<td><span class="pill">' + escapeHtml(e.role) + '</span></td>' +
          '<td><strong>' + formatCurrency(salary) + '</strong></td>' +
          '<td>' +
            '<button class="btn" data-edit="' + e.employee_id + '" data-name="' +
            escapeHtml(e.first_name + ' ' + e.last_name) + '" data-salary="' + salary + '">Edit Salary</button> ' +
            deleteBtn +
          '</td>' +
        '</tr>';
      }).join("");

      // Wire edit buttons
      tbody.querySelectorAll("button[data-edit]").forEach(btn => {
        btn.addEventListener("click", () => {
          currentEditId = Number(btn.dataset.edit);
          qs("#editName").value = btn.dataset.name;
          qs("#editSalary").value = btn.dataset.salary;
          qs("#editModal").style.display = "flex";
        });
      });

      // Wire delete buttons
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

  // Add employee form
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
      phone: qs("#ephone").value.trim(),
      salary: parseFloat(qs("#esalary").value || 0)
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

  // Edit employee form
  const editForm = qs("#editForm");
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const salary = parseFloat(qs("#editSalary").value);

    try {
      await API.updateEmployee(currentEditId, { salary });
      qs("#editModal").style.display = "none";
      toast("Updated", "Salary updated successfully.", "ok");
      renderEmployees();
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  });

  // Cancel edit
  qs("#cancelEdit").addEventListener("click", () => {
    qs("#editModal").style.display = "none";
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
  let currentEditProductId = null;

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
            '<button class="btn" data-edit-product="' + p.product_id + '" data-product-name="' +
            escapeHtml(p.product_name) + '" data-product-price="' + p.price + '">Edit Price</button> ' +
            '<a class="btn ghost" href="product.html?id=' + p.product_id + '">View</a> ' +
            '<button class="btn danger" data-del="' + p.product_id + '">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join("");

      // Wire edit price buttons
      tbody.querySelectorAll("button[data-edit-product]").forEach(btn => {
        btn.addEventListener("click", () => {
          currentEditProductId = Number(btn.dataset.editProduct);
          qs("#editProductName").value = btn.dataset.productName;
          qs("#editProductPrice").value = btn.dataset.productPrice;
          qs("#editProductModal").style.display = "flex";
        });
      });

      // Wire delete buttons
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

  // Add product form
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

  // Edit product price form
  const editProductForm = qs("#editProductForm");
  editProductForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const price = parseFloat(qs("#editProductPrice").value);

    try {
      const product = allProducts.find(p => p.product_id === currentEditProductId);
      await API.updateProduct(currentEditProductId, {
        product_name: product.product_name,
        description: product.description,
        price: price,
        category: product.category,
        image_url: product.image_url,
        featured: product.featured
      });
      qs("#editProductModal").style.display = "none";
      toast("Updated", "Price updated successfully.", "ok");
      renderProducts("");
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  });

  // Cancel product edit
  qs("#cancelProductEdit").addEventListener("click", () => {
    qs("#editProductModal").style.display = "none";
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
          '<td><strong>' + s.stock_quantity + '</strong></td>' +
        '</tr>';
      }).join("");

      // Low stock alert
      const lowStock = allStock.filter(s => s.stock_quantity < 5);
      if (lowStock.length === 0) {
        lowStockBody.innerHTML = '<tr><td colspan="3" class="muted">All products are well stocked! 🎉</td></tr>';
      } else {
        lowStockBody.innerHTML = lowStock.map(s => {
          return '<tr style="background:rgba(255,204,102,0.1)">' +
            '<td><strong>' + escapeHtml(s.product_name) + '</strong></td>' +
            '<td>' + escapeHtml(s.size) + ' / ' + escapeHtml(s.color) + '</td>' +
            '<td><strong style="color:var(--warn)">' + s.stock_quantity + '</strong></td>' +
          '</tr>';
        }).join("");
      }
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

  async function acceptOrder(orderId){
    try {
      await API.acceptOrder(orderId);
      toast("Accepted", `Order #${orderId} accepted. Stock updated.`, "ok");
      renderOrders(filterStatus ? filterStatus.value : "All", searchOrder ? searchOrder.value : "");
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  }

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
            'Cancelled': 'var(--bad)'
          };
          const statusColor = statusColors[o.status] || 'var(--text)';
          const customerName = (o.customer_first || '') + ' ' + (o.customer_last || '');
          const employeeName = o.employee_first ?
            (o.employee_first + ' ' + o.employee_last) : '-';
          const orderDate = new Date(o.order_date).toLocaleString();
          const acceptBtn = o.status === 'Pending'
            ? '<button class="btn ok" data-accept="' + o.order_id + '">Accept</button> '
            : '';

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
              acceptBtn +
              '<a class="btn" href="order.html?id=' + o.order_id + '">Details</a>' +
            '</td>' +
          '</tr>';
        }).join("");

        // Wire accept buttons (admins can accept like employees)
        tbody.querySelectorAll('button[data-accept]').forEach(btn => {
          btn.addEventListener('click', () => {
            acceptOrder(Number(btn.dataset.accept));
          });
        });
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
// ==================== PURCHASES ====================
export async function initAdminPurchases(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  const who = qs("#who");
  if (who) who.textContent = sess.name;

  const variantSelect = qs('#variantSelect');
  const supplierName = qs('#supplierName');
  const qty = qs('#qty');
  const unitCost = qs('#unitCost');
  const totalCost = qs('#totalCost');
  const notes = qs('#notes');
  const purchasesBody = qs('#purchasesBody');
  const noPurchases = qs('#noPurchases');

  function calcTotal(){
    const q = Number(qty?.value || 0);
    const u = Number(unitCost?.value || 0);
    const t = (q * u);
    if (totalCost) totalCost.value = isFinite(t) ? t.toFixed(2) : '0.00';
  }

  async function loadVariants(){
    if (!variantSelect) return;

    try {
      const stock = await API.getStock();
      // Sort: product_name then size/color
      stock.sort((a,b) => {
        const pa = (a.product_name || '').toLowerCase();
        const pb = (b.product_name || '').toLowerCase();
        if (pa !== pb) return pa.localeCompare(pb);
        const sa = (a.size || '').toLowerCase();
        const sb = (b.size || '').toLowerCase();
        if (sa !== sb) return sa.localeCompare(sb);
        const ca = (a.color || '').toLowerCase();
        const cb = (b.color || '').toLowerCase();
        return ca.localeCompare(cb);
      });

      variantSelect.innerHTML = stock.map(s => {
        const label = `${s.product_name} • ${s.size || '-'} / ${s.color || '-'} • Stock: ${s.stock_quantity}`;
        return `<option value="${s.variant_id}">${escapeHtml(label)}</option>`;
      }).join('');

      if (!stock.length) {
        variantSelect.innerHTML = '<option value="">No items found</option>';
      }

    } catch (e) {
      console.error('Variants error:', e);
      toast('Error', 'Failed to load items', 'bad');
    }
  }

  function formatDateTime(dt){
    if (!dt) return '-';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return String(dt);
    return d.toLocaleString();
  }

  async function loadPurchases(){
    if (!purchasesBody) return;

    try {
      const rows = await API.getPurchases();

      if (!rows.length) {
        purchasesBody.innerHTML = '';
        if (noPurchases) noPurchases.style.display = 'block';
        return;
      }

      if (noPurchases) noPurchases.style.display = 'none';

      purchasesBody.innerHTML = rows.map(r => {
        const item = r.product_name
          ? `${r.product_name} • ${r.size || '-'} / ${r.color || '-'}`
          : (r.variant_id ? `Variant #${r.variant_id}` : '-');

        const qtyCell = (r.quantity == null) ? '-' : r.quantity;
        const unitCell = (r.unit_cost == null) ? '-' : formatCurrency(r.unit_cost);
        const totalCell = (r.total_cost == null) ? '-' : formatCurrency(r.total_cost);

        return `
          <tr>
            <td>${escapeHtml(formatDateTime(r.purchase_date))}</td>
            <td>${escapeHtml(r.supplier_name || '-')}</td>
            <td>${escapeHtml(item)}</td>
            <td>${escapeHtml(String(qtyCell))}</td>
            <td>${escapeHtml(String(unitCell))}</td>
            <td>${escapeHtml(String(totalCell))}</td>
            <td>${escapeHtml(r.notes || '')}</td>
          </tr>
        `;
      }).join('');

    } catch (e) {
      console.error('Purchases error:', e);
      toast('Error', 'Failed to load purchases', 'bad');
    }
  }

  // Wire events
  if (qty) qty.addEventListener('input', calcTotal);
  if (unitCost) unitCost.addEventListener('input', calcTotal);

  const refreshVariants = qs('#refreshVariants');
  if (refreshVariants) refreshVariants.addEventListener('click', loadVariants);

  const refreshPurchases = qs('#refreshPurchases');
  if (refreshPurchases) refreshPurchases.addEventListener('click', loadPurchases);

  const purchaseForm = qs('#purchaseForm');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const payload = {
        supplier_name: (supplierName?.value || '').trim(),
        variant_id: Number(variantSelect?.value),
        quantity: Number(qty?.value),
        unit_cost: Number(unitCost?.value),
        notes: (notes?.value || '').trim(),
      };

      if (!payload.supplier_name) {
        toast('Missing', 'Please enter supplier name', 'bad');
        return;
      }
      if (!payload.variant_id) {
        toast('Missing', 'Please choose an item', 'bad');
        return;
      }
      if (!payload.quantity || payload.quantity <= 0) {
        toast('Missing', 'Quantity must be > 0', 'bad');
        return;
      }
      if (Number.isNaN(payload.unit_cost) || payload.unit_cost < 0) {
        toast('Missing', 'Unit cost must be >= 0', 'bad');
        return;
      }

      try {
        await API.createPurchase(payload);
        toast('Added', 'Purchase recorded and stock updated', 'ok');

        // reset minimal fields
        if (qty) qty.value = '1';
        if (unitCost) unitCost.value = '';
        if (notes) notes.value = '';
        calcTotal();

        await loadPurchases();
        await loadVariants();

      } catch (err) {
        console.error('Create purchase error:', err);
        toast('Error', err.message || 'Failed to add purchase', 'bad');
      }
    });
  }

  calcTotal();
  await loadVariants();
  await loadPurchases();
}
