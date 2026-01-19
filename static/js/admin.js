import { API } from './api.js';
import { injectLayout, wireLogout, toast, formatCurrency, requireRole, escapeHtml } from "./ui.js";

function qs(sel, root=document){ return root.querySelector(sel); }

// =====================
// Profile Edit Functions (shared by admin pages)
// =====================

async function loadEmployeeProfile() {
  try {
    const profile = await API.getEmployeeProfile();

    const firstNameEl = qs("#profFirstName");
    const lastNameEl = qs("#profLastName");
    const emailEl = qs("#profEmail");
    const usernameEl = qs("#profUsername");
    const phoneEl = qs("#profPhone");
    const passwordEl = qs("#profPassword");

    if (firstNameEl) firstNameEl.value = profile.first_name || "";
    if (lastNameEl) lastNameEl.value = profile.last_name || "";
    if (emailEl) emailEl.value = profile.email || "";
    if (usernameEl) usernameEl.value = profile.username || "";
    if (phoneEl) phoneEl.value = profile.phone || "";
    if (passwordEl) passwordEl.value = "";
  } catch (e) {
    toast("Error", "Failed to load profile", "bad");
  }
}

function showProfilePanel() {
  const panel = qs("#profilePanel");
  if (panel) {
    panel.style.display = "block";
    loadEmployeeProfile();
  }
}

function hideProfilePanel() {
  const panel = qs("#profilePanel");
  if (panel) {
    panel.style.display = "none";
  }
}

async function saveEmployeeProfile(e) {
  e.preventDefault();

  const data = {
    first_name: qs("#profFirstName")?.value.trim() || "",
    last_name: qs("#profLastName")?.value.trim() || "",
    email: qs("#profEmail")?.value.trim() || "",
    phone: qs("#profPhone")?.value.trim() || ""
  };

  const newPassword = qs("#profPassword")?.value;
  if (newPassword) {
    data.password = newPassword;
  }

  if (!data.first_name || !data.last_name || !data.email) {
    toast("Missing fields", "First name, last name, and email are required.", "bad");
    return;
  }

  try {
    await API.updateEmployeeProfile(data);
    toast("Saved", "Profile updated successfully.", "ok");
    hideProfilePanel();

    const whoEl = qs("#who");
    if (whoEl) whoEl.textContent = `${data.first_name} ${data.last_name}`;
  } catch (e) {
    toast("Error", e.message, "bad");
  }
}

function wireProfileButtons() {
  const btnEditProfile = qs("#btnEditProfile");
  const btnCloseProfile = qs("#btnCloseProfile");
  const btnCancelProfile = qs("#btnCancelProfile");
  const profileForm = qs("#profileForm");

  if (btnEditProfile) btnEditProfile.addEventListener("click", showProfilePanel);
  if (btnCloseProfile) btnCloseProfile.addEventListener("click", hideProfilePanel);
  if (btnCancelProfile) btnCancelProfile.addEventListener("click", hideProfilePanel);
  if (profileForm) profileForm.addEventListener("submit", saveEmployeeProfile);
}

