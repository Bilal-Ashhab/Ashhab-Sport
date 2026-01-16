from flask import Flask, request, render_template, jsonify, session, send_from_directory
from db import get_conn
from decimal import Decimal
import traceback

app = Flask(__name__)
app.secret_key = "ashhab-sport-secret-key-2025"

DEFAULT_WAREHOUSE_ID = 1  # Main warehouse


# ============= HTML PAGE ROUTES =============

@app.route("/")
@app.route("/index.html")
def index():
    return render_template("index.html")


@app.route("/main.html")
def main():
    return render_template("main.html")


@app.route("/login.html")
def login():
    return render_template("login.html")


@app.route("/signup.html")
def signup():
    return render_template("signup.html")


@app.route("/product.html")
def product():
    return render_template("product.html")


@app.route("/customer.html")
def customer():
    return render_template("customer.html")


@app.route("/employee.html")
def employee():
    return render_template("employee.html")


@app.route("/admin.html")
def admin():
    return render_template("admin.html")


@app.route("/admin-employees.html")
def admin_employees():
    return render_template("admin-employees.html")


@app.route("/admin-products.html")
def admin_products():
    return render_template("admin-products.html")


@app.route("/admin-stock.html")
def admin_stock():
    return render_template("admin-stock.html")


@app.route("/admin-orders.html")
def admin_orders():
    return render_template("admin-orders.html")


@app.route("/order.html")
def order():
    return render_template("order.html")


@app.route("/assets/<path:filename>")
def assets(filename):
    return send_from_directory("static/assets", filename)


# ============= API ENDPOINTS =============

@app.route("/api/products", methods=["GET"])
def api_products():
    """Get all products with their variants and stock"""
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT product_id, product_name, description, price, 
                   category, image_url, featured
            FROM product
            ORDER BY product_id
        """)
        products = cur.fetchall()

        for product in products:
            # Get variants with stock
            cur.execute("""
                SELECT v.variant_id, v.size, v.color, 
                       COALESCE(SUM(s.quantity), 0) as stock_quantity
                FROM product_variant v
                LEFT JOIN stock s ON s.variant_id = v.variant_id
                WHERE v.product_id = %s
                GROUP BY v.variant_id, v.size, v.color
                ORDER BY v.variant_id
            """, (product['product_id'],))
            product['variants'] = cur.fetchall()

            product['price'] = float(product['price'])
            for v in product['variants']:
                v['stock_quantity'] = int(v['stock_quantity'])

        cur.close()
        return jsonify(products)
    except Exception as e:
        print(f"Error fetching products: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/products/<int:product_id>", methods=["GET"])
def api_product_detail(product_id):
    """Get single product with variants and stock"""
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT product_id, product_name, description, price, 
                   category, image_url, featured
            FROM product
            WHERE product_id = %s
        """, (product_id,))
        product = cur.fetchone()

        if not product:
            return jsonify({"error": "Product not found"}), 404

        cur.execute("""
            SELECT v.variant_id, v.size, v.color, 
                   COALESCE(SUM(s.quantity), 0) as stock_quantity
            FROM product_variant v
            LEFT JOIN stock s ON s.variant_id = v.variant_id
            WHERE v.product_id = %s
            GROUP BY v.variant_id, v.size, v.color
            ORDER BY v.variant_id
        """, (product_id,))
        product['variants'] = cur.fetchall()

        product['price'] = float(product['price'])
        for v in product['variants']:
            v['stock_quantity'] = int(v['stock_quantity'])

        cur.close()
        return jsonify(product)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/categories", methods=["GET"])
def api_categories():
    """Get all product categories"""
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("SELECT DISTINCT category FROM product ORDER BY category")
        categories = [row[0] for row in cur.fetchall()]
        cur.close()
        return jsonify(categories)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/login", methods=["POST"])
