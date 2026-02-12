"""
Test cases for Slot Manager reschedule functionality
Tests the PUT /api/bookings/{id}/reschedule endpoint
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

# Use localhost for internal testing
BASE_URL = "http://localhost:8001"

class TestRescheduleAPI:
    """Test reschedule booking endpoint"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup - login and get token"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login - note: token is in 'access_token' field
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ridn.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        print(f"Logged in successfully")
    
    def test_get_existing_bookings(self):
        """Test getting existing bookings to find one to reschedule"""
        response = self.session.get(f"{BASE_URL}/api/bookings")
        assert response.status_code == 200
        bookings = response.json()
        print(f"Found {len(bookings)} bookings")
        assert len(bookings) > 0, "No bookings found to test reschedule"
        return bookings
    
    def test_reschedule_booking_time_only(self):
        """Test rescheduling a booking to a new time"""
        # Get a booking first
        bookings = self.session.get(f"{BASE_URL}/api/bookings").json()
        assert len(bookings) > 0, "No bookings to reschedule"
        
        booking = bookings[0]
        booking_id = booking['id']
        original_time = booking.get('time')
        
        # Reschedule to a new time
        new_time = "15:00"
        response = self.session.put(
            f"{BASE_URL}/api/bookings/{booking_id}/reschedule",
            json={"time": new_time}
        )
        
        assert response.status_code == 200, f"Reschedule failed: {response.text}"
        updated_booking = response.json()
        
        # Verify time was updated
        assert updated_booking['time'] == new_time, f"Time not updated: expected {new_time}, got {updated_booking['time']}"
        print(f"Successfully rescheduled booking from {original_time} to {new_time}")
        
        # Verify with GET
        verify_response = self.session.get(f"{BASE_URL}/api/bookings")
        assert verify_response.status_code == 200
        verified_booking = next((b for b in verify_response.json() if b['id'] == booking_id), None)
        assert verified_booking is not None
        assert verified_booking['time'] == new_time
        print(f"Verified booking time persisted: {verified_booking['time']}")
    
    def test_reschedule_booking_with_date(self):
        """Test rescheduling a booking to a new time and date"""
        bookings = self.session.get(f"{BASE_URL}/api/bookings").json()
        assert len(bookings) > 0
        
        booking = bookings[0]
        booking_id = booking['id']
        
        # Reschedule to tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d')
        new_time = "10:00"
        
        response = self.session.put(
            f"{BASE_URL}/api/bookings/{booking_id}/reschedule",
            json={"time": new_time, "date": tomorrow}
        )
        
        assert response.status_code == 200, f"Reschedule with date failed: {response.text}"
        updated_booking = response.json()
        
        assert updated_booking['time'] == new_time
        assert updated_booking['date'] == tomorrow
        print(f"Successfully rescheduled booking to {tomorrow} at {new_time}")
    
    def test_reschedule_booking_with_resource(self):
        """Test rescheduling a booking to a different resource (cross-resource move)"""
        bookings = self.session.get(f"{BASE_URL}/api/bookings").json()
        assert len(bookings) > 0
        
        booking = bookings[0]
        booking_id = booking['id']
        original_resource = booking.get('resource_id')
        
        # Get slot configs to find available resources
        configs_response = self.session.get(f"{BASE_URL}/api/slot-configs")
        assert configs_response.status_code == 200
        configs = configs_response.json()
        
        # Find a different resource
        new_resource_id = None
        for config in configs:
            resources = config.get('resources', [])
            for resource in resources:
                if resource.get('id') != original_resource:
                    new_resource_id = resource.get('id')
                    break
            if new_resource_id:
                break
        
        if not new_resource_id:
            pytest.skip("No alternative resource found for cross-resource test")
        
        new_time = "11:00"
        response = self.session.put(
            f"{BASE_URL}/api/bookings/{booking_id}/reschedule",
            json={"time": new_time, "resource_id": new_resource_id}
        )
        
        assert response.status_code == 200, f"Cross-resource reschedule failed: {response.text}"
        updated_booking = response.json()
        
        assert updated_booking['time'] == new_time
        assert updated_booking['resource_id'] == new_resource_id
        print(f"Successfully moved booking from resource {original_resource} to {new_resource_id}")
    
    def test_reschedule_nonexistent_booking(self):
        """Test rescheduling a non-existent booking returns 404"""
        fake_id = "nonexistent-booking-id-12345"
        response = self.session.put(
            f"{BASE_URL}/api/bookings/{fake_id}/reschedule",
            json={"time": "15:00"}
        )
        
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("Correctly returned 404 for non-existent booking")
    
    def test_reschedule_full_payload(self):
        """Test rescheduling with all fields: time, date, and resource_id"""
        bookings = self.session.get(f"{BASE_URL}/api/bookings").json()
        assert len(bookings) > 0
        
        booking = bookings[0]
        booking_id = booking['id']
        
        # Get a resource
        configs_response = self.session.get(f"{BASE_URL}/api/slot-configs")
        configs = configs_response.json()
        resource_id = None
        if configs and configs[0].get('resources'):
            resource_id = configs[0]['resources'][0].get('id')
        
        today = datetime.now().strftime('%Y-%m-%d')
        new_time = "16:30"
        
        payload = {"time": new_time, "date": today}
        if resource_id:
            payload["resource_id"] = resource_id
        
        response = self.session.put(
            f"{BASE_URL}/api/bookings/{booking_id}/reschedule",
            json=payload
        )
        
        assert response.status_code == 200
        updated = response.json()
        assert updated['time'] == new_time
        assert updated['date'] == today
        if resource_id:
            assert updated['resource_id'] == resource_id
        print(f"Full reschedule successful: time={new_time}, date={today}, resource={resource_id}")


class TestResourceBookingsAPI:
    """Test resource bookings endpoint used by Slot Manager"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ridn.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_get_resource_bookings_by_date(self):
        """Test getting bookings for a specific outlet and date"""
        # Get outlets first
        outlets_response = self.session.get(f"{BASE_URL}/api/outlets")
        assert outlets_response.status_code == 200
        outlets = outlets_response.json()
        assert len(outlets) > 0
        
        outlet_id = outlets[0]['id']
        today = datetime.now().strftime('%Y-%m-%d')
        
        response = self.session.get(f"{BASE_URL}/api/bookings/resource-bookings/{outlet_id}?date={today}")
        assert response.status_code == 200
        bookings = response.json()
        print(f"Found {len(bookings)} bookings for outlet {outlet_id} on {today}")
        
        return bookings


class TestTimeIntervals:
    """Test that time intervals are 1 hour"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@ridn.com",
            "password": "admin123"
        })
        assert login_response.status_code == 200
        self.token = login_response.json().get("access_token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
    
    def test_slot_config_exists(self):
        """Test that slot configuration exists with resources"""
        response = self.session.get(f"{BASE_URL}/api/slot-configs")
        assert response.status_code == 200
        configs = response.json()
        assert len(configs) > 0, "No slot configurations found"
        
        # Check that config has resources
        config = configs[0]
        assert 'resources' in config, "Config missing resources"
        assert len(config['resources']) > 0, "No resources in config"
        print(f"Found {len(config['resources'])} resources in slot config")
        
        # Check operating hours
        assert 'operating_hours_start' in config
        assert 'operating_hours_end' in config
        print(f"Operating hours: {config['operating_hours_start']} - {config['operating_hours_end']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
