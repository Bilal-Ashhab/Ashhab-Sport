from flask import Flask, request, render_template, jsonify, session, send_from_directory
from db import get_conn
from decimal import Decimal
import traceback

app = Flask(__name__)
app.secret_key = "ashhab-sport-secret-key-2025"

DEFAULT_WAREHOUSE_ID = 1  # Main warehouse


# ============= DB HELPERS (PURCHASES) =============


def _table_exists(cur, table_name: str) -> bool:
    cur.execute("""
        SELECT COUNT(*) AS c
        FROM INFORMATION_SCHEMA.TABLES
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
    """, (table_name,))

    row = cur.fetchone()
    if row is None:
        return False

    val = None
    if isinstance(row, dict):
        val = next(iter(row.values()))
    else:
        val = row[0]

    try:
        return int(val) > 0
    except Exception:
        return False



def _get_columns(cur, table_name: str) -> set:
    cur.execute("""
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = %s
    """, (table_name,))

    cols = set()
    for row in (cur.fetchall() or []):
        name = next(iter(row.values())) if isinstance(row, dict) else row[0]
        if name is not None:
            cols.add(str(name).lower())
    return cols



def _ensure_purchase_schema(cur):
    """Create a minimal purchase schema if the tables do not exist.

    This function is careful to not break if the user already has a different
    purchase_order schema (e.g., purchase_order_id instead of purchase_id).
    """
    # Supplier table (only needed if the existing purchase_order expects supplier_id)
    if not _table_exists(cur, "supplier"):
        cur.execute("""
            CREATE TABLE supplier (
                supplier_id INT AUTO_INCREMENT PRIMARY KEY,
                supplier_name VARCHAR(120) NOT NULL UNIQUE,
                phone VARCHAR(30) NULL,
                email VARCHAR(120) NULL,
                address VARCHAR(255) NULL
            ) ENGINE=InnoDB
        """)

    # Purchase header
    if not _table_exists(cur, "purchase_order"):
        cur.execute("""
            CREATE TABLE purchase_order (
                purchase_id INT AUTO_INCREMENT PRIMARY KEY,
                supplier_name VARCHAR(120) NOT NULL,
                purchase_date DATETIME DEFAULT CURRENT_TIMESTAMP,
                total_cost DECIMAL(12,2) NOT NULL DEFAULT 0,
                created_by_role VARCHAR(20) NULL,
                created_by_id INT NULL,
                notes VARCHAR(255) NULL
            ) ENGINE=InnoDB
        """)

    # Purchase lines
    if not _table_exists(cur, "purchase_order_detail"):
        po_cols = _get_columns(cur, "purchase_order")

        fk_col = None
        fk_ref = None
        if "purchase_id" in po_cols:
            fk_col, fk_ref = "purchase_id", "purchase_id"
        elif "purchase_order_id" in po_cols:
            fk_col, fk_ref = "purchase_order_id", "purchase_order_id"

        if fk_col and fk_ref:
            # Create with FK matching the detected primary key name.
            cur.execute(f"""
                CREATE TABLE purchase_order_detail (
                    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
                    {fk_col} INT NOT NULL,
                    variant_id INT NOT NULL,
                    quantity INT NOT NULL,
                    unit_cost DECIMAL(12,2) NOT NULL,
                    line_total DECIMAL(12,2) NULL,
                    CONSTRAINT fk_purchase_detail_purchase
                        FOREIGN KEY ({fk_col}) REFERENCES purchase_order({fk_ref})
                        ON DELETE CASCADE
                ) ENGINE=InnoDB
            """)
        else:
            # Fallback: create without FK (still works for tracking purchases).
            cur.execute("""
                CREATE TABLE purchase_order_detail (
                    purchase_detail_id INT AUTO_INCREMENT PRIMARY KEY,
                    purchase_id INT NOT NULL,
                    variant_id INT NOT NULL,
                    quantity INT NOT NULL,
                    unit_cost DECIMAL(12,2) NOT NULL,
                    line_total DECIMAL(12,2) NULL
                ) ENGINE=InnoDB
            """)



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


@app.route("/payment-info.html")
def payment_info():
    return render_template("payment-info.html")


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