def api_login():
    """Handle login for customers and employees"""
    data = request.get_json()
    role = data.get("role")
    username = data.get("username")
    password = data.get("password")

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        if role == "customer":
            cur.execute("""
                SELECT customer_id, first_name, last_name, email
                FROM customer
                WHERE email = %s AND password = %s
            """, (username, password))
            user = cur.fetchone()

            if user:
                # Ensure cart exists
                cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (user['customer_id'],))
                cart = cur.fetchone()
                if not cart:
                    cur.execute("INSERT INTO cart (customer_id) VALUES (%s)", (user['customer_id'],))
                    conn.commit()

                session['user_id'] = user['customer_id']
                session['user_type'] = 'customer'
                session['user_name'] = f"{user['first_name']} {user['last_name']}"
                cur.close()
                return jsonify({
                    "success": True,
                    "user": {
                        "id": user['customer_id'],
                        "type": "customer",
                        "name": f"{user['first_name']} {user['last_name']}"
                    }
                })
        else:
            cur.execute("""
                SELECT employee_id, first_name, last_name, username, role
                FROM employee
                WHERE username = %s AND password = %s
            """, (username, password))
            user = cur.fetchone()

            if user:
                session['user_id'] = user['employee_id']
                session['user_type'] = 'employee'
                session['user_role'] = user['role']
                session['user_name'] = f"{user['first_name']} {user['last_name']}"
                cur.close()
                return jsonify({
                    "success": True,
                    "user": {
                        "id": user['employee_id'],
                        "type": "employee",
                        "role": user['role'],
                        "name": f"{user['first_name']} {user['last_name']}"
                    }
                })

        cur.close()
        return jsonify({"success": False, "message": "Invalid credentials"}), 401
    except Exception as e:
        print(f"Login error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/logout", methods=["POST"])
def api_logout():
    """Handle logout"""
    session.clear()
    return jsonify({"success": True})


@app.route("/api/session", methods=["GET"])
def api_session():
    """Get current session info"""
    if 'user_id' in session:
        return jsonify({
            "logged_in": True,
            "user": {
                "id": session['user_id'],
                "type": session['user_type'],
                "role": session.get('user_role'),
                "name": session.get('user_name')
            }
        })
    return jsonify({"logged_in": False})


@app.route("/api/signup", methods=["POST"])
def api_signup():
    """Create new customer account"""
    data = request.get_json()

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO customer (first_name, last_name, email, password, phone, address)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data.get("firstName"),
            data.get("lastName"),
            data.get("email"),
            data.get("password"),
            data.get("phone", ""),
            data.get("address", "")
        ))
        conn.commit()
        customer_id = cur.lastrowid

        # Create cart for new customer
        cur.execute("INSERT INTO cart (customer_id) VALUES (%s)", (customer_id,))
        conn.commit()

        cur.close()
        return jsonify({"success": True, "customer_id": customer_id})
    except Exception as e:
        conn.rollback()
        print(f"Signup error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/cart", methods=["GET"])
