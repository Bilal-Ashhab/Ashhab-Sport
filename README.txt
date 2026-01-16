Ashhab Sport (Frontend Only)
============================

✅ Static website (HTML/CSS/JS) with localStorage (no backend).

Pages
-----
- main.html (store + search + categories + recommendations)
- product.html (product details + size/color variants)
- login.html
- signup.html
- customer.html (cart + place orders + my orders)
- employee.html (accept pending orders)
- admin.html (add employees + edit stock + view orders)
- order.html (order details)

Demo accounts
-------------
- Admin:
  username: admin
  password: admin123

- Employee:
  username: staff1
  password: staff123

- Customer:
  email: demo@demo.com
  password: demo123

How to run
----------
Open index.html or main.html.
For best results use VS Code + "Live Server" extension.

How to add your real product images
-----------------------------------
All product images are here:
  assets/img/products/

I already created placeholder images with the exact filenames.
Just replace the files with your real photos (keep the same names).

Example:
  replace assets/img/products/asics_gel_quantum_360.jpg
  replace assets/img/products/nike_tech_fleece.jpg
  ...etc

Notes
-----
- Currency format is ILS (₪). You can change it in assets/js/ui.js.
- This is frontend only; orders/stock are simulated in localStorage.
