import requests
import sys

base_url = "http://localhost:8000/api"

login_res = requests.post(f"{base_url}/auth/login", json={"email":"admin@ridn.com", "password":"admin123"})
if login_res.status_code != 200:
    print("Login failed", login_res.text)
    sys.exit(1)

token = login_res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

b_res = requests.get(f"{base_url}/bookings", headers=headers)
print(f"Bookings: {len(b_res.json())}")

t_res = requests.get(f"{base_url}/transactions", headers=headers)
print(f"Transactions: {len(t_res.json())}")

o_res = requests.get(f"{base_url}/outlets", headers=headers)
print(f"Outlets: {len(o_res.json())}")

s_res = requests.get(f"{base_url}/services", headers=headers)
print(f"Services: {len(s_res.json())}")

