import requests

BASE_URL = "http://localhost:8000/api"

def login(email, password="password123"):
    resp = requests.post(f"{BASE_URL}/auth/login", json={"email": email, "password": password})
    if resp.status_code == 200:
        return resp.json()["access_token"]
    print(f"Login failed for {email}: {resp.text}")
    return None

def test_user_access(token, role_name):
    headers = {"Authorization": f"Bearer {token}"}
    
    print(f"\n--- Testing {role_name} ---")
    
    # 1. Get Users
    users = requests.get(f"{BASE_URL}/users", headers=headers).json()
    if isinstance(users, list):
         print(f"[{role_name}] Found {len(users)} users. Emails: {[u.get('email') for u in users]}")
    else:
         print(f"[{role_name}] Users error: {users}")

    # 2. Get Products (Centralized + Assigned Outlets)
    products = requests.get(f"{BASE_URL}/inventory/products", headers=headers).json()
    if isinstance(products, list):
        print(f"[{role_name}] Found {len(products)} products.")
    else:
        print(f"[{role_name}] Products error: {products}")
        
    # 3. Get Bookings
    bookings = requests.get(f"{BASE_URL}/bookings", headers=headers).json()
    if isinstance(bookings, list):
         print(f"[{role_name}] Found {len(bookings)} bookings.")
    else:
         print(f"[{role_name}] Bookings error: {bookings}")

admin_token = login("admin2@riserve.com")
manager1_token = login("manager1@riserve.com")
manager2_token = login("manager2@riserve.com")
user1_token = login("user1@riserve.com")

if admin_token: test_user_access(admin_token, "Admin")
if manager1_token: test_user_access(manager1_token, "Manager 1")
if manager2_token: test_user_access(manager2_token, "Manager 2")
if user1_token: test_user_access(user1_token, "User 1 (Staff)")