def api_get_cart():
    """Get customer's cart"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Get cart_id
        cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (customer_id,))
        cart = cur.fetchone()
        if not cart:
            # Create cart if doesn't exist
            cur.execute("INSERT INTO cart (customer_id) VALUES (%s)", (customer_id,))
            conn.commit()
            cart_id = cur.lastrowid
        else:
            cart_id = cart['cart_id']

        # Get cart items
        cur.execute("""
            SELECT ci.variant_id, ci.quantity, ci.cart_id,
                   p.product_id, p.product_name, p.price, p.category,
                   v.size, v.color,
                   COALESCE(SUM(s.quantity), 0) as stock_quantity
            FROM cart_item ci
            JOIN product_variant v ON v.variant_id = ci.variant_id
            JOIN product p ON p.product_id = v.product_id
            LEFT JOIN stock s ON s.variant_id = ci.variant_id
            WHERE ci.cart_id = %s
            GROUP BY ci.variant_id, ci.quantity, ci.cart_id, 
                     p.product_id, p.product_name, p.price, p.category, 
                     v.size, v.color
        """, (cart_id,))
        items = cur.fetchall()

        for item in items:
            item['price'] = float(item['price'])
            item['cart_item_id'] = item['variant_id']  # For compatibility

        cur.close()
        return jsonify(items)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/cart", methods=["POST"])
def api_add_to_cart():
    """Add item to cart"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    data = request.get_json()

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Get cart_id
        cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (customer_id,))
        cart = cur.fetchone()
        if not cart:
            cur.execute("INSERT INTO cart (customer_id) VALUES (%s)", (customer_id,))
            conn.commit()
            cart_id = cur.lastrowid
        else:
            cart_id = cart['cart_id']

        # Check if item already in cart
        cur.execute("""
            SELECT quantity FROM cart_item
            WHERE cart_id = %s AND variant_id = %s
        """, (cart_id, data.get("variant_id")))
        existing = cur.fetchone()

        if existing:
            new_qty = existing['quantity'] + data.get("quantity", 1)
            cur.execute("""
                UPDATE cart_item SET quantity = %s
                WHERE cart_id = %s AND variant_id = %s
            """, (new_qty, cart_id, data.get("variant_id")))
        else:
            cur.execute("""
                INSERT INTO cart_item (cart_id, variant_id, quantity)
                VALUES (%s, %s, %s)
            """, (cart_id, data.get("variant_id"), data.get("quantity", 1)))

        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/cart/<int:variant_id>", methods=["PUT"])
def api_update_cart(variant_id):
    """Update cart item quantity"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    data = request.get_json()

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (customer_id,))
        cart = cur.fetchone()
        if not cart:
            return jsonify({"error": "Cart not found"}), 404

        cur.execute("""
            UPDATE cart_item SET quantity = %s
            WHERE cart_id = %s AND variant_id = %s
        """, (data.get("quantity"), cart['cart_id'], variant_id))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/cart/<int:variant_id>", methods=["DELETE"])
def api_delete_cart(variant_id):
    """Remove item from cart"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (customer_id,))
        cart = cur.fetchone()
        if not cart:
            return jsonify({"error": "Cart not found"}), 404

        cur.execute("""
            DELETE FROM cart_item
            WHERE cart_id = %s AND variant_id = %s
        """, (cart['cart_id'], variant_id))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders", methods=["GET"])
def api_get_orders():
    """Get orders filtered by user type"""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        if session['user_type'] == 'customer':
            cur.execute("""
                SELECT o.order_id, o.order_date, o.status, o.total_amount,
                       e.first_name AS employee_first, e.last_name AS employee_last
                FROM `order` o
                LEFT JOIN employee e ON e.employee_id = o.employee_id
                WHERE o.customer_id = %s
                ORDER BY o.order_id DESC
            """, (session['user_id'],))
        elif session['user_type'] == 'employee':
            if session.get('user_role') == 'ADMIN':
                cur.execute("""
                    SELECT o.order_id, o.order_date, o.status, o.total_amount,
                           c.first_name AS customer_first, c.last_name AS customer_last,
                           e.first_name AS employee_first, e.last_name AS employee_last
                    FROM `order` o
                    JOIN customer c ON c.customer_id = o.customer_id
                    LEFT JOIN employee e ON e.employee_id = o.employee_id
                    ORDER BY o.order_id DESC
                """)
            else:
                cur.execute("""
                    SELECT o.order_id, o.order_date, o.status, o.total_amount,
                           c.first_name AS customer_first, c.last_name AS customer_last
                    FROM `order` o
                    JOIN customer c ON c.customer_id = o.customer_id
                    WHERE o.status = 'Pending' OR o.employee_id = %s
                    ORDER BY o.order_id DESC
                """, (session['user_id'],))

        orders = cur.fetchall()
        for order in orders:
            order['total_amount'] = float(order['total_amount'])

        cur.close()
        return jsonify(orders)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders", methods=["POST"])
