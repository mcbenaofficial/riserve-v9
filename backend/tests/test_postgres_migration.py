"""
Comprehensive Backend API Tests for PostgreSQL Migration
Tests all CRUD operations for: Auth, Outlets, Services, Bookings, Transactions, Reports, Slot Configs, Dashboard Configs
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@ridn.com"
TEST_PASSWORD = "admin123"

class TestAuthEndpoints:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        assert data["token_type"] == "bearer"
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_register_new_user(self):
        """Test user registration"""
        unique_email = f"TEST_user_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": unique_email,
            "password": "testpass123",
            "name": "Test User"
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert data["user"]["email"] == unique_email
        print(f"✓ User registration successful for {unique_email}")
    
    def test_register_duplicate_email(self):
        """Test registration with existing email"""
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_EMAIL,
            "password": "testpass123",
            "name": "Duplicate User"
        })
        assert response.status_code == 400
        print("✓ Duplicate email correctly rejected")
    
    def test_get_current_user(self):
        """Test GET /api/auth/me endpoint"""
        # First login to get token
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = login_response.json()["access_token"]
        
        # Get current user
        response = requests.get(f"{BASE_URL}/api/auth/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert response.status_code == 200, f"Get me failed: {response.text}"
        data = response.json()
        assert data["email"] == TEST_EMAIL
        print(f"✓ GET /api/auth/me returned correct user: {data['email']}")


class TestOutletEndpoints:
    """Outlet CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_outlets(self):
        """Test GET /api/outlets"""
        response = requests.get(f"{BASE_URL}/api/outlets", headers=self.headers)
        assert response.status_code == 200, f"Get outlets failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/outlets returned {len(data)} outlets")
    
    def test_create_outlet(self):
        """Test POST /api/outlets"""
        outlet_data = {
            "name": f"TEST_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Test City",
            "address": "123 Test Street",
            "capacity": 5,
            "machines": 3,
            "rating": 4.5,
            "solar": True,
            "water_recycle": False,
            "services_offered": []
        }
        response = requests.post(f"{BASE_URL}/api/outlets", json=outlet_data, headers=self.headers)
        assert response.status_code == 200, f"Create outlet failed: {response.text}"
        data = response.json()
        assert data["name"] == outlet_data["name"]
        assert data["city"] == outlet_data["city"]
        assert "id" in data
        print(f"✓ Created outlet: {data['name']} with id: {data['id']}")
        return data["id"]
    
    def test_update_outlet(self):
        """Test PUT /api/outlets/{outlet_id}"""
        # First create an outlet
        outlet_data = {
            "name": f"TEST_Update_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Original City",
            "address": "Original Address",
            "capacity": 2,
            "machines": 1,
            "rating": 4.0,
            "solar": False,
            "water_recycle": False,
            "services_offered": []
        }
        create_response = requests.post(f"{BASE_URL}/api/outlets", json=outlet_data, headers=self.headers)
        outlet_id = create_response.json()["id"]
        
        # Update the outlet
        updated_data = {
            "name": f"TEST_Updated_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Updated City",
            "address": "Updated Address",
            "capacity": 10,
            "machines": 5,
            "rating": 4.8,
            "solar": True,
            "water_recycle": True,
            "services_offered": []
        }
        response = requests.put(f"{BASE_URL}/api/outlets/{outlet_id}", json=updated_data, headers=self.headers)
        assert response.status_code == 200, f"Update outlet failed: {response.text}"
        data = response.json()
        assert data["city"] == "Updated City"
        assert data["capacity"] == 10
        print(f"✓ Updated outlet: {outlet_id}")
    
    def test_delete_outlet(self):
        """Test DELETE /api/outlets/{outlet_id}"""
        # First create an outlet
        outlet_data = {
            "name": f"TEST_Delete_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Delete City",
            "address": "Delete Address",
            "capacity": 1,
            "machines": 1,
            "rating": 3.0,
            "solar": False,
            "water_recycle": False,
            "services_offered": []
        }
        create_response = requests.post(f"{BASE_URL}/api/outlets", json=outlet_data, headers=self.headers)
        outlet_id = create_response.json()["id"]
        
        # Delete the outlet
        response = requests.delete(f"{BASE_URL}/api/outlets/{outlet_id}", headers=self.headers)
        assert response.status_code == 200, f"Delete outlet failed: {response.text}"
        print(f"✓ Deleted outlet: {outlet_id}")


