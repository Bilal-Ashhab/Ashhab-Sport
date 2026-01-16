"""
Quick setup script for Ashhab Sport MySQL Integration
Run this after creating the database with database_schema.sql
"""
import os
from pathlib import Path


def create_env_file():
    """Create .env file if it doesn't exist"""
    env_path = Path(".env")
    if not env_path.exists():
        print("Creating .env file...")
        content = """DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASS=root123
DB_NAME=ashhab_sport
"""
        env_path.write_text(content)
        print("✓ .env file created")
        print("⚠ Please update DB_PASS in .env with your MySQL password")
    else:
        print("✓ .env file already exists")


def check_directories():
    """Check if required directories exist"""
    required_dirs = [
        "templates",
        "static/css",
        "static/js",
        "static/assets/img/products"
    ]

    for dir_path in required_dirs:
        path = Path(dir_path)
        if path.exists():
            print(f"✓ {dir_path} exists")
        else:
            print(f"✗ {dir_path} missing - creating it")
            path.mkdir(parents=True, exist_ok=True)


def check_files():
    """Check if required files exist"""
    html_files = [
        "templates/index.html",
        "templates/main.html",
        "templates/login.html",
        "templates/signup.html",
        "templates/product.html",
        "templates/customer.html",
        "templates/employee.html",
        "templates/admin.html",
        "templates/order.html"
    ]

    js_files = [
        "static/js/api.js",
        "static/js/ui.js",
        "static/js/auth.js",
        "static/js/main.js",
        "static/js/product.js",
        "static/js/customer.js",
        "static/js/employee.js",
        "static/js/admin.js",
        "static/js/order.js"
    ]

    other_files = [
        "static/css/style.css",
        "server.py",
        "db.py"
    ]

    print("\nChecking HTML files:")
    for file_path in html_files:
        if Path(file_path).exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} missing")

    print("\nChecking JavaScript files:")
    for file_path in js_files:
        if Path(file_path).exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} missing")

    print("\nChecking other files:")
    for file_path in other_files:
        if Path(file_path).exists():
            print(f"  ✓ {file_path}")
        else:
            print(f"  ✗ {file_path} missing")


def test_database_connection():
    """Test if database connection works"""
    try:
        from db import get_conn
        print("\nTesting database connection...")
        conn = get_conn()
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM product")
        count = cur.fetchone()[0]
        cur.close()
        conn.close()
        print(f"✓ Database connection successful!")
        print(f"✓ Found {count} products in database")
        return True
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        print("\n⚠ Make sure you:")
        print("  1. Created the database using database_schema.sql")
        print("  2. Updated DB_PASS in .env file")
        print("  3. MySQL server is running")
        return False


def create_placeholder_image():
    """Create a simple placeholder image"""
    try:
        from PIL import Image, ImageDraw

        img_path = Path("static/assets/img/products/placeholder.jpg")
        if not img_path.exists():
            print("\nCreating placeholder image...")
            img = Image.new('RGB', (800, 800), color=(60, 70, 90))
            draw = ImageDraw.Draw(img)
            draw.rectangle([50, 50, 750, 750], outline=(150, 160, 180), width=5)
            img.save(img_path)
            print("✓ Placeholder image created")
        else:
            print("✓ Placeholder image exists")
    except ImportError:
        print("⚠ Pillow not installed - skipping placeholder image creation")
        print("  Install with: pip install Pillow")


def main():
    print("=" * 60)
    print("Ashhab Sport - Setup Check")
    print("=" * 60)

    create_env_file()
    print()
    check_directories()
    check_files()
    create_placeholder_image()

    print("\n" + "=" * 60)
    if test_database_connection():
        print("\n✓ Setup complete! You can now run:")
        print("  python server.py")
        print("\nThen visit: http://127.0.0.1:5000")
        print("\nDemo accounts:")
        print("  Admin:    username: admin      password: admin123")
        print("  Employee: username: staff1     password: staff123")
        print("  Customer: email: demo@demo.com password: demo123")
    else:
        print("\n✗ Setup incomplete - fix database connection first")

    print("=" * 60)


if __name__ == "__main__":
    main()