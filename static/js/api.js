// API client for MySQL backend
export const API = {
  async request(url, options = {}) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Request failed');
      }

      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  // Products
  async getProducts() {
    return this.request('/api/products');
  },

  async getProduct(id) {
    return this.request(`/api/products/${id}`);
  },

  async getCategories() {
    return this.request('/api/categories');
  },

  async createProduct(data) {
    return this.request('/api/products', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateProduct(productId, data) {
    return this.request(`/api/products/${productId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteProduct(productId) {
    return this.request(`/api/products/${productId}`, {
      method: 'DELETE'
    });
  },

  // Auth
  async login(role, username, password) {
    return this.request('/api/login', {
      method: 'POST',
      body: JSON.stringify({ role, username, password })
    });
  },

  async logout() {
    return this.request('/api/logout', { method: 'POST' });
  },

  async getSession() {
    return this.request('/api/session');
  },

  async signup(data) {
    return this.request('/api/signup', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Cart
  async getCart() {
    return this.request('/api/cart');
  },

  async addToCart(productId, variantId, quantity) {
    return this.request('/api/cart', {
      method: 'POST',
      body: JSON.stringify({ product_id: productId, variant_id: variantId, quantity })
    });
  },

  async updateCartItem(cartItemId, quantity) {
    return this.request(`/api/cart/${cartItemId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  },

  async deleteCartItem(cartItemId) {
    return this.request(`/api/cart/${cartItemId}`, { method: 'DELETE' });
  },

  // Orders
  async getOrders() {
    return this.request('/api/orders');
  },

  async createOrder() {
    return this.request('/api/orders', { method: 'POST' });
  },

  async getOrderDetail(orderId) {
    return this.request(`/api/orders/${orderId}`);
  },

  async acceptOrder(orderId) {
    return this.request(`/api/orders/${orderId}/accept`, { method: 'POST' });
  },

  async updateOrderStatus(orderId, status) {
    return this.request(`/api/orders/${orderId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
  },

  // Employees (admin)
  async getEmployees() {
    return this.request('/api/employees');
  },

  async createEmployee(data) {
    return this.request('/api/employees', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateEmployee(employeeId, data) {
    return this.request(`/api/employees/${employeeId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteEmployee(employeeId) {
    return this.request(`/api/employees/${employeeId}`, {
      method: 'DELETE'
    });
  },

  // Stock (admin)
  async getStock() {
    return this.request('/api/stock');
  },

  async updateStock(variantId, quantity) {
    return this.request(`/api/stock/${variantId}`, {
      method: 'PUT',
      body: JSON.stringify({ quantity })
    });
  },

  // Admin stats
  async getAdminStats() {
    return this.request('/api/admin/stats');
  },

  async getTopProducts(limit = 10) {
    return this.request(`/api/admin/top-products?limit=${limit}`);
  },

  // Payment Info
  async getPaymentInfo() {
    return this.request('/api/payment-info');
  },

  async addPaymentInfo(data) {
    return this.request('/api/payment-info', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async deletePaymentInfo(paymentInfoId) {
    return this.request(`/api/payment-info/${paymentInfoId}`, {
      method: 'DELETE'
    });
  }
};