// ==================== DASHBOARD ====================
export async function initAdminDashboard(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();
  wireProfileButtons();

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
          '<td>' + (p.variants ? p.variants.length : 0) + ' variants</td>' +
          '<td>' +
            '<button class="btn" data-editprod="' + p.product_id + '" data-name="' +
            escapeHtml(p.product_name) + '" data-price="' + p.price + '">Edit Price</button> ' +
            '<button class="btn danger" data-delprod="' + p.product_id + '">Delete</button>' +
          '</td>' +
        '</tr>';
      }).join("");

      // Wire edit buttons
      tbody.querySelectorAll("button[data-editprod]").forEach(btn => {
        btn.addEventListener("click", () => {
          currentEditProductId = Number(btn.dataset.editprod);
          qs("#editProductName").value = btn.dataset.name;
          qs("#editProductPrice").value = btn.dataset.price;
          qs("#editProductModal").style.display = "flex";
        });
      });

      // Wire delete buttons
      tbody.querySelectorAll("button[data-delprod]").forEach(btn => {
        btn.addEventListener("click", async () => {
          if (!confirm("Are you sure you want to delete this product?")) return;

          try {
            await API.deleteProduct(Number(btn.dataset.delprod));
            toast("Deleted", "Product removed.", "ok");
            renderProducts(qs("#searchProducts")?.value || "");
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
      toast("Missing fields", "Fill product name and price.", "bad");
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

  // Edit product form
  const editForm = qs("#editProductForm");
  editForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const price = parseFloat(qs("#editProductPrice").value);
    const product = allProducts.find(p => p.product_id === currentEditProductId);

    if (!product) {
      toast("Error", "Product not found", "bad");
      return;
    }

    try {
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
      renderProducts(qs("#searchProducts")?.value || "");
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  });

  // Cancel edit
  qs("#cancelProductEdit").addEventListener("click", () => {
    qs("#editProductModal").style.display = "none";
  });

  // Search
  qs("#searchProducts").addEventListener("input", (e) => {
    renderProducts(e.target.value);
  });

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
        allStock.filter(s =>
          s.product_name.toLowerCase().includes(filter.toLowerCase())
        ) : allStock;

      tbody.innerHTML = filtered.map(s => {
        const stockColor = s.stock_quantity < 5 ? 'var(--bad)' :
          s.stock_quantity < 15 ? 'var(--warn)' : 'var(--ok)';

        return '<tr>' +
          '<td><strong>' + escapeHtml(s.product_name) + '</strong></td>' +
          '<td>' + escapeHtml(s.size || '-') + ' / ' + escapeHtml(s.color || '-') + '</td>' +
          '<td>' + escapeHtml(s.category) + '</td>' +
          '<td>' + formatCurrency(s.price) + '</td>' +
          '<td><strong style="color:' + stockColor + '">' + s.stock_quantity + '</strong></td>' +
        '</tr>';
      }).join("");

      // Low stock items
      const lowStock = allStock.filter(s => s.stock_quantity < 5);
      if (lowStockBody) {
        if (!lowStock.length) {
          lowStockBody.innerHTML = '<tr><td colspan="3" class="muted">All items have sufficient stock.</td></tr>';
        } else {
          lowStockBody.innerHTML = lowStock.map(s => {
            return '<tr>' +
              '<td><strong>' + escapeHtml(s.product_name) + '</strong></td>' +
              '<td>' + escapeHtml(s.size || '-') + ' / ' + escapeHtml(s.color || '-') + '</td>' +
              '<td><strong style="color:var(--bad)">' + s.stock_quantity + '</strong></td>' +
            '</tr>';
          }).join("");
        }
      }
    } catch (e) {
      console.error("Stock error:", e);
      toast("Error", "Failed to load stock", "bad");
    }
  }

  // Search
  qs("#searchStock")?.addEventListener("input", (e) => {
    renderStock(e.target.value);
  });

  renderStock("");
}

// ==================== ORDERS ====================
export async function initAdminOrders(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  async function acceptOrder(orderId) {
    try {
      await API.acceptOrder(orderId);
      toast("Accepted", `Order #${orderId} accepted. Stock updated.`, "ok");
      renderOrders(
        qs("#filterStatus")?.value || "All",
        qs("#searchOrder")?.value || ""
      );
    } catch (e) {
      toast("Error", e.message, "bad");
    }
  }

  async function renderOrders(statusFilter, searchFilter){
    statusFilter = statusFilter || "All";
    searchFilter = (searchFilter || "").toLowerCase();

    try {
      const orders = await API.getOrders();
      const tbody = qs("#ordersBody");
      const noOrders = qs("#noOrders");

      let filtered = orders;

      if (statusFilter !== "All") {
        filtered = filtered.filter(o => o.status === statusFilter);
      }

      if (searchFilter) {
        filtered = filtered.filter(o => {
          const customerName = ((o.customer_first || '') + ' ' + (o.customer_last || '')).toLowerCase();
          const orderId = String(o.order_id);
          return customerName.includes(searchFilter) || orderId.includes(searchFilter);
        });
      }

      if (!filtered.length) {
        tbody.innerHTML = '';
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

        // Wire accept buttons
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

// ==================== SUPPLIERS ====================
export async function initAdminSuppliers(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  let allSuppliers = [];

  async function renderSuppliers(filter){
    filter = (filter || "").toLowerCase();
    try {
      allSuppliers = await API.getSuppliers();
      const tbody = qs("#suppliersBody");
      const noSuppliers = qs("#noSuppliers");

      const filtered = filter ?
        allSuppliers.filter(s =>
          (s.supplier_name || "").toLowerCase().includes(filter) ||
          (s.email || "").toLowerCase().includes(filter) ||
          (s.phone || "").toLowerCase().includes(filter)
        ) : allSuppliers;

      if (!filtered.length) {
        tbody.innerHTML = '';
        noSuppliers.style.display = "block";
      } else {
        noSuppliers.style.display = "none";
        tbody.innerHTML = filtered.map(s => {
          return '<tr>' +
            '<td><strong>#' + s.supplier_id + '</strong></td>' +
            '<td><strong>' + escapeHtml(s.supplier_name) + '</strong></td>' +
            '<td>' + escapeHtml(s.phone || '-') + '</td>' +
            '<td>' + escapeHtml(s.email || '-') + '</td>' +
            '<td>' + escapeHtml(s.address || '-') + '</td>' +
            '<td>' +
              '<button class="btn" data-editsup="' + s.supplier_id + '">Edit</button> ' +
              '<button class="btn danger" data-delsup="' + s.supplier_id + '">Delete</button>' +
            '</td>' +
          '</tr>';
        }).join("");

        // Wire edit buttons
        tbody.querySelectorAll("button[data-editsup]").forEach(btn => {
          btn.addEventListener("click", () => {
            const sup = allSuppliers.find(s => s.supplier_id === Number(btn.dataset.editsup));
            if (sup) {
              qs("#editSupplierId").value = sup.supplier_id;
              qs("#editSupplierName").value = sup.supplier_name || "";
              qs("#editSupplierPhone").value = sup.phone || "";
              qs("#editSupplierEmail").value = sup.email || "";
              qs("#editSupplierAddress").value = sup.address || "";
              qs("#editSupplierModal").style.display = "flex";
            }
          });
        });

        // Wire delete buttons
        tbody.querySelectorAll("button[data-delsup]").forEach(btn => {
          btn.addEventListener("click", async () => {
            if (!confirm("Are you sure you want to delete this supplier?")) return;

            try {
              await API.deleteSupplier(Number(btn.dataset.delsup));
              toast("Deleted", "Supplier removed.", "ok");
              renderSuppliers(qs("#searchSuppliers")?.value || "");
            } catch (e) {
              toast("Error", e.message, "bad");
            }
          });
        });
      }
    } catch (e) {
      console.error("Suppliers error:", e);
      toast("Error", "Failed to load suppliers", "bad");
    }
  }

  // Add supplier form
  const form = qs("#supplierForm");
  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const data = {
        supplier_name: qs("#sname").value.trim(),
        phone: qs("#sphone").value.trim(),
        email: qs("#semail").value.trim(),
        address: qs("#saddress").value.trim()
      };

      if (!data.supplier_name) {
        toast("Missing fields", "Supplier name is required.", "bad");
        return;
      }

      try {
        await API.createSupplier(data);
        form.reset();
        toast("Added", "Supplier created successfully.", "ok");
        renderSuppliers("");
      } catch (e) {
        toast("Error", e.message, "bad");
      }
    });
  }

  // Edit supplier form
  const editForm = qs("#editSupplierForm");
  if (editForm) {
    editForm.addEventListener("submit", async (e) => {
      e.preventDefault();

      const supplierId = Number(qs("#editSupplierId").value);
      const data = {
        supplier_name: qs("#editSupplierName").value.trim(),
        phone: qs("#editSupplierPhone").value.trim(),
        email: qs("#editSupplierEmail").value.trim(),
        address: qs("#editSupplierAddress").value.trim()
      };

      if (!data.supplier_name) {
        toast("Missing fields", "Supplier name is required.", "bad");
        return;
      }

      try {
        await API.updateSupplier(supplierId, data);
        qs("#editSupplierModal").style.display = "none";
        toast("Updated", "Supplier updated successfully.", "ok");
        renderSuppliers(qs("#searchSuppliers")?.value || "");
      } catch (e) {
        toast("Error", e.message, "bad");
      }
    });
  }

  // Cancel edit
  const cancelBtn = qs("#cancelSupplierEdit");
  if (cancelBtn) {
    cancelBtn.addEventListener("click", () => {
      qs("#editSupplierModal").style.display = "none";
    });
  }

  // Search
  qs("#searchSuppliers")?.addEventListener("input", (e) => {
    renderSuppliers(e.target.value);
  });

  renderSuppliers("");
}

// ==================== PURCHASES ====================
export async function initAdminPurchases(){
  const sess = await requireRole("admin");
  if (!sess) return;

  await injectLayout();
  wireLogout();

  const who = qs("#who");
  if (who) who.textContent = sess.name;

  const supplierSelect = qs('#supplierSelect');
  const variantSelect = qs('#variantSelect');
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

  async function loadSuppliers(){
    if (!supplierSelect) return;

    try {
      const suppliers = await API.getSuppliers();

      supplierSelect.innerHTML = '<option value="">-- Select Supplier --</option>' +
        suppliers.map(s => {
          return `<option value="${s.supplier_id}">${escapeHtml(s.supplier_name)}</option>`;
        }).join('');

      if (!suppliers.length) {
        supplierSelect.innerHTML = '<option value="">No suppliers - add one first</option>';
      }
    } catch (e) {
      console.error('Suppliers error:', e);
      toast('Error', 'Failed to load suppliers', 'bad');
    }
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

  async function loadAllData(){
    await loadSuppliers();
    await loadVariants();
    await loadPurchases();
  }

  // Wire events
  if (qty) qty.addEventListener('input', calcTotal);
  if (unitCost) unitCost.addEventListener('input', calcTotal);

  const refreshData = qs('#refreshData');
  if (refreshData) refreshData.addEventListener('click', loadAllData);

  const refreshPurchases = qs('#refreshPurchases');
  if (refreshPurchases) refreshPurchases.addEventListener('click', loadPurchases);

  const purchaseForm = qs('#purchaseForm');
  if (purchaseForm) {
    purchaseForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const supplierId = Number(supplierSelect?.value);
      if (!supplierId) {
        toast('Missing', 'Please select a supplier', 'bad');
        return;
      }

      const payload = {
        supplier_id: supplierId,
        variant_id: Number(variantSelect?.value),
        quantity: Number(qty?.value),
        unit_cost: Number(unitCost?.value),
        notes: (notes?.value || '').trim(),
      };

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
  await loadAllData();
}