def api_create_order():
    """Create order from cart"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Get cart
        cur.execute("SELECT cart_id FROM cart WHERE customer_id = %s", (customer_id,))
        cart = cur.fetchone()
        if not cart:
            return jsonify({"error": "Cart not found"}), 400

        # Get cart items with price and stock
        cur.execute("""
            SELECT ci.variant_id, ci.quantity, p.price,
                   COALESCE(SUM(s.quantity), 0) as stock_quantity
            FROM cart_item ci
            JOIN product_variant v ON v.variant_id = ci.variant_id
            JOIN product p ON p.product_id = v.product_id
            LEFT JOIN stock s ON s.variant_id = ci.variant_id
            WHERE ci.cart_id = %s
            GROUP BY ci.variant_id, ci.quantity, p.price
        """, (cart['cart_id'],))
        items = cur.fetchall()

        if not items:
            return jsonify({"error": "Cart is empty"}), 400

        # Check stock
        for item in items:
            if item['stock_quantity'] < item['quantity']:
                return jsonify({"error": "Not enough stock for some items"}), 400

        # Calculate total
        total = sum(float(item['price']) * item['quantity'] for item in items)

        # Create order
        cur.execute("""
            INSERT INTO `order` (customer_id, warehouse_id, total_amount, status)
            VALUES (%s, %s, %s, 'Pending')
        """, (customer_id, DEFAULT_WAREHOUSE_ID, total))
        order_id = cur.lastrowid

        # Add order items
        for item in items:
            cur.execute("""
                INSERT INTO order_detail (order_id, variant_id, quantity, price)
                VALUES (%s, %s, %s, %s)
            """, (order_id, item['variant_id'], item['quantity'], item['price']))

        # Clear cart
        cur.execute("DELETE FROM cart_item WHERE cart_id = %s", (cart['cart_id'],))

        conn.commit()
        cur.close()
        return jsonify({"success": True, "order_id": order_id})
    except Exception as e:
        conn.rollback()
        print(f"Order creation error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders/<int:order_id>", methods=["GET"])
def api_get_order_detail(order_id):
    """Get order details"""
    if 'user_id' not in session:
        return jsonify({"error": "Not logged in"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT o.order_id, o.customer_id, o.employee_id, o.order_date, 
                   o.status, o.total_amount,
                   c.first_name AS customer_first, c.last_name AS customer_last
            FROM `order` o
            JOIN customer c ON c.customer_id = o.customer_id
            WHERE o.order_id = %s
        """, (order_id,))
        order = cur.fetchone()

        if not order:
            return jsonify({"error": "Order not found"}), 404

        # Check permissions
        if session['user_type'] == 'customer' and order['customer_id'] != session['user_id']:
            return jsonify({"error": "Access denied"}), 403

        # Get order items
        cur.execute("""
            SELECT od.variant_id, od.quantity, od.price,
                   p.product_id, p.product_name, v.size, v.color
            FROM order_detail od
            JOIN product_variant v ON v.variant_id = od.variant_id
            JOIN product p ON p.product_id = v.product_id
            WHERE od.order_id = %s
        """, (order_id,))
        order['items'] = cur.fetchall()

        order['total_amount'] = float(order['total_amount'])
        for item in order['items']:
            item['price'] = float(item['price'])

        cur.close()
        return jsonify(order)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders/<int:order_id>/accept", methods=["POST"])