@app.route("/admin-purchases.html")
def admin_purchases():
    return render_template("admin-purchases.html")


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
            # Create cart if it doesn't exist
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

        # Check if customer has payment info
        cur.execute("""
            SELECT payment_info_id FROM customer_payment_info 
            WHERE customer_id = %s LIMIT 1
        """, (customer_id,))
        payment_info = cur.fetchone()

        if not payment_info:
            cur.close()
            return jsonify({"error": "Payment info required", "redirect": "payment-info"}), 400

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


@app.route("/api/payment-info", methods=["GET"])
def api_get_payment_info():
    """Get customer payment info"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)
        cur.execute("""
            SELECT payment_info_id, card_type, card_holder_name, 
                   card_number, expiry_month, expiry_year, is_default
            FROM customer_payment_info
            WHERE customer_id = %s
            ORDER BY is_default DESC, payment_info_id DESC
        """, (customer_id,))
        payment_info = cur.fetchall()

        # Mask card numbers (show last 4 digits only)
        for info in payment_info:
            if len(info['card_number']) > 4:
                info['card_number_masked'] = '**** **** **** ' + info['card_number'][-4:]
            else:
                info['card_number_masked'] = info['card_number']

        cur.close()
        return jsonify(payment_info)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/payment-info", methods=["POST"])
def api_add_payment_info():
    """Add customer payment info"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    data = request.get_json()

    conn = get_conn()
    try:
        cur = conn.cursor()

        # If this is set as default, unset other defaults
        if data.get('is_default', 0):
            cur.execute("""
                UPDATE customer_payment_info 
                SET is_default = 0 
                WHERE customer_id = %s
            """, (customer_id,))

        cur.execute("""
            INSERT INTO customer_payment_info 
            (customer_id, card_type, card_holder_name, card_number, 
             expiry_month, expiry_year, cvv, is_default)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            customer_id,
            data.get('card_type'),
            data.get('card_holder_name'),
            data.get('card_number'),
            data.get('expiry_month'),
            data.get('expiry_year'),
            data.get('cvv'),
            data.get('is_default', 0)
        ))
        conn.commit()
        payment_info_id = cur.lastrowid
        cur.close()
        return jsonify({"success": True, "payment_info_id": payment_info_id})
    except Exception as e:
        conn.rollback()
        print(f"Payment info error: {e}")
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/payment-info/<int:payment_info_id>", methods=["DELETE"])
def api_delete_payment_info(payment_info_id):
    """Delete payment info"""
    if 'user_id' not in session or session.get('user_type') != 'customer':
        return jsonify({"error": "Not logged in"}), 401

    customer_id = session['user_id']
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            DELETE FROM customer_payment_info
            WHERE payment_info_id = %s AND customer_id = %s
        """, (payment_info_id, customer_id))
        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
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
            SELECT employee_id, first_name, last_name, username, email, role, phone, salary
            FROM employee
            ORDER BY employee_id
        """)
        employees = cur.fetchall()

        # Convert Decimal to float for JSON
        for emp in employees:
            if emp['salary']:
                emp['salary'] = float(emp['salary'])

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
            INSERT INTO employee (first_name, last_name, email, username, password, role, phone, salary)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            data.get("first_name"),
            data.get("last_name"),
            data.get("email"),
            data.get("username"),
            data.get("password"),
            data.get("role", "STAFF"),
            data.get("phone", ""),
            data.get("salary", 0)
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


@app.route("/api/employees/<int:employee_id>", methods=["PUT"])
def api_update_employee(employee_id):
    """Update employee (admin only)"""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json()
    conn = get_conn()
    try:
        cur = conn.cursor()
        cur.execute("""
            UPDATE employee 
            SET salary = %s
            WHERE employee_id = %s
        """, (data.get("salary"), employee_id))
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

    data = request.get_json(silent=True) or {}
    quantity = data.get("quantity")

    # Optional fields (so this route never crashes)
    purchase_id = data.get("purchase_id") or data.get("purchase_order_id")
    notes = data.get("notes") or data.get("note")

    conn = get_conn()
    try:
        cur = conn.cursor()

        # Update or insert stock
        cur.execute("""
            INSERT INTO stock (warehouse_id, variant_id, quantity)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)
        """, (DEFAULT_WAREHOUSE_ID, variant_id, quantity))

        # Log inventory movement (RECEIPT) if the table exists
        try:
            if _table_exists(cur, "inventory_movement"):
                cur.execute(
                    """
                    INSERT INTO inventory_movement
                      (warehouse_id, variant_id, movement_type, qty_change, employee_id, ref_type, ref_id, note)
                    VALUES (%s, %s, 'RECEIPT', %s, %s, 'PURCHASE', %s, %s)
                    """,
                    (
                        DEFAULT_WAREHOUSE_ID,
                        variant_id,
                        quantity,
                        session.get('user_id'),
                        purchase_id,
                        notes if notes else None
                    )
                )
        except Exception:
            # Don't block the update if logging fails
            pass

        conn.commit()
        cur.close()
        return jsonify({"success": True})
    except Exception as e:
        conn.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()



# ============= PURCHASES (ADMIN) =============

@app.route("/api/purchases", methods=["GET"])
def api_get_purchases():
    """List purchases (admin only)."""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        if not _table_exists(cur, "purchase_order"):
            cur.close()
            return jsonify([])

        po_cols = _get_columns(cur, "purchase_order")
        has_pod = _table_exists(cur, "purchase_order_detail")

        pk = "purchase_id" if "purchase_id" in po_cols else ("purchase_order_id" if "purchase_order_id" in po_cols else "id")
        date_col = "purchase_date" if "purchase_date" in po_cols else ("order_date" if "order_date" in po_cols else "created_at")

        supplier_name_col = "supplier_name" if "supplier_name" in po_cols else None
        supplier_id_col = "supplier_id" if "supplier_id" in po_cols else None
        notes_col = "notes" if "notes" in po_cols else None
        total_col = "total_cost" if "total_cost" in po_cols else None

        select_fields = [f"po.{pk} AS purchase_id", f"po.{date_col} AS purchase_date"]
        select_fields.append(f"po.{total_col} AS total_cost" if total_col else "0 AS total_cost")
        select_fields.append(f"po.{notes_col} AS notes" if notes_col else "NULL AS notes")

        joins = []
        if supplier_name_col:
            select_fields.append(f"po.{supplier_name_col} AS supplier_name")
        elif supplier_id_col and _table_exists(cur, "supplier"):
            joins.append("LEFT JOIN supplier sup ON sup.supplier_id = po.supplier_id")
            select_fields.append("sup.supplier_name AS supplier_name")
        else:
            select_fields.append("'-' AS supplier_name")

        if has_pod:
            pod_cols = _get_columns(cur, "purchase_order_detail")
            pod_fk = "purchase_id" if "purchase_id" in pod_cols else ("purchase_order_id" if "purchase_order_id" in pod_cols else pk)
            qty_col = "quantity" if "quantity" in pod_cols else ("qty" if "qty" in pod_cols else "quantity")
            unit_col = "price" if "price" in pod_cols else ("unit_cost" if "unit_cost" in pod_cols else ("cost" if "cost" in pod_cols else ("unit_price" if "unit_price" in pod_cols else "unit_cost")))

            joins.append(f"LEFT JOIN purchase_order_detail pod ON pod.{pod_fk} = po.{pk}")
            joins.append("LEFT JOIN product_variant v ON v.variant_id = pod.variant_id")
            joins.append("LEFT JOIN product p ON p.product_id = v.product_id")

            select_fields.extend([
                "pod.variant_id AS variant_id",
                f"pod.{qty_col} AS quantity",
                f"pod.{unit_col} AS unit_cost",
                "p.product_name AS product_name",
                "v.size AS size",
                "v.color AS color",
            ])
        else:
            select_fields.extend([
                "NULL AS variant_id",
                "NULL AS quantity",
                "NULL AS unit_cost",
                "NULL AS product_name",
                "NULL AS size",
                "NULL AS color",
            ])

        sql = "SELECT " + ", ".join(select_fields) + " FROM purchase_order po " + " ".join(joins) + f" ORDER BY po.{date_col} DESC, po.{pk} DESC LIMIT 200"
        cur.execute(sql)
        rows = cur.fetchall()

        for r in rows:
            if r.get('total_cost') is not None:
                try:
                    r['total_cost'] = float(r['total_cost'])
                except Exception:
                    r['total_cost'] = 0.0
            if r.get('unit_cost') is not None:
                try:
                    r['unit_cost'] = float(r['unit_cost'])
                except Exception:
                    r['unit_cost'] = None
            if r.get('quantity') is not None:
                try:
                    r['quantity'] = int(r['quantity'])
                except Exception:
                    r['quantity'] = None

        cur.close()
        return jsonify(rows)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        conn.close()


@app.route("/api/purchases", methods=["POST"])
def api_create_purchase():
    """Create a purchase and add its quantity to stock (admin only)."""
    if 'user_id' not in session or session.get('user_role') != 'ADMIN':
        return jsonify({"error": "Admin only"}), 401

    data = request.get_json() or {}
    supplier_name = (data.get('supplier_name') or '').strip()
    variant_id = data.get('variant_id')
    quantity = data.get('quantity')
    unit_cost = data.get('unit_cost')
    notes = (data.get('notes') or '').strip()

    if not supplier_name or variant_id is None or quantity is None or unit_cost is None:
        return jsonify({"error": "Missing fields"}), 400

    try:
        variant_id = int(variant_id)
        quantity = int(quantity)
        if quantity <= 0:
            return jsonify({"error": "Quantity must be positive"}), 400
        unit_cost = Decimal(str(unit_cost))
        if unit_cost < 0:
            return jsonify({"error": "Unit cost must be >= 0"}), 400
    except Exception:
        return jsonify({"error": "Invalid data"}), 400

    line_total = unit_cost * Decimal(quantity)

    conn = get_conn()
    try:
        cur = conn.cursor(dictionary=True)

        # Ensure tables exist (won't overwrite if the user already has them)
        _ensure_purchase_schema(cur)

        po_cols = _get_columns(cur, "purchase_order")
        pk = "purchase_id" if "purchase_id" in po_cols else ("purchase_order_id" if "purchase_order_id" in po_cols else "id")

        # Decide supplier storage
        supplier_name_col = "supplier_name" if "supplier_name" in po_cols else None
        supplier_id_col = "supplier_id" if "supplier_id" in po_cols else None

        insert_cols = []
        insert_vals = []
        params = []

        if supplier_name_col:
            insert_cols.append(supplier_name_col)
            insert_vals.append("%s")
            params.append(supplier_name)
        elif supplier_id_col:
            # Map supplier name -> supplier_id
            _ensure_purchase_schema(cur)
            sup_cols = _get_columns(cur, "supplier")
            sup_name_col = "supplier_name" if "supplier_name" in sup_cols else ("name" if "name" in sup_cols else None)
            if not sup_name_col:
                return jsonify({"error": "Supplier table schema not supported"}), 500

            cur.execute(f"SELECT supplier_id FROM supplier WHERE {sup_name_col} = %s", (supplier_name,))
            row = cur.fetchone()
            if row:
                supplier_id = int(row['supplier_id'])
            else:
                cur.execute(f"INSERT INTO supplier ({sup_name_col}) VALUES (%s)", (supplier_name,))
                supplier_id = cur.lastrowid

            insert_cols.append("supplier_id")
            insert_vals.append("%s")
            params.append(supplier_id)

        # dates/status when present
        if 'purchase_date' in po_cols and 'purchase_date' not in insert_cols:
            insert_cols.append('purchase_date')
            insert_vals.append('NOW()')
        elif 'order_date' in po_cols and 'order_date' not in insert_cols:
            insert_cols.append('order_date')
            insert_vals.append('CURDATE()')
        elif 'created_at' in po_cols and 'created_at' not in insert_cols:
            insert_cols.append('created_at')
            insert_vals.append('NOW()')

        if 'status' in po_cols and 'status' not in insert_cols:
            insert_cols.append('status')
            insert_vals.append('%s')
            params.append('Received')

        # total_cost
        if 'total_cost' in po_cols:
            insert_cols.append('total_cost')
            insert_vals.append('%s')
            params.append(line_total)

        # created_by
        if 'created_by_role' in po_cols:
            insert_cols.append('created_by_role')
            insert_vals.append('%s')
            params.append(session.get('user_role'))
        if 'created_by_id' in po_cols:
            insert_cols.append('created_by_id')
            insert_vals.append('%s')
            params.append(session.get('user_id'))
        if 'employee_id' in po_cols:
            insert_cols.append('employee_id')
            insert_vals.append('%s')
            params.append(session.get('user_id'))

        if notes and 'notes' in po_cols:
            insert_cols.append('notes')
            insert_vals.append('%s')
            params.append(notes)

        if not insert_cols:
            return jsonify({"error": "purchase_order table schema not supported"}), 500

        sql = f"INSERT INTO purchase_order ({', '.join(insert_cols)}) VALUES ({', '.join(insert_vals)})"
        cur.execute(sql, tuple(params))
        purchase_id = cur.lastrowid

        # Insert purchase line if detail table exists
        if _table_exists(cur, 'purchase_order_detail'):
            pod_cols = _get_columns(cur, 'purchase_order_detail')
            pod_fk = 'purchase_id' if 'purchase_id' in pod_cols else ('purchase_order_id' if 'purchase_order_id' in pod_cols else None)
            qty_col = 'quantity' if 'quantity' in pod_cols else ('qty' if 'qty' in pod_cols else 'quantity')
            unit_col = 'price' if 'price' in pod_cols else ('unit_cost' if 'unit_cost' in pod_cols else ('cost' if 'cost' in pod_cols else ('unit_price' if 'unit_price' in pod_cols else 'unit_cost')))

            line_cols = []
            line_vals = []
            line_params = []

            if pod_fk:
                line_cols.append(pod_fk)
                line_vals.append('%s')
                line_params.append(purchase_id)

            if 'variant_id' in pod_cols:
                line_cols.append('variant_id')
                line_vals.append('%s')
                line_params.append(variant_id)

            if qty_col in pod_cols:
                line_cols.append(qty_col)
                line_vals.append('%s')
                line_params.append(quantity)

            if unit_col in pod_cols:
                line_cols.append(unit_col)
                line_vals.append('%s')
                line_params.append(unit_cost)

            if 'line_total' in pod_cols:
                line_cols.append('line_total')
                line_vals.append('%s')
                line_params.append(line_total)

            if line_cols:
                cur.execute(
                    f"INSERT INTO purchase_order_detail ({', '.join(line_cols)}) VALUES ({', '.join(line_vals)})",
                    tuple(line_params)
                )

        # Add to stock (increment)
        cur.execute("""
            INSERT INTO stock (warehouse_id, variant_id, quantity)
            VALUES (%s, %s, %s)
            ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)
        """, (DEFAULT_WAREHOUSE_ID, variant_id, quantity))

        # Log inventory movement (RECEIPT) if the table exists
        try:
            if _table_exists(cur, "inventory_movement"):
                cur.execute(
                    """
                    INSERT INTO inventory_movement
                      (warehouse_id, variant_id, movement_type, qty_change, employee_id, ref_type, ref_id, note)
                    VALUES (%s, %s, 'RECEIPT', %s, %s, 'PURCHASE', %s, %s)
                    """,
                    (DEFAULT_WAREHOUSE_ID, variant_id, quantity, session.get('user_id'), purchase_id, (notes if notes else None))
                )
        except Exception:
            # Don't block the purchase if logging fails
            pass

        conn.commit()
        cur.close()
        return jsonify({"success": True, "purchase_id": purchase_id})
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

        # Total sales from ACCEPTED orders only
        cur.execute("""
            SELECT COALESCE(SUM(total_amount), 0) as total_sales 
            FROM `order` 
            WHERE status = 'Accepted'
        """)
        total_sales = float(cur.fetchone()['total_sales'])

        # Total purchases from purchase orders
        if _table_exists(cur, "purchase_order"):
            cur.execute("SELECT COALESCE(SUM(total_cost), 0) as total_purchases FROM purchase_order")
            total_purchases = float(cur.fetchone()['total_purchases'])
        else:
            total_purchases = 0.0

        # Net earnings (only from accepted orders)
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