class TestServiceEndpoints:
    """Service CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_services(self):
        """Test GET /api/services"""
        response = requests.get(f"{BASE_URL}/api/services", headers=self.headers)
        assert response.status_code == 200, f"Get services failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/services returned {len(data)} services")
    
    def test_create_service(self):
        """Test POST /api/services"""
        service_data = {
            "name": f"TEST_Service_{uuid.uuid4().hex[:6]}",
            "duration_min": 45,
            "price": 499,
            "description": "Test service description"
        }
        response = requests.post(f"{BASE_URL}/api/services", json=service_data, headers=self.headers)
        assert response.status_code == 200, f"Create service failed: {response.text}"
        data = response.json()
        assert data["name"] == service_data["name"]
        assert data["duration_min"] == 45
        assert data["price"] == 499
        print(f"✓ Created service: {data['name']} with id: {data['id']}")
        return data["id"]
    
    def test_update_service(self):
        """Test PUT /api/services/{service_id}"""
        # First create a service
        service_data = {
            "name": f"TEST_Update_Service_{uuid.uuid4().hex[:6]}",
            "duration_min": 30,
            "price": 299,
            "description": "Original description"
        }
        create_response = requests.post(f"{BASE_URL}/api/services", json=service_data, headers=self.headers)
        service_id = create_response.json()["id"]
        
        # Update the service
        updated_data = {
            "name": f"TEST_Updated_Service_{uuid.uuid4().hex[:6]}",
            "duration_min": 60,
            "price": 599,
            "description": "Updated description"
        }
        response = requests.put(f"{BASE_URL}/api/services/{service_id}", json=updated_data, headers=self.headers)
        assert response.status_code == 200, f"Update service failed: {response.text}"
        data = response.json()
        assert data["duration_min"] == 60
        assert data["price"] == 599
        print(f"✓ Updated service: {service_id}")
    
    def test_delete_service(self):
        """Test DELETE /api/services/{service_id}"""
        # First create a service
        service_data = {
            "name": f"TEST_Delete_Service_{uuid.uuid4().hex[:6]}",
            "duration_min": 15,
            "price": 199,
            "description": "To be deleted"
        }
        create_response = requests.post(f"{BASE_URL}/api/services", json=service_data, headers=self.headers)
        service_id = create_response.json()["id"]
        
        # Delete the service
        response = requests.delete(f"{BASE_URL}/api/services/{service_id}", headers=self.headers)
        assert response.status_code == 200, f"Delete service failed: {response.text}"
        print(f"✓ Deleted service: {service_id}")


class TestBookingEndpoints:
    """Booking CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and test data before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get an outlet and service for booking tests
        outlets_response = requests.get(f"{BASE_URL}/api/outlets", headers=self.headers)
        self.outlets = outlets_response.json()
        
        services_response = requests.get(f"{BASE_URL}/api/services", headers=self.headers)
        self.services = services_response.json()
    
    def test_get_bookings(self):
        """Test GET /api/bookings"""
        response = requests.get(f"{BASE_URL}/api/bookings", headers=self.headers)
        assert response.status_code == 200, f"Get bookings failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/bookings returned {len(data)} bookings")
    
    def test_create_booking(self):
        """Test POST /api/bookings"""
        if not self.outlets or not self.services:
            pytest.skip("No outlets or services available for booking test")
        
        booking_data = {
            "customer": f"TEST_Customer_{uuid.uuid4().hex[:6]}",
            "vehicle": "TEST-1234",
            "time": "10:00",
            "service_id": self.services[0]["id"],
            "outlet_id": self.outlets[0]["id"],
            "amount": 500
        }
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=self.headers)
        assert response.status_code == 200, f"Create booking failed: {response.text}"
        data = response.json()
        assert data["customer"] == booking_data["customer"]
        assert data["status"] == "Pending"
        assert "id" in data
        print(f"✓ Created booking: {data['id']} for customer: {data['customer']}")
        return data["id"]