def api_accept_order(order_id):
    """Employee accepts order and deducts stock"""
    if 'user_id' not in session or session.get('user_type') != 'employee':
        return jsonify({"error": "Not authorized"}), 401

    employee_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Get order
        cur.execute("SELECT status, warehouse_id FROM `order` WHERE order_id = %s", (order_id,))
        order = cur.fetchone()

        if not order:
            return jsonify({"error": "Order not found"}), 404
        if order['status'] != 'Pending':
            return jsonify({"error": "Order is not pending"}), 400

        warehouse_id = order['warehouse_id']

        # Get order items
        cur.execute("""
            SELECT variant_id, quantity FROM order_detail WHERE order_id = %s
        """, (order_id,))
        items = cur.fetchall()

        # Check and deduct stock
        for item in items:
            cur.execute("""
                SELECT quantity FROM stock 
                WHERE warehouse_id = %s AND variant_id = %s
            """, (warehouse_id, item['variant_id']))
            stock = cur.fetchone()

            if not stock or stock['quantity'] < item['quantity']:
                conn.rollback()
                return jsonify({"error": "Not enough stock"}), 400

            # Deduct stock
            cur.execute("""
                UPDATE stock
                SET quantity = quantity - %s
                WHERE warehouse_id = %s AND variant_id = %s
            """, (item['quantity'], warehouse_id, item['variant_id']))

            # Record inventory movement
            cur.execute("""
                INSERT INTO inventory_movement 
                (warehouse_id, variant_id, movement_type, qty_change, employee_id, ref_type, ref_id, note)
                VALUES (%s, %s, 'SALE', %s, %s, 'order', %s, 'Order accepted and fulfilled')
            """, (warehouse_id, item['variant_id'], -item['quantity'], employee_id, order_id))

        # Update order
        cur.execute("""
            UPDATE `order`
            SET status = 'Accepted', employee_id = %s
            WHERE order_id = %s
        """, (employee_id, order_id))

        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        print(f"Accept order error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/orders/<int:order_id>/status", methods=["PUT"])
