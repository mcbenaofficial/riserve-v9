"""
Backend API Tests for Ri'DN Partner Dashboard
Tests public booking flow, bookings CRUD, and finance integration
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

@pytest.fixture(scope="module")
def auth_headers():
    """Get authentication token - shared across all tests"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": "admin@ridn.com",
        "password": "admin123"
    })
    if response.status_code != 200:
        pytest.skip(f"Authentication failed: {response.status_code} - {response.text}")
    
    data = response.json()
    # Handle both 'token' and 'access_token' response formats
    token = data.get('token') or data.get('access_token')
    if not token:
        pytest.skip("No token in response")
    return {"Authorization": f"Bearer {token}"}


class TestAuthentication:
    """Test authentication endpoints"""
    
    def test_login_success(self):
        """Test successful login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ridn.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        
        data = response.json()
        # Handle both 'token' and 'access_token' response formats
        token = data.get('token') or data.get('access_token')
        assert token is not None, "No token in response"
        assert 'user' in data
        print(f"✓ Login successful for user: {data['user'].get('email')}")
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 404], f"Expected 401/404, got {response.status_code}"
        print("✓ Invalid credentials correctly rejected")


class TestPublicBookingFlow:
    """Test public booking endpoint and data flow"""
    
    def test_get_public_slot_config(self, auth_headers):
        """Test fetching public slot configuration"""
        # First get a valid embed token from slot configs (requires auth)
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get slot configs: {response.status_code} - {response.text}"
        configs = response.json()
        assert len(configs) > 0, "No slot configs found"
        
        embed_token = configs[0].get('embed_token')
        assert embed_token, "No embed token in slot config"
        
        # Test public endpoint (no auth required)
        response = requests.get(f"{BASE_URL}/api/public/slot-config/{embed_token}")
        assert response.status_code == 200, f"Public endpoint failed: {response.text}"
        
        data = response.json()
        assert 'config' in data
        assert 'outlet' in data
        assert 'services' in data
        assert data['config']['outlet_id'] is not None
        print(f"✓ Public slot config retrieved for outlet: {data['outlet']['name']}")
    
    def test_create_public_booking(self, auth_headers):
        """Test creating a booking via public endpoint"""
        # Get slot config first (requires auth)
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200
        configs = response.json()
        config = configs[0]
        outlet_id = config['outlet_id']
        
        # Get services via public endpoint
        response = requests.get(f"{BASE_URL}/api/public/slot-config/{config['embed_token']}")
        services = response.json()['services']
        service_id = services[0]['id'] if services else None
        
        # Create booking (no auth required)
        booking_data = {
            "outlet_id": outlet_id,
            "resource_id": config['resources'][0]['id'] if config.get('resources') else None,
            "date": datetime.now().strftime('%Y-%m-%d'),
            "time": "14:00",
            "service_id": service_id,
            "service_ids": [service_id] if service_id else [],
            "customer_name": "TEST_Public_Booking",
            "customer_phone": "9876500001",
            "customer_email": "test_public@example.com",
            "vehicle": "TN01TEST",
            "total_amount": 399
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
        assert response.status_code == 200, f"Failed to create booking: {response.text}"
        
        data = response.json()
        assert 'booking_id' in data
        assert data['message'] == 'Booking created successfully'
        print(f"✓ Public booking created with ID: {data['booking_id']}")
        
        return data['booking_id']


class TestBookingsAPI:
    """Test authenticated bookings endpoints"""
    
    def test_get_all_bookings(self, auth_headers):
        """Test fetching all bookings"""
        response = requests.get(f"{BASE_URL}/api/bookings", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ Retrieved {len(bookings)} bookings")
    
    def test_get_resource_bookings(self, auth_headers):
        """Test fetching bookings for a specific outlet/resource"""
        # Get outlet ID first
        response = requests.get(f"{BASE_URL}/api/outlets", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get outlets: {response.status_code}"
        outlets = response.json()
        outlet_id = outlets[0]['id']
        
        # Get resource bookings
        today = datetime.now().strftime('%Y-%m-%d')
        response = requests.get(
            f"{BASE_URL}/api/bookings/resource-bookings/{outlet_id}?date={today}",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        bookings = response.json()
        assert isinstance(bookings, list)
        print(f"✓ Retrieved {len(bookings)} resource bookings for {today}")
    
    def test_create_booking_authenticated(self, auth_headers):
        """Test creating a booking via authenticated endpoint"""
        # Get outlet and service
        response = requests.get(f"{BASE_URL}/api/outlets", headers=auth_headers)
        assert response.status_code == 200
        outlet_id = response.json()[0]['id']
        
        response = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        assert response.status_code == 200
        services = response.json()
        service_id = services[0]['id'] if services else None
        
        booking_data = {
            "customer": "TEST_Auth_Booking",
            "customer_phone": "9876500002",
            "vehicle": "TN02TEST",
            "time": "15:00",
            "date": datetime.now().strftime('%Y-%m-%d'),
            "service_id": service_id,
            "service_ids": [service_id] if service_id else [],
            "outlet_id": outlet_id,
            "amount": 499
        }
        
        response = requests.post(f"{BASE_URL}/api/bookings", json=booking_data, headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert 'id' in data
        assert data['customer'] == "TEST_Auth_Booking"
        print(f"✓ Authenticated booking created with ID: {data['id']}")
        
        return data['id']
    
    def test_update_booking_status(self, auth_headers):
        """Test updating booking status"""
        # Get a booking first
        response = requests.get(f"{BASE_URL}/api/bookings", headers=auth_headers)
        assert response.status_code == 200
        bookings = response.json()
        if not bookings:
            pytest.skip("No bookings to update")
        
        booking_id = bookings[0]['id']
        
        # Update status
        response = requests.put(
            f"{BASE_URL}/api/bookings/{booking_id}?status=In Progress",
            headers=auth_headers
        )
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        data = response.json()
        assert data['status'] == 'In Progress'
        print(f"✓ Booking {booking_id} status updated to 'In Progress'")


class TestTransactionsAPI:
    """Test transactions/finance endpoints"""
    
    def test_get_transactions(self, auth_headers):
        """Test fetching all transactions"""
        response = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        transactions = response.json()
        assert isinstance(transactions, list)
        
        # Verify transaction structure
        if transactions:
            tx = transactions[0]
            assert 'gross' in tx
            assert 'commission' in tx
            assert 'partner_share' in tx
            assert 'booking_id' in tx
        
        print(f"✓ Retrieved {len(transactions)} transactions")
    
    def test_transaction_created_for_booking(self, auth_headers):
        """Test that transactions are created when bookings are made"""
        # Get slot config
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200
        config = response.json()[0]
        
        booking_data = {
            "outlet_id": config['outlet_id'],
            "date": datetime.now().strftime('%Y-%m-%d'),
            "time": "16:00",
            "customer_name": "TEST_Transaction_Check",
            "customer_phone": "9876500003",
            "total_amount": 599
        }
        
        response = requests.post(f"{BASE_URL}/api/public/book", json=booking_data)
        assert response.status_code == 200
        booking_id = response.json()['booking_id']
        
        # Check transaction was created
        response = requests.get(f"{BASE_URL}/api/transactions", headers=auth_headers)
        transactions = response.json()
        
        # Find transaction for this booking
        booking_tx = [tx for tx in transactions if tx.get('booking_id') == booking_id]
        assert len(booking_tx) > 0, "Transaction not created for booking"
        
        tx = booking_tx[0]
        assert tx['gross'] == 599
        assert tx['commission'] == int(599 * 0.15)  # 15% commission
        assert tx['partner_share'] == 599 - int(599 * 0.15)
        
        print(f"✓ Transaction created for booking {booking_id}: Gross=₹{tx['gross']}, Commission=₹{tx['commission']}")


class TestSlotConfigAPI:
    """Test slot configuration endpoints"""
    
    def test_get_slot_configs(self, auth_headers):
        """Test fetching slot configurations"""
        response = requests.get(f"{BASE_URL}/api/slot-configs", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        configs = response.json()
        assert isinstance(configs, list)
        
        if configs:
            config = configs[0]
            assert 'outlet_id' in config
            assert 'resources' in config
            assert 'operating_hours_start' in config
            assert 'operating_hours_end' in config
        
        print(f"✓ Retrieved {len(configs)} slot configurations")


class TestServicesAPI:
    """Test services endpoints"""
    
    def test_get_services(self, auth_headers):
        """Test fetching services"""
        response = requests.get(f"{BASE_URL}/api/services", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        services = response.json()
        assert isinstance(services, list)
        
        if services:
            service = services[0]
            assert 'name' in service
            assert 'price' in service
            assert 'duration_min' in service
        
        print(f"✓ Retrieved {len(services)} services")


class TestOutletsAPI:
    """Test outlets endpoints"""
    
    def test_get_outlets(self, auth_headers):
        """Test fetching outlets"""
        response = requests.get(f"{BASE_URL}/api/outlets", headers=auth_headers)
        assert response.status_code == 200, f"Failed: {response.status_code} - {response.text}"
        
        outlets = response.json()
        assert isinstance(outlets, list)
        assert len(outlets) > 0
        
        outlet = outlets[0]
        assert 'id' in outlet
        assert 'name' in outlet
        assert 'city' in outlet
        
        print(f"✓ Retrieved {len(outlets)} outlets")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
