import requests
import json
import sys

base_url = "http://localhost:8000/api"

# Login
login_res = requests.post(f"{base_url}/auth/login", json={"email":"admin@ridn.com", "password":"admin123"})
if login_res.status_code != 200:
    print("Login failed", login_res.text)
    sys.exit(1)

token = login_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get products
prod_res = requests.get(f"{base_url}/inventory/products?active_only=true", headers=headers)
if prod_res.status_code != 200:
    print("Get products failed", prod_res.text)
    sys.exit(1)

products = prod_res.json()
if not products:
    print("No products found")
    sys.exit(1)

test_prod = products[0]
print(f"Testing on product: {test_prod['name']} (Stock: {test_prod['stock_quantity']})")

req_body = {
    "items": [{"product_id": test_prod["id"], "quantity": 1, "price": test_prod["price"]}],
    "payment_method": "card"
}

pos_res = requests.post(f"{base_url}/transactions/pos", json=req_body, headers=headers)
print("POS Checkout Status:", pos_res.status_code)
print("POS Checkout Response:", pos_res.text[:200])

# Fetch product again
prod_res2 = requests.get(f"{base_url}/inventory/products/{test_prod['id']}", headers=headers)
new_stock = prod_res2.json().get("stock_quantity")
print(f"New stock: {new_stock} (Expected: {test_prod['stock_quantity'] - 1})")

if new_stock == test_prod['stock_quantity'] - 1:
    print("SUCCESS")
else:
    print("FAILED")
