#!/usr/bin/env python3
"""
Focused Backend API Testing for Paint Equivalents and Barcode APIs
"""

import requests
import json
import sys
from datetime import datetime

# Configuration
BASE_URL = "https://brush-vault.preview.emergentagent.com/api"
TEST_USER_EMAIL = "paintmaster@example.com"
TEST_USER_PASSWORD = "SecurePaint123!"

class FocusedTester:
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
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            return response
        except requests.exceptions.RequestException as e:
            print(f"Request error: {str(e)}")
            return None
    
    def setup_auth(self):
        """Setup authentication"""
        login_data = {
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD
        }
        
        response = self.make_request("POST", "/auth/login", login_data)
        if response and response.status_code == 200:
            data = response.json()
            self.token = data.get("access_token")
            self.user_id = data.get("user", {}).get("id")
            print(f"✅ Authenticated as: {data.get('user', {}).get('email')}")
            return True
        else:
            print(f"❌ Authentication failed: {response.text if response else 'Connection failed'}")
            return False
    
    def get_paint_ids(self):
        """Get some paint IDs for testing"""
        response = self.make_request("GET", "/paints?limit=10")
        if response and response.status_code == 200:
            data = response.json()
            if isinstance(data, list) and len(data) > 0:
                self.paint_ids = [paint["id"] for paint in data[:5]]
                print(f"✅ Retrieved {len(self.paint_ids)} paint IDs for testing")
                return True
        print("❌ Failed to get paint IDs")
        return False
    
    def test_paint_equivalents_all_brands(self):
        """Test paint equivalents from all brands"""
        if not self.paint_ids:
            self.log_test("Paint Equivalents (All Brands)", False, "No paint IDs available")
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
                             f"Missing required fields: {missing_fields}")
                return False
            
            # Validate equivalents structure
            equivalents = data.get("equivalents", [])
            if len(equivalents) > 0:
                first_equivalent = equivalents[0]
                required_equiv_fields = ["paint", "delta_e", "match_quality", "is_owned"]
                missing_equiv_fields = [field for field in required_equiv_fields if field not in first_equivalent]
                
                if missing_equiv_fields:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Missing equivalent fields: {missing_equiv_fields}")
                    return False
                
                # Check Delta-E values are reasonable
                delta_e = first_equivalent.get("delta_e")
                if not isinstance(delta_e, (int, float)) or delta_e < 0:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Invalid Delta-E value: {delta_e}")
                    return False
                
                # Check if sorted by Delta-E
                delta_e_values = [eq.get("delta_e", float('inf')) for eq in equivalents]
                if delta_e_values != sorted(delta_e_values):
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 "Equivalents not sorted by Delta-E")
                    return False
                
                # Check match quality
                valid_qualities = ["exact", "very_close", "close", "similar", "different"]
                match_quality = first_equivalent.get("match_quality")
                if match_quality not in valid_qualities:
                    self.log_test("Paint Equivalents (All Brands)", False, 
                                 f"Invalid match quality: {match_quality}")
                    return False
            
            source_name = data.get("source_paint", {}).get("name", "Unknown")
            self.log_test("Paint Equivalents (All Brands)", True, 
                         f"Found {len(equivalents)} equivalents for {source_name}")
            return True
        else:
            self.log_test("Paint Equivalents (All Brands)", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_paint_equivalents_from_collection(self):
        """Test paint equivalents from user's collection"""
        if not self.paint_ids:
            self.log_test("Paint Equivalents (From Collection)", False, "No paint IDs available")
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
                             f"Missing required fields: {missing_fields}")
                return False
            
            # Check if all returned equivalents are marked as owned
            equivalents = data.get("equivalents", [])
            for equiv in equivalents:
                if not equiv.get("is_owned", False):
                    self.log_test("Paint Equivalents (From Collection)", False, 
                                 "Found non-owned paint in collection equivalents")
                    return False
            
            message = data.get("message", "")
            if message == "No owned paints in collection":
                self.log_test("Paint Equivalents (From Collection)", True, 
                             "No owned paints in collection (expected)")
            else:
                self.log_test("Paint Equivalents (From Collection)", True, 
                             f"Found {len(equivalents)} equivalents from collection")
            return True
        else:
            self.log_test("Paint Equivalents (From Collection)", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_barcode_lookup_not_found(self):
        """Test barcode lookup for non-existent barcode"""
        test_barcode = "999888777666555"
        response = self.make_request("GET", f"/barcode/{test_barcode}")
        
        if response and response.status_code == 200:
            data = response.json()
            if data.get("found") == False:
                self.log_test("Barcode Lookup (Not Found)", True, 
                             f"Correctly returned not found for barcode {test_barcode}")
                return True
            else:
                self.log_test("Barcode Lookup (Not Found)", False, 
                             "Unexpected barcode found")
                return False
        else:
            self.log_test("Barcode Lookup (Not Found)", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_barcode_link_creation(self):
        """Test linking a barcode to a paint"""
        if not self.paint_ids:
            self.log_test("Barcode Link Creation", False, "No paint IDs available")
            return False
        
        test_barcode = "555666777888999"
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
                             f"Missing required fields: {missing_fields}")
                return False
            
            if data.get("barcode") != test_barcode:
                self.log_test("Barcode Link Creation", False, 
                             f"Barcode mismatch: expected {test_barcode}, got {data.get('barcode')}")
                return False
            
            paint_name = data.get('paint', {}).get('name', 'Unknown')
            self.log_test("Barcode Link Creation", True, 
                         f"Successfully linked barcode {test_barcode} to paint {paint_name}")
            return True
        elif response and response.status_code == 400:
            # Barcode might already be linked
            self.log_test("Barcode Link Creation", True, "Barcode already linked (expected for repeated tests)")
            return True
        else:
            self.log_test("Barcode Link Creation", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_barcode_lookup_found(self):
        """Test barcode lookup for existing barcode"""
        test_barcode = "123456789012"  # This should exist from previous tests
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
                                 "Invalid paint data in barcode lookup")
                    return False
            else:
                self.log_test("Barcode Lookup (Found)", False, 
                             "Barcode not found (might not exist yet)")
                return False
        else:
            self.log_test("Barcode Lookup (Found)", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_get_all_barcode_links(self):
        """Test getting all barcode links"""
        response = self.make_request("GET", "/barcode/all-links")
        
        if response and response.status_code == 200:
            data = response.json()
            
            if "links" not in data or "count" not in data:
                self.log_test("Get All Barcode Links", False, 
                             "Missing required fields in response")
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
                                 f"Missing fields in link: {missing_fields}")
                    return False
            
            self.log_test("Get All Barcode Links", True, 
                         f"Retrieved {count} barcode links successfully")
            return True
        else:
            self.log_test("Get All Barcode Links", False, 
                         f"API call failed: {response.status_code if response else 'Connection failed'}")
            return False
    
    def test_duplicate_barcode_prevention(self):
        """Test that duplicate barcode links are prevented"""
        if not self.paint_ids or len(self.paint_ids) < 2:
            self.log_test("Duplicate Barcode Prevention", False, "Not enough paint IDs")
            return False
        
        test_barcode = "123456789012"  # Existing barcode
        link_data = {
            "barcode": test_barcode,
            "paint_id": self.paint_ids[1],  # Different paint
            "notes": "Duplicate test"
        }
        
        response = self.make_request("POST", "/barcode/link", link_data)
        
        if response and response.status_code == 400:
            self.log_test("Duplicate Barcode Prevention", True, 
                         "Correctly prevented duplicate barcode link")
            return True
        else:
            self.log_test("Duplicate Barcode Prevention", False, 
                         f"Failed to prevent duplicate: {response.status_code if response else 'Connection failed'}")
            return False
    
    def run_focused_tests(self):
        """Run focused tests on new APIs"""
        print("🧪 Starting Focused Paint Equivalents & Barcode API Tests")
        print("=" * 70)
        
        # Setup
        if not self.setup_auth():
            return False
        
        if not self.get_paint_ids():
            return False
        
        # Paint Equivalents API Tests
        print("\n🎨 Testing Paint Equivalents APIs...")
        self.test_paint_equivalents_all_brands()
        self.test_paint_equivalents_from_collection()
        
        # Barcode API Tests
        print("\n📱 Testing Barcode APIs...")
        self.test_barcode_lookup_not_found()
        self.test_barcode_link_creation()
        self.test_barcode_lookup_found()
        self.test_get_all_barcode_links()
        self.test_duplicate_barcode_prevention()
        
        # Summary
        print("\n" + "=" * 70)
        print("📊 TEST SUMMARY")
        print("=" * 70)
        
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
    tester = FocusedTester()
    success = tester.run_focused_tests()
    
    # Save detailed results to file
    with open("/app/focused_test_results.json", "w") as f:
        json.dump(tester.test_results, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: /app/focused_test_results.json")
    
    if success:
        print("\n🎉 All focused tests passed!")
        sys.exit(0)
    else:
        print("\n💥 Some tests failed!")
        sys.exit(1)

if __name__ == "__main__":
    main()