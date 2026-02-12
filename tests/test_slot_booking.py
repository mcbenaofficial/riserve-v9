"""
Test suite for Multi-Slot Booking Configuration feature
Tests: Slot configs, customer fields, branding, public booking endpoints
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://book-manage.preview.emergentagent.com').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@ridn.com"
TEST_PASSWORD = "admin123"
EXISTING_EMBED_TOKEN = "6813b8dd-3bfc-4353-a0eb-d3e83c941874"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")


@pytest.fixture(scope="module")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="module")
def authenticated_client(api_client, auth_token):
    """Session with auth header"""
    api_client.headers.update({"Authorization": f"Bearer {auth_token}"})
    return api_client


class TestPublicBookingAPI:
    """Test public booking endpoints (no auth required)"""
    
    def test_get_public_booking_info_success(self, api_client):
        """GET /api/public/booking/{token} - returns config with customer_fields and branding"""
        response = api_client.get(f"{BASE_URL}/api/public/booking/{EXISTING_EMBED_TOKEN}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify outlet info
        assert "outlet" in data, "Response should contain outlet info"
        assert "name" in data["outlet"]
        assert "city" in data["outlet"]
        assert "address" in data["outlet"]
        
        # Verify config
        assert "config" in data, "Response should contain config"
        config = data["config"]
        assert "embed_token" in config
        assert config["embed_token"] == EXISTING_EMBED_TOKEN
        assert "allow_online_booking" in config
        assert config["allow_online_booking"] == True
        
        # Verify customer_fields (NEW FEATURE)
        assert "customer_fields" in config, "Config should contain customer_fields"
        customer_fields = config["customer_fields"]
        assert isinstance(customer_fields, list), "customer_fields should be a list"
        assert len(customer_fields) > 0, "customer_fields should not be empty"
        
        # Check customer field structure
        for field in customer_fields:
            assert "field_name" in field, "Each field should have field_name"
            assert "label" in field, "Each field should have label"
            assert "required" in field, "Each field should have required"
            assert "enabled" in field, "Each field should have enabled"
        
        # Verify branding (NEW FEATURE)
        assert "branding" in config, "Config should contain branding"
        branding = config["branding"]
        assert "primary_color" in branding
        assert "secondary_color" in branding
        assert "font_family" in branding
        
        # Verify plan
        assert "plan" in config, "Config should contain plan"
        assert config["plan"] in ["free", "plus"]
        
        # Verify services
        assert "services" in data, "Response should contain services"
        assert isinstance(data["services"], list)
        
        print(f"✓ Public booking info retrieved successfully")
        print(f"  - Outlet: {data['outlet']['name']}")
        print(f"  - Plan: {config['plan']}")
        print(f"  - Customer fields: {len(customer_fields)} configured")
        print(f"  - Branding: primary={branding['primary_color']}, font={branding['font_family']}")
    
    def test_get_public_booking_info_invalid_token(self, api_client):
        """GET /api/public/booking/{token} - returns 404 for invalid token"""
        invalid_token = str(uuid.uuid4())
        response = api_client.get(f"{BASE_URL}/api/public/booking/{invalid_token}")
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Invalid token correctly returns 404")
    
    def test_create_public_booking_success(self, api_client):
        """POST /api/public/booking/{token} - creates booking successfully"""
        booking_data = {
            "customer_name": f"TEST_Customer_{uuid.uuid4().hex[:8]}",
            "customer_phone": "9876543210",
            "customer_email": "test@example.com",
            "service_id": "8b779ec6-73da-498d-9001-916df0751002",  # Premium Wash
            "date": "2026-01-25",
            "time": "10:00",
            "notes": "Test booking from automated tests"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/public/booking/{EXISTING_EMBED_TOKEN}",
            json=booking_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "message" in data
        assert "booking_id" in data
        assert data["message"] == "Booking created successfully"
        
        print(f"✓ Public booking created successfully")
        print(f"  - Booking ID: {data['booking_id']}")
        print(f"  - Customer: {booking_data['customer_name']}")
    
    def test_create_public_booking_invalid_token(self, api_client):
        """POST /api/public/booking/{token} - returns 404 for invalid token"""
        invalid_token = str(uuid.uuid4())
        booking_data = {
            "customer_name": "Test Customer",
            "customer_phone": "1234567890",
            "service_id": "test-service",
            "date": "2026-01-25",
            "time": "10:00"
        }
        
        response = api_client.post(
            f"{BASE_URL}/api/public/booking/{invalid_token}",
            json=booking_data
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print(f"✓ Invalid token correctly returns 404 for POST")


class TestSlotConfigAPI:
    """Test slot configuration endpoints (auth required)"""
    
    def test_get_slot_configs(self, authenticated_client):
        """GET /api/slot-configs - returns list of configs"""
        response = authenticated_client.get(f"{BASE_URL}/api/slot-configs")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        
        if len(data) > 0:
            config = data[0]
            # Verify config structure
            assert "id" in config
            assert "outlet_id" in config
            assert "business_type" in config
            assert "slot_duration_min" in config
            assert "operating_hours_start" in config
            assert "operating_hours_end" in config
            assert "resources" in config
            assert "allow_online_booking" in config
            assert "embed_token" in config
            
            # Verify new fields
            assert "customer_fields" in config, "Config should have customer_fields"
            assert "branding" in config, "Config should have branding"
            assert "plan" in config, "Config should have plan"
        
        print(f"✓ Retrieved {len(data)} slot configurations")
    
    def test_get_outlets(self, authenticated_client):
        """GET /api/outlets - returns list of outlets for config creation"""
        response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one outlet"
        
        print(f"✓ Retrieved {len(data)} outlets")
        return data
    
    def test_create_slot_config_with_customer_fields_and_branding(self, authenticated_client):
        """POST /api/slot-configs - creates config with customer_fields and branding"""
        # First get an outlet without config
        outlets_response = authenticated_client.get(f"{BASE_URL}/api/outlets")
        outlets = outlets_response.json()
        
        configs_response = authenticated_client.get(f"{BASE_URL}/api/slot-configs")
        configs = configs_response.json()
        configured_outlet_ids = [c["outlet_id"] for c in configs]
        
        # Find an outlet without config
        unconfigured_outlets = [o for o in outlets if o["id"] not in configured_outlet_ids and o["status"] == "Active"]
        
        if not unconfigured_outlets:
            pytest.skip("No unconfigured outlets available for testing")
        
        outlet = unconfigured_outlets[0]
        
        config_data = {
            "outlet_id": outlet["id"],
            "business_type": "salon",
            "slot_duration_min": 45,
            "operating_hours_start": "09:00",
            "operating_hours_end": "18:00",
            "resources": [
                {"name": "TEST_Resource_1", "description": "Test resource", "active": True}
            ],
            "allow_online_booking": True,
            "booking_advance_days": 14,
            "customer_fields": [
                {"field_name": "name", "label": "Full Name", "required": True, "enabled": True},
                {"field_name": "phone", "label": "Phone", "required": True, "enabled": True},
                {"field_name": "email", "label": "Email", "required": False, "enabled": True},
                {"field_name": "vehicle", "label": "Vehicle", "required": False, "enabled": False},
                {"field_name": "notes", "label": "Notes", "required": False, "enabled": True}
            ],
            "plan": "plus",
            "branding": {
                "logo_url": "https://example.com/test-logo.png",
                "primary_color": "#FF0000",
                "secondary_color": "#000000",
                "font_family": "Montserrat",
                "business_name": "TEST_Business"
            }
        }
        
        response = authenticated_client.post(
            f"{BASE_URL}/api/slot-configs",
            json=config_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        
        # Verify created config
        assert data["outlet_id"] == outlet["id"]
        assert data["business_type"] == "salon"
        assert data["slot_duration_min"] == 45
        assert data["plan"] == "plus"
        
        # Verify customer_fields
        assert "customer_fields" in data
        assert len(data["customer_fields"]) == 5
        
        # Verify branding
        assert "branding" in data
        assert data["branding"]["primary_color"] == "#FF0000"
        assert data["branding"]["font_family"] == "Montserrat"
        assert data["branding"]["business_name"] == "TEST_Business"
        
        print(f"✓ Created slot config with customer_fields and branding")
        print(f"  - Config ID: {data['id']}")
        print(f"  - Outlet: {outlet['name']}")
        
        # Store for cleanup
        return data
    
    def test_update_slot_config(self, authenticated_client):
        """PUT /api/slot-configs/{id} - updates config"""
        # Get existing configs
        configs_response = authenticated_client.get(f"{BASE_URL}/api/slot-configs")
        configs = configs_response.json()
        
        if not configs:
            pytest.skip("No configs available for update test")
        
        config = configs[0]
        
        update_data = {
            "outlet_id": config["outlet_id"],
            "business_type": config.get("business_type", "car_wash"),
            "slot_duration_min": 60,  # Changed
            "operating_hours_start": config.get("operating_hours_start", "08:00"),
            "operating_hours_end": config.get("operating_hours_end", "20:00"),
            "resources": config.get("resources", []),
            "allow_online_booking": config.get("allow_online_booking", True),
            "booking_advance_days": 21,  # Changed
            "customer_fields": config.get("customer_fields", []),
            "plan": config.get("plan", "free"),
            "branding": config.get("branding", {})
        }
        
        response = authenticated_client.put(
            f"{BASE_URL}/api/slot-configs/{config['id']}",
            json=update_data
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert data["slot_duration_min"] == 60
        assert data["booking_advance_days"] == 21
        
        print(f"✓ Updated slot config successfully")
        print(f"  - Config ID: {config['id']}")
        print(f"  - New duration: 60 mins")
        print(f"  - New advance days: 21")


class TestAuthAPI:
    """Test authentication endpoints"""
    
    def test_login_success(self, api_client):
        """POST /api/auth/login - successful login"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        
        print(f"✓ Login successful for {TEST_EMAIL}")
    
    def test_login_invalid_credentials(self, api_client):
        """POST /api/auth/login - invalid credentials"""
        response = api_client.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print(f"✓ Invalid credentials correctly returns 401")


class TestServicesAPI:
    """Test services endpoints"""
    
    def test_get_services(self, authenticated_client):
        """GET /api/services - returns list of services"""
        response = authenticated_client.get(f"{BASE_URL}/api/services")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        
        if len(data) > 0:
            service = data[0]
            assert "id" in service
            assert "name" in service
            assert "duration_min" in service
            assert "price" in service
            assert "active" in service
        
        print(f"✓ Retrieved {len(data)} services")


class TestResourceBookingsAPI:
    """Test resource bookings endpoints"""
    
    def test_get_resource_bookings(self, authenticated_client):
        """GET /api/resource-bookings/{outlet_id} - returns bookings for outlet"""
        # Get an outlet with config
        configs_response = authenticated_client.get(f"{BASE_URL}/api/slot-configs")
        configs = configs_response.json()
        
        if not configs:
            pytest.skip("No configs available")
        
        outlet_id = configs[0]["outlet_id"]
        
        response = authenticated_client.get(f"{BASE_URL}/api/resource-bookings/{outlet_id}")
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert isinstance(data, list)
        
        print(f"✓ Retrieved {len(data)} resource bookings for outlet")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
