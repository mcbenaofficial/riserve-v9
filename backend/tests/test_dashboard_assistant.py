"""
Test suite for Dashboard Configuration and AI Assistant features
- Dashboard config CRUD operations
- AI Assistant chat and image generation
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "admin@ridn.com"
TEST_PASSWORD = "admin123"


class TestAuth:
    """Authentication tests"""
    
    def test_login_success(self):
        """Test login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "access_token" in data
        assert "user" in data
        assert data["user"]["email"] == TEST_EMAIL
        print(f"✓ Login successful for {TEST_EMAIL}")
        return data["access_token"]


class TestDashboardConfig:
    """Dashboard Configuration API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_dashboard_configs(self):
        """Test GET /api/dashboard-configs returns configs"""
        response = requests.get(f"{BASE_URL}/api/dashboard-configs", headers=self.headers)
        assert response.status_code == 200, f"Failed to get configs: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should return at least default config"
        
        # Verify config structure
        config = data[0]
        assert "id" in config
        assert "name" in config
        assert "widgets" in config
        assert "is_default" in config
        print(f"✓ GET /api/dashboard-configs returned {len(data)} config(s)")
        return data
    
    def test_dashboard_config_has_default_widgets(self):
        """Test that default config has expected widgets"""
        response = requests.get(f"{BASE_URL}/api/dashboard-configs", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        
        # Find default config
        default_config = next((c for c in data if c.get("is_default")), data[0])
        widgets = default_config.get("widgets", [])
        
        # Check for expected widget types
        widget_types = [w.get("type") for w in widgets]
        assert "stat" in widget_types or len(widgets) > 0, "Should have widgets"
        print(f"✓ Default config has {len(widgets)} widgets")
    
    def test_create_dashboard_config(self):
        """Test POST /api/dashboard-configs creates new config"""
        new_config = {
            "name": "TEST_Dashboard_New",
            "is_default": False,
            "widgets": [
                {"type": "stat", "title": "Test Widget", "size": "small", "position": 0, "config": {"metric": "outlets"}}
            ]
        }
        response = requests.post(f"{BASE_URL}/api/dashboard-configs", json=new_config, headers=self.headers)
        assert response.status_code == 200, f"Failed to create config: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Dashboard_New"
        assert len(data["widgets"]) == 1
        print(f"✓ Created dashboard config: {data['name']}")
        return data
    
    def test_update_dashboard_config(self):
        """Test PUT /api/dashboard-configs/{id} updates config"""
        # First create a config
        new_config = {
            "name": "TEST_Dashboard_Update",
            "is_default": False,
            "widgets": []
        }
        create_response = requests.post(f"{BASE_URL}/api/dashboard-configs", json=new_config, headers=self.headers)
        assert create_response.status_code == 200
        config_id = create_response.json()["id"]
        
        # Update the config
        update_data = {
            "name": "TEST_Dashboard_Updated",
            "is_default": False,
            "widgets": [
                {"type": "recentBookings", "title": "Recent Bookings", "size": "medium", "position": 0, "config": {}}
            ]
        }
        response = requests.put(f"{BASE_URL}/api/dashboard-configs/{config_id}", json=update_data, headers=self.headers)
        assert response.status_code == 200, f"Failed to update config: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Dashboard_Updated"
        assert len(data["widgets"]) == 1
        print(f"✓ Updated dashboard config: {data['name']}")
    
    def test_delete_dashboard_config(self):
        """Test DELETE /api/dashboard-configs/{id} deletes config"""
        # First create a config
        new_config = {
            "name": "TEST_Dashboard_Delete",
            "is_default": False,
            "widgets": []
        }
        create_response = requests.post(f"{BASE_URL}/api/dashboard-configs", json=new_config, headers=self.headers)
        assert create_response.status_code == 200
        config_id = create_response.json()["id"]
        
        # Delete the config
        response = requests.delete(f"{BASE_URL}/api/dashboard-configs/{config_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete config: {response.text}"
        print(f"✓ Deleted dashboard config: {config_id}")


class TestAIAssistant:
    """AI Assistant API tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_conversations(self):
        """Test GET /api/assistant/conversations returns list"""
        response = requests.get(f"{BASE_URL}/api/assistant/conversations", headers=self.headers)
        assert response.status_code == 200, f"Failed to get conversations: {response.text}"
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/assistant/conversations returned {len(data)} conversation(s)")
    
    def test_send_chat_message(self):
        """Test POST /api/assistant/chat sends message and gets AI response"""
        message_data = {
            "message": "What is the total revenue?",
            "conversation_id": None
        }
        response = requests.post(f"{BASE_URL}/api/assistant/chat", json=message_data, headers=self.headers, timeout=60)
        assert response.status_code == 200, f"Failed to send chat: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "conversation_id" in data
        assert "message" in data
        assert "success" in data
        assert data["success"] == True
        
        # Verify message structure
        msg = data["message"]
        assert msg["role"] == "assistant"
        assert "content" in msg
        assert len(msg["content"]) > 0
        print(f"✓ Chat response received: {msg['content'][:100]}...")
        return data
    
    def test_chat_with_existing_conversation(self):
        """Test sending message to existing conversation"""
        # First create a conversation
        first_message = {
            "message": "Hello, how many outlets do we have?",
            "conversation_id": None
        }
        first_response = requests.post(f"{BASE_URL}/api/assistant/chat", json=first_message, headers=self.headers, timeout=60)
        assert first_response.status_code == 200
        conversation_id = first_response.json()["conversation_id"]
        
        # Send follow-up message
        follow_up = {
            "message": "And how many bookings?",
            "conversation_id": conversation_id
        }
        response = requests.post(f"{BASE_URL}/api/assistant/chat", json=follow_up, headers=self.headers, timeout=60)
        assert response.status_code == 200, f"Failed to send follow-up: {response.text}"
        data = response.json()
        assert data["conversation_id"] == conversation_id
        print(f"✓ Follow-up message sent to conversation {conversation_id}")
    
    def test_get_conversation_by_id(self):
        """Test GET /api/assistant/conversations/{id} returns conversation"""
        # First create a conversation
        message_data = {
            "message": "Test message for retrieval",
            "conversation_id": None
        }
        create_response = requests.post(f"{BASE_URL}/api/assistant/chat", json=message_data, headers=self.headers, timeout=60)
        assert create_response.status_code == 200
        conversation_id = create_response.json()["conversation_id"]
        
        # Get the conversation
        response = requests.get(f"{BASE_URL}/api/assistant/conversations/{conversation_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to get conversation: {response.text}"
        data = response.json()
        assert data["id"] == conversation_id
        assert "messages" in data
        assert len(data["messages"]) >= 2  # User message + assistant response
        print(f"✓ Retrieved conversation with {len(data['messages'])} messages")
    
    def test_generate_image(self):
        """Test POST /api/assistant/generate-image generates image"""
        image_request = {
            "prompt": "A simple blue circle on white background",
            "conversation_id": None
        }
        response = requests.post(f"{BASE_URL}/api/assistant/generate-image", json=image_request, headers=self.headers, timeout=120)
        assert response.status_code == 200, f"Failed to generate image: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "conversation_id" in data
        assert "message" in data
        assert "success" in data
        assert data["success"] == True
        
        # Verify message has image
        msg = data["message"]
        assert msg["role"] == "assistant"
        assert msg["message_type"] == "image"
        assert "image_url" in msg
        assert msg["image_url"] is not None
        assert msg["image_url"].startswith("data:image/")
        print(f"✓ Image generated successfully (base64 data URL)")
    
    def test_delete_conversation(self):
        """Test DELETE /api/assistant/conversations/{id} deletes conversation"""
        # First create a conversation
        message_data = {
            "message": "Test message for deletion",
            "conversation_id": None
        }
        create_response = requests.post(f"{BASE_URL}/api/assistant/chat", json=message_data, headers=self.headers, timeout=60)
        assert create_response.status_code == 200
        conversation_id = create_response.json()["conversation_id"]
        
        # Delete the conversation
        response = requests.delete(f"{BASE_URL}/api/assistant/conversations/{conversation_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete conversation: {response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/assistant/conversations/{conversation_id}", headers=self.headers)
        assert get_response.status_code == 404
        print(f"✓ Deleted conversation {conversation_id}")


class TestReportsAPI:
    """Reports API tests for dashboard data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_get_reports(self):
        """Test GET /api/reports returns dashboard stats"""
        response = requests.get(f"{BASE_URL}/api/reports", headers=self.headers)
        assert response.status_code == 200, f"Failed to get reports: {response.text}"
        data = response.json()
        
        # Verify report structure
        assert "totalOutlets" in data
        assert "totalBookings" in data
        assert "totalRevenue" in data
        assert "avgRating" in data
        
        # Verify data types
        assert isinstance(data["totalOutlets"], int)
        assert isinstance(data["totalBookings"], int)
        assert isinstance(data["totalRevenue"], int)
        assert isinstance(data["avgRating"], (int, float))
        
        print(f"✓ Reports: {data['totalOutlets']} outlets, {data['totalBookings']} bookings, ₹{data['totalRevenue']} revenue")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Get auth token before each test"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}
    
    def test_cleanup_test_dashboards(self):
        """Clean up TEST_ prefixed dashboard configs"""
        response = requests.get(f"{BASE_URL}/api/dashboard-configs", headers=self.headers)
        if response.status_code == 200:
            configs = response.json()
            for config in configs:
                if config.get("name", "").startswith("TEST_"):
                    requests.delete(f"{BASE_URL}/api/dashboard-configs/{config['id']}", headers=self.headers)
                    print(f"  Cleaned up: {config['name']}")
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
