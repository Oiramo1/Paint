#!/usr/bin/env python3
"""
Backend API Testing for Brush Vault Paint Tracking App
Tests the new Paint Equivalents (Delta-E) and Barcode APIs
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://brush-vault.preview.emergentagent.com/api"
TEST_USER_EMAIL = "paintmaster@example.com"
TEST_USER_PASSWORD = "SecurePaint123!"
TEST_USER_NAME = "Paint Master"

class BrushVaultTester:
    def __init__(self):
        self.base_url = BASE_URL
        self.token = None
        self.user_id = None
        self.test_results = []
        self.paint_ids = []
        
    def log_test(self, test_name, success, message, details=None):
        """Log test results"""
        result = {
            "test": test_name,
            "success": success,
            "message": message,
            "details": details,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status}: {test_name} - {message}")
        if details and not success:
            print(f"   Details: {details}")
    
    def make_request(self, method, endpoint, data=None, headers=None):
        """Make HTTP request with error handling"""
        url = f"{self.base_url}{endpoint}"
        default_headers = {"Content-Type": "application/json"}
        
        if self.token:
            default_headers["Authorization"] = f"Bearer {self.token}"
        
        if headers:
            default_headers.update(headers)
        
        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=default_headers, timeout=30)
            elif method.upper() == "POST":
                response = requests.post(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "PATCH":
                response = requests.patch(url, json=data, headers=default_headers, timeout=30)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=default_headers, timeout=30)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            return None, str(e)
    
    def test_health_check(self):
        """Test basic API health"""
        response = self.make_request("GET", "/health")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Health Check", True, f"API is healthy: {data.get('status')}")
            return True
        else:
            self.log_test("Health Check", False, "API health check failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_user_registration(self):
        """Test user registration"""
        user_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "display_name": TEST_USER_NAME
        }
        
        response = self.make_request("POST", "/auth/register", user_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.log_test("User Registration", True, f"User registered successfully: {data.get('user', {}).get('email')}")
            return True
        elif response and response.status_code == 400:
            # User might already exist, try login
            return self.test_user_login()
        else:
            self.log_test("User Registration", False, "Registration failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_user_login(self):
        """Test user login"""
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            self.log_test("User Login", True, f"User logged in successfully: {data.get('user', {}).get('email')}")
            return True
        else:
            self.log_test("User Login", False, "Login failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_seed_paints(self):
        """Test paint database seeding"""
        response = self.make_request("POST", "/seed-paints")
        if response and response.status_code == 200:
            data = response.json()
            self.log_test("Paint Database Seeding", True, data.get("message", "Seeded successfully"))
            return True
        else:
            self.log_test("Paint Database Seeding", False, "Seeding failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_get_paints(self):
        """Test getting paint list and store some paint IDs for testing"""
        response = self.make_request("GET", "/paints?limit=20")
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                self.paint_ids = [paint["id"] for paint in data[:10]]  # Store first 10 paint IDs
                self.log_test("Get Paints List", True, f"Retrieved {len(data)} paints successfully")
                return True
            else:
                self.log_test("Get Paints List", False, "No paints found in database")
                return False
        else:
            self.log_test("Get Paints List", False, "Failed to retrieve paints", 
                         response.text if response else "Connection failed")
            return False
    
    def test_paint_equivalents_all_brands(self):
        """Test paint equivalents from all brands"""
        if not self.paint_ids:
            self.log_test("Paint Equivalents (All Brands)", False, "No paint IDs available for testing")
            return False
        
        test_paint_id = self.paint_ids[0]
        response = self.make_request("GET", f"/paints/{test_paint_id}/equivalents?limit=5")
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Validate response structure
            required_fields = ["source_paint", "equivalents", "total_found"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Paint Equivalents (All Brands)", False, 
                             f"Missing required fields: {missing_fields}", data)
                return False
            
            # Validate source paint
            source_paint = data.get("source_paint", {})
            if not source_paint.get("id") or not source_paint.get("hex_color"):
                self.log_test("Paint Equivalents (All Brands)", False, 
                             "Invalid source paint data", source_paint)
                return False
            
            # Validate equivalents
            equivalents = data.get("equivalents", [])
            if len(equivalents) > 0:
                first_equivalent = equivalents[0]
                required_equiv_fields = ["paint", "delta_e", "match_quality", "is_owned"]
                missing_equiv_fields = [field for field in required_equiv_fields if field not in first_equivalent]
                
                if missing_equiv_fields:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Missing equivalent fields: {missing_equiv_fields}", first_equivalent)
                    return False
                
                # Check if Delta-E values are reasonable (should be positive numbers)
                delta_e = first_equivalent.get("delta_e")
                if not isinstance(delta_e, (int, float)) or delta_e < 0:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Invalid Delta-E value: {delta_e}")
                    return False
                
                # Check if equivalents are sorted by Delta-E (ascending)
                delta_e_values = [eq.get("delta_e", float('inf')) for eq in equivalents]
                if delta_e_values != sorted(delta_e_values):
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 "Equivalents not sorted by Delta-E", delta_e_values)
                    return False
                
                # Check match quality values
                valid_qualities = ["exact", "very_close", "close", "similar", "different"]
                match_quality = first_equivalent.get("match_quality")
                if match_quality not in valid_qualities:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Invalid match quality: {match_quality}")
                    return False
            
            self.log_test("Paint Equivalents (All Brands)", True, 
                         f"Found {len(equivalents)} equivalents for paint {source_paint.get('name', 'Unknown')}")
            return True
        else:
            self.log_test("Paint Equivalents (All Brands)", False, "Failed to get equivalents", 
                         response.text if response else "Connection failed")
            return False
    
    def test_add_paint_to_collection(self):
        """Add a paint to user's collection for testing equivalents-from-collection"""
        if not self.paint_ids:
            return False
        
        paint_data = {
            "paint_id": self.paint_ids[1] if len(self.paint_ids) > 1 else self.paint_ids[0],
            "status": "owned",
            "quantity": 1
        }
        
        response = self.make_request("POST", "/collection", paint_data)
        if response and response.status_code == 200:
            self.log_test("Add Paint to Collection", True, "Paint added to collection successfully")
            return True
        elif response and response.status_code == 400:
            # Paint might already be in collection
            self.log_test("Add Paint to Collection", True, "Paint already in collection")
            return True
        else:
            self.log_test("Add Paint to Collection", False, "Failed to add paint to collection", 
                         response.text if response else "Connection failed")
            return False
    
    def test_paint_equivalents_from_collection(self):
        """Test paint equivalents from user's collection only"""
        if not self.paint_ids:
            self.log_test("Paint Equivalents (From Collection)", False, "No paint IDs available for testing")
            return False
        
        test_paint_id = self.paint_ids[0]
        response = self.make_request("GET", f"/paints/{test_paint_id}/equivalents-from-collection?limit=5")
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Validate response structure
            required_fields = ["source_paint", "equivalents"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Paint Equivalents (From Collection)", False, 
                             f"Missing required fields: {missing_fields}", data)
                return False
            
            # Check if all returned equivalents are marked as owned
            equivalents = data.get("equivalents", [])
            for equiv in equivalents:
                if not equiv.get("is_owned", False):
                    self.log_test("Paint Equivalents (From Collection)", False, 
                                 "Found non-owned paint in collection equivalents", equiv)
                    return False
            
            message = data.get("message", "")
            if message == "No owned paints in collection":
                self.log_test("Paint Equivalents (From Collection)", True, 
                             "No owned paints in collection (expected for new user)")
            else:
                self.log_test("Paint Equivalents (From Collection)", True, 
                             f"Found {len(equivalents)} equivalents from collection")
            return True
        else:
            self.log_test("Paint Equivalents (From Collection)", False, "Failed to get collection equivalents", 
                         response.text if response else "Connection failed")
            return False
    
    def test_barcode_lookup_not_found(self):
        """Test barcode lookup for non-existent barcode"""
        test_barcode = "123456789012"
        response = self.make_request("GET", f"/barcode/{test_barcode}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("found") == False:
                self.log_test("Barcode Lookup (Not Found)", True, 
                             f"Correctly returned not found for barcode {test_barcode}")
                return True
            else:
                self.log_test("Barcode Lookup (Not Found)", False, 
                             "Unexpected barcode found", data)
                return False
        else:
            self.log_test("Barcode Lookup (Not Found)", False, "Barcode lookup failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_barcode_link_creation(self):
        """Test linking a barcode to a paint"""
        if not self.paint_ids:
            self.log_test("Barcode Link Creation", False, "No paint IDs available for testing")
            return False
        
        test_barcode = "123456789012"
        link_data = {
            "barcode": test_barcode,
            "paint_id": self.paint_ids[0],
            "notes": "Test barcode link"
        }
        
        response = self.make_request("POST", "/barcode/link", link_data)
        
        if response and response.status_code == 200:
            data = response.json()
            
            # Validate response structure
            required_fields = ["id", "barcode", "paint_id", "paint", "linked_by", "created_at"]
            missing_fields = [field for field in required_fields if field not in data]
            
            if missing_fields:
                self.log_test("Barcode Link Creation", False, 
                             f"Missing required fields: {missing_fields}", data)
                return False
            
            if data.get("barcode") != test_barcode:
                self.log_test("Barcode Link Creation", False, 
                             f"Barcode mismatch: expected {test_barcode}, got {data.get('barcode')}")
                return False
            
            if data.get("paint_id") != self.paint_ids[0]:
                self.log_test("Barcode Link Creation", False, 
                             f"Paint ID mismatch: expected {self.paint_ids[0]}, got {data.get('paint_id')}")
                return False
            
            self.log_test("Barcode Link Creation", True, 
                         f"Successfully linked barcode {test_barcode} to paint {data.get('paint', {}).get('name', 'Unknown')}")
            return True
        elif response and response.status_code == 400:
            # Barcode might already be linked
            self.log_test("Barcode Link Creation", True, "Barcode already linked (expected for repeated tests)")
            return True
        else:
            self.log_test("Barcode Link Creation", False, "Failed to create barcode link", 
                         response.text if response else "Connection failed")
            return False
    
    def test_barcode_lookup_found(self):
        """Test barcode lookup for existing barcode"""
        test_barcode = "123456789012"
        response = self.make_request("GET", f"/barcode/{test_barcode}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("found") == True:
                paint = data.get("paint", {})
                if paint.get("id") and paint.get("name"):
                    self.log_test("Barcode Lookup (Found)", True, 
                                 f"Successfully found paint {paint.get('name')} for barcode {test_barcode}")
                    return True
                else:
                    self.log_test("Barcode Lookup (Found)", False, 
                                 "Invalid paint data in barcode lookup", paint)
                    return False
            else:
                self.log_test("Barcode Lookup (Found)", False, 
                             "Barcode not found after linking", data)
                return False
        else:
            self.log_test("Barcode Lookup (Found)", False, "Barcode lookup failed", 
                         response.text if response else "Connection failed")
            return False
    
    def test_duplicate_barcode_link(self):
        """Test that duplicate barcode links are prevented"""
        if not self.paint_ids or len(self.paint_ids) < 2:
            self.log_test("Duplicate Barcode Link Prevention", False, "Not enough paint IDs for testing")
            return False
        
        test_barcode = "123456789012"  # Same barcode as before
        link_data = {
            "barcode": test_barcode,
            "paint_id": self.paint_ids[1],  # Different paint
            "notes": "Duplicate test"
        }
        
        response = self.make_request("POST", "/barcode/link", link_data)
        
        if response and response.status_code == 400:
            self.log_test("Duplicate Barcode Link Prevention", True, 
                         "Correctly prevented duplicate barcode link")
            return True
        else:
            self.log_test("Duplicate Barcode Link Prevention", False, 
                         "Failed to prevent duplicate barcode link", 
                         response.text if response else "Connection failed")
            return False
    
    def test_get_all_barcode_links(self):
        """Test getting all barcode links"""
        response = self.make_request("GET", "/barcode/all-links")
        
        if response and response.status_code == 200:
            data = response.json()
            
            if "links" not in data or "count" not in data:
                self.log_test("Get All Barcode Links", False, 
                             "Missing required fields in response", data)
                return False
            
            links = data.get("links", [])
            count = data.get("count", 0)
            
            if len(links) != count:
                self.log_test("Get All Barcode Links", False, 
                             f"Count mismatch: links={len(links)}, count={count}")
                return False
            
            # Validate link structure if any links exist
            if len(links) > 0:
                first_link = links[0]
                required_fields = ["id", "barcode", "paint", "created_at"]
                missing_fields = [field for field in required_fields if field not in first_link]
                
                if missing_fields:
                    self.log_test("Get All Barcode Links", False, 
                                 f"Missing fields in link: {missing_fields}", first_link)
                    return False
            
            self.log_test("Get All Barcode Links", True, 
                         f"Retrieved {count} barcode links successfully")
            return True
        else:
            self.log_test("Get All Barcode Links", False, "Failed to get barcode links", 
                         response.text if response else "Connection failed")
            return False
    
    def test_invalid_paint_id_equivalents(self):
        """Test equivalents API with invalid paint ID"""
        invalid_paint_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
        response = self.make_request("GET", f"/paints/{invalid_paint_id}/equivalents")
        
        if response and response.status_code == 404:
            self.log_test("Invalid Paint ID (Equivalents)", True, 
                         "Correctly returned 404 for invalid paint ID")
            return True
        else:
            self.log_test("Invalid Paint ID (Equivalents)", False, 
                         f"Expected 404, got {response.status_code if response else 'no response'}", 
                         response.text if response else "Connection failed")
            return False
    
    def test_invalid_paint_id_barcode_link(self):
        """Test barcode link with invalid paint ID"""
        invalid_paint_id = "507f1f77bcf86cd799439011"  # Valid ObjectId format but non-existent
        link_data = {
            "barcode": "999888777666",
            "paint_id": invalid_paint_id
        }
        
        response = self.make_request("POST", "/barcode/link", link_data)
        
        if response and response.status_code == 404:
            self.log_test("Invalid Paint ID (Barcode Link)", True, 
                         "Correctly returned 404 for invalid paint ID")
            return True
        else:
            self.log_test("Invalid Paint ID (Barcode Link)", False, 
                         f"Expected 404, got {response.status_code if response else 'no response'}", 
                         response.text if response else "Connection failed")
            return False
    
    def run_all_tests(self):
        """Run all tests in sequence"""
        print("🧪 Starting Brush Vault Backend API Tests")
        print("=" * 60)
        
        # Basic setup tests
        if not self.test_health_check():
            print("❌ Health check failed - aborting tests")
            return False
        
        if not self.test_user_registration():
            print("❌ User authentication failed - aborting tests")
            return False
        
        if not self.test_seed_paints():
            print("❌ Paint seeding failed - aborting tests")
            return False
        
        if not self.test_get_paints():
            print("❌ Paint retrieval failed - aborting tests")
            return False
        
        # Paint Equivalents API Tests
        print("\n🎨 Testing Paint Equivalents APIs...")
        self.test_paint_equivalents_all_brands()
        self.test_add_paint_to_collection()
        self.test_paint_equivalents_from_collection()
        self.test_invalid_paint_id_equivalents()
        
        # Barcode API Tests
        print("\n📱 Testing Barcode APIs...")
        self.test_barcode_lookup_not_found()
        self.test_barcode_link_creation()
        self.test_barcode_lookup_found()
        self.test_duplicate_barcode_link()
        self.test_get_all_barcode_links()
        self.test_invalid_paint_id_barcode_link()
        
        # Summary
        print("\n" + "=" * 60)
        print("📊 TEST SUMMARY")
        print("=" * 60)
        
        passed = sum(1 for result in self.test_results if result["success"])
        total = len(self.test_results)
        
        print(f"Total Tests: {total}")
        print(f"Passed: {passed}")
        print(f"Failed: {total - passed}")
        print(f"Success Rate: {(passed/total)*100:.1f}%")
        
        if total - passed > 0:
            print("\n❌ FAILED TESTS:")
            for result in self.test_results:
                if not result["success"]:
                    print(f"  - {result['test']}: {result['message']}")
        
        return passed == total

def main():
    """Main test execution"""
    tester = BrushVaultTester()
    success = tester.run_all_tests()
    
    # Save detailed results to file
    with open("/app/test_results_detailed.json", "w") as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/test_results_detailed.json")
    
    if success:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()