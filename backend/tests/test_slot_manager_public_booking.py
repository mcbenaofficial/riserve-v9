"""
Test Slot Manager Calendar View and Public Booking Features
- Slot Manager calendar-style view with resources as columns
- Date navigation (Today, Day, Week, Month)
- Work Order button functionality
- Public booking page error handling
- Short URL route /b/:token support
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "test@example.com",
        "password": "test123"
    })
    if response.status_code == 200:
        return response.json().get("access_token")
    pytest.skip("Authentication failed - skipping authenticated tests")

@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Get headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}"}


class TestSlotManagerAPI:
    """Test Slot Manager related API endpoints"""
    
    def test_get_slot_configs(self, auth_headers):
        """Test fetching slot configurations"""
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} slot configs")
        
        # Verify config structure has resources for calendar columns
        if len(data) > 0:
            config = data[0]
            assert "outlet_id" in config
            print(f"Config has outlet_id: {config.get('outlet_id')}")
    
    def test_get_outlets(self, auth_headers):
        """Test fetching outlets for outlet selector dropdown"""
        response = requests.get(f"{BASE_URL}/api/outlets", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} outlets")
    
    def test_get_services(self, auth_headers):
        """Test fetching services for booking"""
        response = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} services")
    
    def test_get_resource_bookings(self, auth_headers):
        """Test fetching resource bookings for calendar view"""
        # First get an outlet with slot config
        configs_response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        configs = configs_response.json()
        
        if len(configs) > 0:
            outlet_id = configs[0].get("outlet_id")
            date = "2026-01-28"
            response = requests.get(f"{BASE_URL}/api/resource-bookings/{outlet_id}?date={date}", headers=auth_headers)
            assert response.status_code == 200
            data = response.json()
            assert isinstance(data, list)
            print(f"Found {len(data)} bookings for outlet {outlet_id} on {date}")
        else:
            pytest.skip("No slot configs available")


class TestPublicBookingAPI:
    """Test Public Booking API endpoints - No auth required"""
    
    def test_get_public_slot_config_full_token(self):
        """Test fetching public slot config with full embed token"""
        token = "5a37cfb5-7511-4e8b-b972-07e8f0011e4c"
        response = requests.get(f"{BASE_URL}/api/public/slot-config/{token}")
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "config" in data
        assert "outlet" in data
        assert "services" in data
        
        # Verify config has required fields for calendar
        config = data["config"]
        assert "operating_hours_start" in config
        assert "operating_hours_end" in config
        assert "slot_duration_min" in config
        
        print(f"Public config loaded for outlet: {data['outlet'].get('name')}")
        print(f"Operating hours: {config.get('operating_hours_start')} - {config.get('operating_hours_end')}")
    
    def test_get_public_slot_config_short_token(self):
        """Test fetching public slot config with short token (first 8 chars)"""
        short_token = "5a37cfb5"
        response = requests.get(f"{BASE_URL}/api/public/slot-config/{short_token}")
        assert response.status_code == 200
        data = response.json()
        
        assert "config" in data
        assert "outlet" in data
        print(f"PASS: Short token {short_token} works correctly")
    
    def test_public_booking_validation_error_format(self):
        """Test that validation errors return proper format (not objects)"""
        token = "5a37cfb5-7511-4e8b-b972-07e8f0011e4c"
        
        # First get config to get outlet_id
        config_response = requests.get(f"{BASE_URL}/api/public/slot-config/{token}")
        config_data = config_response.json()
        outlet_id = config_data["config"]["outlet_id"]
        
        # Send incomplete booking data to trigger validation error
        booking_data = {
            "outlet_id": outlet_id,
            "date": "2026-01-28",
            "time": "10:00",
            # Missing required fields: customer_name, customer_phone
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
        assert response.status_code == 422  # Validation error
        
        data = response.json()
        assert "detail" in data
        
        # Verify error format - should be array of objects with 'msg' field
        detail = data["detail"]
        assert isinstance(detail, list)
        if len(detail) > 0:
            assert "msg" in detail[0]
            print(f"Validation error message: {detail[0]['msg']}")
    
    def test_public_booking_success(self):
        """Test successful public booking creation"""
        token = "5a37cfb5-7511-4e8b-b972-07e8f0011e4c"
        
        # Get config
        config_response = requests.get(f"{BASE_URL}/api/public/slot-config/{token}")
        config_data = config_response.json()
        outlet_id = config_data["config"]["outlet_id"]
        services = config_data["services"]
        
        # Create booking with all required fields
        booking_data = {
            "outlet_id": outlet_id,
            "date": "2026-01-29",
            "time": "11:00",
            "customer_name": f"TEST_PublicBooking_{uuid.uuid4().hex[:6]}",
            "customer_phone": "9876543210",
            "service_id": services[0]["id"] if services else None,
            "service_ids": [services[0]["id"]] if services else []
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "booking_id" in data
        assert "message" in data
        print(f"PASS: Booking created with ID: {data['booking_id']}")
    
    def test_invalid_token_returns_404(self):
        """Test that invalid token returns 404"""
        invalid_token = "invalid-token-12345"
        response = requests.get(f"{BASE_URL}/api/public/slot-config/{invalid_token}")
        assert response.status_code == 404
        print("PASS: Invalid token returns 404")


class TestSlotConfigResources:
    """Test slot config resources for calendar columns"""
    
    def test_slot_config_has_resources(self, auth_headers):
        """Test that slot config has resources array for calendar columns"""
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200
        configs = response.json()
        
        if len(configs) > 0:
            config = configs[0]
            resources = config.get("resources", [])
            print(f"Config has {len(resources)} resources")
            
            # Verify resource structure
            for resource in resources:
                assert "id" in resource
                assert "name" in resource
                print(f"  - Resource: {resource['name']} (active: {resource.get('active', True)})")
        else:
            pytest.skip("No slot configs available")
    
    def test_slot_config_has_operating_hours(self, auth_headers):
        """Test that slot config has operating hours for time rows"""
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200
        configs = response.json()
        
        if len(configs) > 0:
            config = configs[0]
            assert "operating_hours_start" in config
            assert "operating_hours_end" in config
            assert "slot_duration_min" in config
            
            print(f"Operating hours: {config['operating_hours_start']} - {config['operating_hours_end']}")
            print(f"Slot duration: {config['slot_duration_min']} minutes")
        else:
            pytest.skip("No slot configs available")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
