import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_login():
    email = "admin@ridn.com"
    password = "admin123"
    
    print(f"Attempting login for {email}...")
    
    try:
        response = requests.post(f"{BASE_URL}/auth/login", json={
            "email": email,
            "password": password
        })
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Login SUCCESS successful!")
            token = response.json().get("access_token")
            print(f"Token received: {token[:20]}...")
        else:
            print("❌ Login FAILED")
            
    except Exception as e:
        print(f"❌ Request failed: {e}")

if __name__ == "__main__":
    test_login()
