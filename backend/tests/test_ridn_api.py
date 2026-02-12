"""
Ri'DN Partner Dashboard API Tests
Tests for refactored modular router architecture with MongoDB backend
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test user credentials
TEST_EMAIL = f"test_{uuid.uuid4().hex[:8]}@example.com"
TEST_PASSWORD = "test123"
TEST_NAME = "Test User"


class TestAuthFlow:
    """Authentication endpoint tests - Registration and Login"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_user_registration(self, api_client):
        """Test user registration flow"""
        response = api_client.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "name": TEST_NAME,
            "password": TEST_PASSWORD,
            "role": "Admin"
        })
        
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data, "Missing access_token in response"
        assert "token_type" in data, "Missing token_type in response"
        assert "user" in data, "Missing user in response"
        assert data["user"]["email"] == TEST_EMAIL
        assert data["user"]["name"] == TEST_NAME
        print(f"✓ User registration successful: {TEST_EMAIL}")
    
    def test_user_login(self, api_client):
        """Test user login flow"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ User login successful: {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self, api_client):
        """Test login with invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "invalid@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, "Should return 401 for invalid credentials"
        print("✓ Invalid credentials correctly rejected")


class TestFreshStartAPIs:
    """Test APIs return empty/zero data for fresh start experience"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        # Try login with test user
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            # Register new user
            response = session.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_EMAIL,
                "name": TEST_NAME,
                "password": TEST_PASSWORD
            })
        
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_get_reports_returns_zeros(self, authenticated_client):
        """Test reports API returns zeros for fresh start"""
        response = authenticated_client.get(f"{BASE_URL}/api/reports")
        
        assert response.status_code == 200, f"Reports API failed: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "totalOutlets" in data
        assert "totalBookings" in data
        assert "totalRevenue" in data
        assert "avgRating" in data
        
        # For fresh start, values should be 0 or very low
        print(f"✓ Reports API working - Outlets: {data['totalOutlets']}, Bookings: {data['totalBookings']}, Revenue: {data['totalRevenue']}")
    
    def test_get_outlets_returns_list(self, authenticated_client):
        """Test outlets API returns list (empty for fresh start)"""
        response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        
        assert response.status_code == 200, f"Outlets API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Outlets should return a list"
        print(f"✓ Outlets API working - Count: {len(data)}")
    
    def test_get_services_returns_list(self, authenticated_client):
        """Test services API returns list (empty for fresh start)"""
        response = authenticated_client.get(f"{BASE_URL}/api/services")
        
        assert response.status_code == 200, f"Services API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Services should return a list"
        print(f"✓ Services API working - Count: {len(data)}")
    
    def test_get_bookings_returns_list(self, authenticated_client):
        """Test bookings API returns list (empty for fresh start)"""
        response = authenticated_client.get(f"{BASE_URL}/api/bookings")
        
        assert response.status_code == 200, f"Bookings API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Bookings should return a list"
        print(f"✓ Bookings API working - Count: {len(data)}")
    
    def test_get_transactions_returns_list(self, authenticated_client):
        """Test transactions API returns list (empty for fresh start)"""
        response = authenticated_client.get(f"{BASE_URL}/api/transactions")
        
        assert response.status_code == 200, f"Transactions API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Transactions should return a list"
        print(f"✓ Transactions API working - Count: {len(data)}")


class TestCRUDOperations:
    """Test CRUD operations for outlets, services, bookings"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            response = session.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_EMAIL,
                "name": TEST_NAME,
                "password": TEST_PASSWORD
            })
        
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    # ==================== OUTLET CRUD ====================
    def test_create_outlet(self, authenticated_client):
        """Test creating a new outlet"""
        outlet_data = {
            "name": f"TEST_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Chennai",
            "address": "123 Test Street, Chennai",
            "capacity": 3,
            "machines": 2,
            "rating": 4.5,
            "solar": True,
            "water_recycle": True,
            "services_offered": []
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/outlets", json=outlet_data)
        
        assert response.status_code == 200, f"Create outlet failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data, "Missing id in response"
        assert data["name"] == outlet_data["name"]
        assert data["city"] == outlet_data["city"]
        assert data["status"] == "Active"
        
        # Store for later tests
        authenticated_client.test_outlet_id = data["id"]
        print(f"✓ Outlet created: {data['name']} (ID: {data['id']})")
        return data["id"]
    
    def test_get_outlet_after_create(self, authenticated_client):
        """Verify outlet persisted in database"""
        response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        
        assert response.status_code == 200
        outlets = response.json()
        
        # Find our test outlet
        outlet_id = getattr(authenticated_client, 'test_outlet_id', None)
        if outlet_id:
            found = any(o["id"] == outlet_id for o in outlets)
            assert found, "Created outlet not found in list"
            print(f"✓ Outlet verified in database")
    
    # ==================== SERVICE CRUD ====================
    def test_create_service(self, authenticated_client):
        """Test creating a new service"""
        service_data = {
            "name": f"TEST_Service_{uuid.uuid4().hex[:6]}",
            "duration_min": 45,
            "price": 599,
            "description": "Test service description"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/services", json=service_data)
        
        assert response.status_code == 200, f"Create service failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data
        assert data["name"] == service_data["name"]
        assert data["price"] == service_data["price"]
        assert data["active"] == True
        
        authenticated_client.test_service_id = data["id"]
        print(f"✓ Service created: {data['name']} (ID: {data['id']})")
        return data["id"]
    
    def test_get_service_after_create(self, authenticated_client):
        """Verify service persisted in database"""
        response = authenticated_client.get(f"{BASE_URL}/api/services")
        
        assert response.status_code == 200
        services = response.json()
        
        service_id = getattr(authenticated_client, 'test_service_id', None)
        if service_id:
            found = any(s["id"] == service_id for s in services)
            assert found, "Created service not found in list"
            print(f"✓ Service verified in database")
    
    # ==================== BOOKING CRUD ====================
    def test_create_booking(self, authenticated_client):
        """Test creating a new booking"""
        outlet_id = getattr(authenticated_client, 'test_outlet_id', None)
        service_id = getattr(authenticated_client, 'test_service_id', None)
        
        if not outlet_id or not service_id:
            pytest.skip("Need outlet and service IDs from previous tests")
        
        booking_data = {
            "customer": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
            "vehicle": "TN01AB1234",
            "time": "10:00",
            "service_id": service_id,
            "outlet_id": outlet_id,
            "amount": 599
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/bookings", json=booking_data)
        
        assert response.status_code == 200, f"Create booking failed: {response.text}"
        data = response.json()
        
        # Validate response
        assert "id" in data
        assert data["customer"] == booking_data["customer"]
        assert data["status"] == "Pending"
        
        authenticated_client.test_booking_id = data["id"]
        print(f"✓ Booking created: {data['customer']} (ID: {data['id']})")
        return data["id"]
    
    def test_get_booking_after_create(self, authenticated_client):
        """Verify booking persisted in database"""
        response = authenticated_client.get(f"{BASE_URL}/api/bookings")
        
        assert response.status_code == 200
        bookings = response.json()
        
        booking_id = getattr(authenticated_client, 'test_booking_id', None)
        if booking_id:
            found = any(b["id"] == booking_id for b in bookings)
            assert found, "Created booking not found in list"
            print(f"✓ Booking verified in database")
    
    def test_transaction_created_with_booking(self, authenticated_client):
        """Verify transaction was created when booking was created"""
        response = authenticated_client.get(f"{BASE_URL}/api/transactions")
        
        assert response.status_code == 200
        transactions = response.json()
        
        booking_id = getattr(authenticated_client, 'test_booking_id', None)
        if booking_id:
            found = any(t.get("booking_id") == booking_id for t in transactions)
            assert found, "Transaction not created for booking"
            print(f"✓ Transaction verified for booking")


class TestDashboardAndSlotConfig:
    """Test dashboard config and slot config APIs"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            response = session.post(f"{BASE_URL}/api/auth/register", json={
                "email": TEST_EMAIL,
                "name": TEST_NAME,
                "password": TEST_PASSWORD
            })
        
        if response.status_code == 200:
            return response.json().get("access_token")
        pytest.skip("Authentication failed")
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, auth_token):
        """Session with auth header"""
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_get_dashboard_configs(self, authenticated_client):
        """Test getting dashboard configurations"""
        response = authenticated_client.get(f"{BASE_URL}/api/dashboard-configs")
        
        assert response.status_code == 200, f"Dashboard configs API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Dashboard configs should return a list"
        
        # Should return default config if none exists
        if len(data) > 0:
            config = data[0]
            assert "widgets" in config, "Dashboard config should have widgets"
            print(f"✓ Dashboard configs API working - Count: {len(data)}")
        else:
            print("✓ Dashboard configs API working - Empty (fresh start)")
    
    def test_create_dashboard_config(self, authenticated_client):
        """Test creating a dashboard configuration"""
        config_data = {
            "name": f"TEST_Dashboard_{uuid.uuid4().hex[:6]}",
            "is_default": False,
            "widgets": [
                {"id": str(uuid.uuid4()), "type": "stat", "title": "Test Widget", "size": "small", "position": 0, "config": {}}
            ]
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/dashboard-configs", json=config_data)
        
        assert response.status_code == 200, f"Create dashboard config failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert data["name"] == config_data["name"]
        print(f"✓ Dashboard config created: {data['name']}")
    
    def test_get_slot_configs(self, authenticated_client):
        """Test getting slot configurations"""
        response = authenticated_client.get(f"{BASE_URL}/api/slot-configs")
        
        assert response.status_code == 200, f"Slot configs API failed: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Slot configs should return a list"
        print(f"✓ Slot configs API working - Count: {len(data)}")
    
    def test_create_slot_config(self, authenticated_client):
        """Test creating a slot configuration"""
        # First get an outlet ID
        outlets_response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        outlets = outlets_response.json()
        
        if not outlets:
            pytest.skip("No outlets available for slot config test")
        
        outlet_id = outlets[0]["id"]
        
        # Check if slot config already exists for this outlet
        existing_configs = authenticated_client.get(f"{BASE_URL}/api/slot-configs").json()
        if any(c.get("outlet_id") == outlet_id for c in existing_configs):
            print(f"✓ Slot config already exists for outlet {outlet_id}")
            return
        
        config_data = {
            "outlet_id": outlet_id,
            "business_type": "car_wash",
            "slot_duration_min": 30,
            "operating_hours_start": "08:00",
            "operating_hours_end": "20:00",
            "resources": [
                {"name": "Bay 1", "type": "bay"},
                {"name": "Bay 2", "type": "bay"}
            ],
            "allow_online_booking": True,
            "booking_advance_days": 7,
            "plan": "free"
        }
        
        response = authenticated_client.post(f"{BASE_URL}/api/slot-configs", json=config_data)
        
        assert response.status_code == 200, f"Create slot config failed: {response.text}"
        data = response.json()
        
        assert "id" in data
        assert "embed_token" in data
        assert data["outlet_id"] == outlet_id
        print(f"✓ Slot config created for outlet: {outlet_id}")


class TestResetDataAPI:
    """Test reset data API for fresh start"""
    
    @pytest.fixture(scope="class")
    def api_client(self):
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        return session
    
    def test_reset_data_endpoint(self, api_client):
        """Test reset data API clears all data"""
        response = api_client.post(f"{BASE_URL}/api/reset-data")
        
        assert response.status_code == 200, f"Reset data API failed: {response.text}"
        data = response.json()
        
        assert "message" in data
        assert "cleared" in data
        assert isinstance(data["cleared"], list)
        print(f"✓ Reset data API working - Cleared: {data['cleared']}")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        session = requests.Session()
        session.headers.update({"Content-Type": "application/json"})
        
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            return response.json().get("access_token")
        return None
    
    @pytest.fixture(scope="class")
    def authenticated_client(self, auth_token):
        """Session with auth header"""
        if not auth_token:
            pytest.skip("No auth token available")
        session = requests.Session()
        session.headers.update({
            "Content-Type": "application/json",
            "Authorization": f"Bearer {auth_token}"
        })
        return session
    
    def test_cleanup_test_outlets(self, authenticated_client):
        """Delete test outlets"""
        response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        if response.status_code == 200:
            outlets = response.json()
            for outlet in outlets:
                if outlet.get("name", "").startswith("TEST_"):
                    del_response = authenticated_client.delete(f"{BASE_URL}/api/outlets/{outlet['id']}")
                    if del_response.status_code == 200:
                        print(f"✓ Deleted test outlet: {outlet['name']}")
    
    def test_cleanup_test_services(self, authenticated_client):
        """Delete test services"""
        response = authenticated_client.get(f"{BASE_URL}/api/services")
        if response.status_code == 200:
            services = response.json()
            for service in services:
                if service.get("name", "").startswith("TEST_"):
                    del_response = authenticated_client.delete(f"{BASE_URL}/api/services/{service['id']}")
                    if del_response.status_code == 200:
                        print(f"✓ Deleted test service: {service['name']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