class TestTransactionEndpoints:
    """Transaction endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_transactions(self):
        """Test GET /api/transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=self.headers)
        assert response.status_code == 200, f"Get transactions failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Verify transaction structure
        if len(data) > 0:
            tx = data[0]
            assert "id" in tx
            assert "gross" in tx
            assert "commission" in tx
            assert "partner_share" in tx
        print(f"✓ GET /api/transactions returned {len(data)} transactions")


class TestReportEndpoints:
    """Report endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_reports(self):
        """Test GET /api/reports"""
        response = requests.get(f"{BASE_URL}/api/reports", headers=self.headers)
        assert response.status_code == 200, f"Get reports failed: {response.text}"
        data = response.json()
        assert "totalOutlets" in data
        assert "totalBookings" in data
        assert "totalRevenue" in data
        assert "avgRating" in data
        print(f"✓ GET /api/reports: Outlets={data['totalOutlets']}, Bookings={data['totalBookings']}, Revenue=₹{data['totalRevenue']}")


class TestSlotConfigEndpoints:
    """Slot Configuration CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token and test outlet before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
        
        # Get outlets for slot config tests
        outlets_response = requests.get(f"{BASE_URL}/api/outlets", headers=self.headers)
        self.outlets = outlets_response.json()
    
    def test_get_slot_configs(self):
        """Test GET /api/slot-configs"""
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=self.headers)
        assert response.status_code == 200, f"Get slot configs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/slot-configs returned {len(data)} configs")
    
    def test_create_slot_config(self):
        """Test POST /api/slot-configs"""
        # Create a new outlet for this test to avoid conflicts
        outlet_data = {
            "name": f"TEST_SlotConfig_Outlet_{uuid.uuid4().hex[:6]}",
            "city": "Slot City",
            "address": "Slot Address",
            "capacity": 3,
            "machines": 2,
            "rating": 4.0,
            "solar": False,
            "water_recycle": False,
            "services_offered": []
        }
        outlet_response = requests.post(f"{BASE_URL}/api/outlets", json=outlet_data, headers=self.headers)
        outlet_id = outlet_response.json()["id"]
        
        config_data = {
            "outlet_id": outlet_id,
            "business_type": "car_wash",
            "slot_duration_min": 30,
            "operating_hours_start": "09:00",
            "operating_hours_end": "18:00",
            "resources": [{"name": "Bay 1", "active": True}],
            "allow_online_booking": True,
            "booking_advance_days": 7,
            "plan": "free"
        }
        response = requests.post(f"{BASE_URL}/api/slot-configs", json=config_data, headers=self.headers)
        assert response.status_code == 200, f"Create slot config failed: {response.text}"
        data = response.json()
        assert data["outlet_id"] == outlet_id
        assert data["business_type"] == "car_wash"
        assert "embed_token" in data
        print(f"✓ Created slot config for outlet: {outlet_id}")
        return data["id"]


class TestDashboardConfigEndpoints:
    """Dashboard Configuration CRUD endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_dashboard_configs(self):
        """Test GET /api/dashboard-configs"""
        response = requests.get(f"{BASE_URL}/api/dashboard-configs", headers=self.headers)
        assert response.status_code == 200, f"Get dashboard configs failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        # Should return at least default config
        assert len(data) >= 1
        # Verify structure
        config = data[0]
        assert "widgets" in config
        assert "name" in config
        print(f"✓ GET /api/dashboard-configs returned {len(data)} configs with {len(config.get('widgets', []))} widgets")
    
    def test_create_dashboard_config(self):
        """Test POST /api/dashboard-configs"""
        config_data = {
            "name": f"TEST_Dashboard_{uuid.uuid4().hex[:6]}",
            "is_default": False,
            "widgets": [
                {"type": "stat", "title": "Test Widget", "size": "small", "position": 0, "config": {}}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/dashboard-configs", json=config_data, headers=self.headers)
        assert response.status_code == 200, f"Create dashboard config failed: {response.text}"
        data = response.json()
        assert data["name"] == config_data["name"]
        assert len(data["widgets"]) >= 1
        print(f"✓ Created dashboard config: {data['name']}")
        return data["id"]


class TestUserEndpoints:
    """User management endpoint tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        login_response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        self.token = login_response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_users(self):
        """Test GET /api/users"""
        response = requests.get(f"{BASE_URL}/api/users", headers=self.headers)
        assert response.status_code == 200, f"Get users failed: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/users returned {len(data)} users")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