def api_update_order_status(order_id):
    """Update order status"""
    if 'user_id' not in session or session.get('user_type') != 'employee':
        return jsonify({"error": "Not authorized"}), 401

    data = request.get_json()
    new_status = data.get("status")

    if new_status not in ['Pending', 'Accepted', 'Shipped', 'Cancelled']:
        return jsonify({"error": "Invalid status"}), 400

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE `order` SET status = %s WHERE order_id = %s
        """, (new_status, order_id))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/employees", methods=["GET"])
def api_get_employees():
    """Get all employees (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT employee_id, first_name, last_name, username, email, role, phone
            FROM employee
            ORDER BY employee_id
        """)
        employees = cur.fetchall()
        cur.close()
        return jsonify(employees)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/employees", methods=["POST"])
def api_create_employee():
    """Create employee (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO employee (first_name, last_name, email, username, password, role, phone)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get("first_name"),
            data.get("last_name"),
            data.get("email"),
            data.get("username"),
            data.get("password"),
            data.get("role", "STAFF"),
            data.get("phone", "")
        ))
        conn.commit()
        employee_id = cur.lastrowid
        cur.close()
        return jsonify({"success": True, "employee_id": employee_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/employees/<int:employee_id>", methods=["DELETE"])
def api_delete_employee(employee_id):
    """Delete employee (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM employee WHERE employee_id = %s", (employee_id,))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/stock", methods=["GET"])
def api_get_stock():
    """Get all product variants with stock"""
    if 'user_id' not in session or session.get('user_type') != 'employee':
        return jsonify({"error": "Employee only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT v.variant_id, v.product_id, v.size, v.color,
                   p.product_name, p.category, p.price,
                   COALESCE(SUM(s.quantity), 0) as stock_quantity
            FROM product_variant v
            JOIN product p ON p.product_id = v.product_id
            LEFT JOIN stock s ON s.variant_id = v.variant_id
            GROUP BY v.variant_id, v.product_id, v.size, v.color,
                     p.product_name, p.category, p.price
            ORDER BY v.product_id, v.variant_id
        """)
        stock = cur.fetchall()
        for item in stock:
            item['price'] = float(item['price'])
            item['stock_quantity'] = int(item['stock_quantity'])
        cur.close()
        return jsonify(stock)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/stock/<int:variant_id>", methods=["PUT"])
def api_update_stock(variant_id):
    """Update stock quantity (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json()
    quantity = data.get("quantity")

    conn = get_conn()
    try:
        cur = conn.cursor()

        # Update or insert stock
        cur.execute("""
            INSERT INTO stock (warehouse_id, variant_id, quantity)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
        """, (DEFAULT_WAREHOUSE_ID, variant_id, quantity))

        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/admin/stats", methods=["GET"])
def api_admin_stats():
    """Get admin dashboard statistics"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Total sales from orders
        cur.execute("SELECT COALESCE(SUM(total_amount), 0) as total_sales FROM `order`")
        total_sales = float(cur.fetchone()['total_sales'])

        # Total purchases from purchase orders
        cur.execute("SELECT COALESCE(SUM(total_cost), 0) as total_purchases FROM purchase_order")
        total_purchases = float(cur.fetchone()['total_purchases'])

        # Net earnings
        net_earnings = total_sales - total_purchases

        # Total orders
        cur.execute("SELECT COUNT(*) as total_orders FROM `order`")
        total_orders = cur.fetchone()['total_orders']

        # Orders by status
        cur.execute("""
            SELECT status, COUNT(*) as count
            FROM `order`
            GROUP BY status
        """)
        status_counts = {row['status']: row['count'] for row in cur.fetchall()}

        # Total products
        cur.execute("SELECT COUNT(*) as total_products FROM product")
        total_products = cur.fetchone()['total_products']

        cur.close()
        return jsonify({
            "total_sales": total_sales,
            "total_purchases": total_purchases,
            "net_earnings": net_earnings,
            "total_orders": total_orders,
            "pending_orders": status_counts.get('Pending', 0),
            "accepted_orders": status_counts.get('Accepted', 0),
            "shipped_orders": status_counts.get('Shipped', 0),
            "cancelled_orders": status_counts.get('Cancelled', 0),
            "total_products": total_products
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/admin/top-products", methods=["GET"])
def api_top_products():
    """Get most sold products"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    limit = request.args.get('limit', 10, type=int)

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        cur.execute("""
            SELECT p.product_id, p.product_name, p.category, p.price,
                   SUM(od.quantity) as total_sold,
                   SUM(od.quantity * od.price) as total_revenue
            FROM order_detail od
            JOIN product_variant v ON v.variant_id = od.variant_id
            JOIN product p ON p.product_id = v.product_id
            JOIN `order` o ON o.order_id = od.order_id
            WHERE o.status IN ('Accepted', 'Shipped')
            GROUP BY p.product_id, p.product_name, p.category, p.price
            ORDER BY total_sold DESC
            LIMIT %s
        """, (limit,))

        products = cur.fetchall()
        for p in products:
            p['price'] = float(p['price'])
            p['total_revenue'] = float(p['total_revenue'])

        cur.close()
        return jsonify(products)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/products", methods=["POST"])
def api_create_product():
    """Create new product (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO product (product_name, description, price, category, image_url, featured)
            VALUES (%s, %s, %s, %s, %s, %s)
        """, (
            data.get("product_name"),
            data.get("description", ""),
            data.get("price"),
            data.get("category"),
            data.get("image_url", "/assets/img/products/placeholder.jpg"),
            data.get("featured", 0)
        ))
        conn.commit()
        product_id = cur.lastrowid
        cur.close()
        return jsonify({"success": True, "product_id": product_id})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/products/<int:product_id>", methods=["PUT"])
def api_update_product(product_id):
    """Update product (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE product
            SET product_name = %s, description = %s, price = %s, 
                category = %s, image_url = %s, featured = %s
            WHERE product_id = %s
        """, (
            data.get("product_name"),
            data.get("description"),
            data.get("price"),
            data.get("category"),
            data.get("image_url"),
            data.get("featured", 0),
            product_id
        ))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/products/<int:product_id>", methods=["DELETE"])
def api_delete_product(product_id):
    """Delete product (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("DELETE FROM product WHERE product_id = %s", (product_id,))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.errorhandler(404)
def not_found(e):
    return render_template('main.html'), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": "Internal server error"}), 500


if __name__ == "__main__":
    print("=" * 60)
    print("Ashhab Sport - MySQL Integration")
    print("=" * 60)
    print("Server running at: http://127.0.0.1:5000")
    print("=" * 60)
    print("Demo Accounts:")
    print("  Admin:    username: admin      password: admin123")
    print("  Employee: username: staff1     password: staff123")
    print("  Customer: email: demo@demo.com password: demo123")
    print("=" * 60)
    app.run(host="127.0.0.1", port=5000, debug=True)