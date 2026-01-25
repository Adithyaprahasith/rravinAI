#!/usr/bin/env python3
"""
Backend API Testing for rravin - AI Data Analysis Agent
Tests all API endpoints including sessions, file upload, analysis, and chat functionality.
"""

import requests
import sys
import json
import io
import csv
from datetime import datetime
from pathlib import Path

class RravinAPITester:
    def __init__(self, base_url="https://datawhiz-2.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.session_id = None
        self.analysis_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            print(f"❌ {name} - {details}")
        
        self.test_results.append({
            "test": name,
            "success": success,
            "details": details,
            "response_data": response_data
        })

    def test_api_root(self):
        """Test API root endpoint"""
        try:
            response = requests.get(f"{self.api_url}/", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            self.log_test(
                "API Root Endpoint", 
                success, 
                f"Status: {response.status_code}" if not success else "",
                data
            )
            return success
        except Exception as e:
            self.log_test("API Root Endpoint", False, f"Error: {str(e)}")
            return False

    def test_create_session(self):
        """Test session creation"""
        try:
            response = requests.post(
                f"{self.api_url}/sessions",
                json={},
                timeout=10
            )
            success = response.status_code == 200
            if success:
                data = response.json()
                self.session_id = data.get("session_id")
                expected_fields = ["session_id", "files_uploaded", "max_files", "created_at"]
                has_fields = all(field in data for field in expected_fields)
                success = success and has_fields and self.session_id
                
            self.log_test(
                "Create Session", 
                success, 
                f"Status: {response.status_code}" if not success else f"Session ID: {self.session_id}",
                response.json() if success else {}
            )
            return success
        except Exception as e:
            self.log_test("Create Session", False, f"Error: {str(e)}")
            return False

    def test_get_session(self):
        """Test getting session details"""
        if not self.session_id:
            self.log_test("Get Session", False, "No session ID available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/sessions/{self.session_id}", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            self.log_test(
                "Get Session", 
                success, 
                f"Status: {response.status_code}" if not success else "",
                data
            )
            return success
        except Exception as e:
            self.log_test("Get Session", False, f"Error: {str(e)}")
            return False

    def create_test_csv(self):
        """Create a test CSV file for upload"""
        csv_content = """Date,Revenue,Customers,Region
2024-01-01,10000,150,North
2024-01-02,12000,180,North
2024-01-03,8000,120,South
2024-01-04,15000,200,North
2024-01-05,9000,130,South
2024-01-06,11000,160,East
2024-01-07,13000,190,East
2024-01-08,7000,100,South
2024-01-09,14000,210,North
2024-01-10,10500,155,East"""
        
        # Create CSV file in memory
        csv_file = io.StringIO(csv_content)
        return ('test_data.csv', csv_content, 'text/csv')

    def test_file_upload(self):
        """Test file upload functionality"""
        if not self.session_id:
            self.log_test("File Upload", False, "No session ID available")
            return False
            
        try:
            # Create test CSV
            filename, content, content_type = self.create_test_csv()
            
            # Prepare multipart form data
            files = {
                'files': (filename, content, content_type)
            }
            data = {
                'session_id': self.session_id
            }
            
            response = requests.post(
                f"{self.api_url}/upload",
                files=files,
                data=data,
                timeout=30
            )
            
            success = response.status_code == 200
            response_data = response.json() if success else {}
            
            if success:
                # Check response structure
                expected_fields = ["message", "files", "total_files", "remaining_uploads"]
                has_fields = all(field in response_data for field in expected_fields)
                success = success and has_fields
                
            self.log_test(
                "File Upload", 
                success, 
                f"Status: {response.status_code}" if not success else f"Uploaded {len(response_data.get('files', []))} file(s)",
                response_data
            )
            return success
        except Exception as e:
            self.log_test("File Upload", False, f"Error: {str(e)}")
            return False

    def test_data_analysis(self):
        """Test data analysis functionality"""
        if not self.session_id:
            self.log_test("Data Analysis", False, "No session ID available")
            return False
            
        try:
            response = requests.post(
                f"{self.api_url}/analyze",
                json={
                    "session_id": self.session_id,
                    "instructions": "Analyze this sales data and provide insights on revenue trends and customer patterns."
                },
                timeout=60  # Analysis might take longer
            )
            
            success = response.status_code == 200
            response_data = response.json() if success else {}
            
            if success:
                # Check response structure
                expected_fields = ["analysis_id", "session_id", "summary", "key_metrics", "visualizations", "problems", "recommendations", "executive_report"]
                has_fields = all(field in response_data for field in expected_fields)
                self.analysis_id = response_data.get("analysis_id")
                success = success and has_fields and self.analysis_id
                
            self.log_test(
                "Data Analysis", 
                success, 
                f"Status: {response.status_code}" if not success else f"Analysis ID: {self.analysis_id}",
                {k: v for k, v in response_data.items() if k != "executive_report"} if success else {}  # Exclude long report from log
            )
            return success
        except Exception as e:
            self.log_test("Data Analysis", False, f"Error: {str(e)}")
            return False

    def test_get_analysis(self):
        """Test getting analysis results"""
        if not self.analysis_id:
            self.log_test("Get Analysis", False, "No analysis ID available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/analyses/{self.analysis_id}", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            self.log_test(
                "Get Analysis", 
                success, 
                f"Status: {response.status_code}" if not success else "",
                {k: v for k, v in data.items() if k != "executive_report"} if success else {}
            )
            return success
        except Exception as e:
            self.log_test("Get Analysis", False, f"Error: {str(e)}")
            return False

    def test_chat_functionality(self):
        """Test chat functionality"""
        if not self.session_id:
            self.log_test("Chat Functionality", False, "No session ID available")
            return False
            
        try:
            response = requests.post(
                f"{self.api_url}/chat",
                json={
                    "session_id": self.session_id,
                    "message": "What are the main trends in this data?"
                },
                timeout=30
            )
            
            success = response.status_code == 200
            response_data = response.json() if success else {}
            
            if success:
                # Check response structure
                expected_fields = ["response", "timestamp"]
                has_fields = all(field in response_data for field in expected_fields)
                success = success and has_fields
                
            self.log_test(
                "Chat Functionality", 
                success, 
                f"Status: {response.status_code}" if not success else "Chat response received",
                response_data
            )
            return success
        except Exception as e:
            self.log_test("Chat Functionality", False, f"Error: {str(e)}")
            return False

    def test_chat_history(self):
        """Test chat history retrieval"""
        if not self.session_id:
            self.log_test("Chat History", False, "No session ID available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/chat/{self.session_id}/history", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            if success:
                # Check if history field exists
                success = "history" in data
                
            self.log_test(
                "Chat History", 
                success, 
                f"Status: {response.status_code}" if not success else f"History entries: {len(data.get('history', []))}",
                data
            )
            return success
        except Exception as e:
            self.log_test("Chat History", False, f"Error: {str(e)}")
            return False

    def test_pdf_download(self):
        """Test PDF report generation and download"""
        if not self.analysis_id:
            self.log_test("PDF Download", False, "No analysis ID available")
            return False
            
        try:
            response = requests.get(f"{self.api_url}/analyses/{self.analysis_id}/pdf", timeout=30)
            success = response.status_code == 200
            
            if success:
                # Check if response is actually a PDF
                content_type = response.headers.get('content-type', '')
                is_pdf = 'application/pdf' in content_type
                has_content = len(response.content) > 1000  # PDF should be substantial
                success = is_pdf and has_content
                
            self.log_test(
                "PDF Download", 
                success, 
                f"Status: {response.status_code}, Content-Type: {response.headers.get('content-type', 'N/A')}, Size: {len(response.content)} bytes" if not success else f"PDF generated successfully ({len(response.content)} bytes)",
                {"content_type": response.headers.get('content-type'), "size_bytes": len(response.content)}
            )
            return success
        except Exception as e:
            self.log_test("PDF Download", False, f"Error: {str(e)}")
            return False

    def test_unlimited_file_upload(self):
        """Test unlimited file upload (no 3-file limit)"""
        if not self.session_id:
            self.log_test("Unlimited File Upload", False, "No session ID available")
            return False
            
        try:
            # Create multiple test CSV files (more than 3 to test no limit)
            files_data = []
            for i in range(5):  # Test with 5 files
                csv_content = f"""Date,Revenue,Customers,Region
2024-0{i+1}-01,{10000+i*1000},{150+i*10},North
2024-0{i+1}-02,{12000+i*1000},{180+i*10},South
2024-0{i+1}-03,{8000+i*1000},{120+i*10},East"""
                files_data.append(('files', (f'test_data_{i+1}.csv', csv_content, 'text/csv')))
            
            data = {'session_id': self.session_id}
            
            response = requests.post(
                f"{self.api_url}/upload",
                files=files_data,
                data=data,
                timeout=30
            )
            
            success = response.status_code == 200
            response_data = response.json() if success else {}
            
            if success:
                # Check if all 5 files were uploaded (no limit)
                uploaded_count = len(response_data.get('files', []))
                success = uploaded_count == 5
                
            self.log_test(
                "Unlimited File Upload", 
                success, 
                f"Status: {response.status_code}" if not success else f"Successfully uploaded {response_data.get('total_files', 0)} files (no limit enforced)",
                response_data
            )
            return success
        except Exception as e:
            self.log_test("Unlimited File Upload", False, f"Error: {str(e)}")
            return False

    def test_session_deletion(self):
        """Test session deletion (cleanup)"""
        if not self.session_id:
            self.log_test("Session Deletion", False, "No session ID available")
            return False
            
        try:
            response = requests.delete(f"{self.api_url}/sessions/{self.session_id}", timeout=10)
            success = response.status_code == 200
            data = response.json() if success else {}
            
            self.log_test(
                "Session Deletion", 
                success, 
                f"Status: {response.status_code}" if not success else "Session deleted successfully",
                data
            )
            return success
        except Exception as e:
            self.log_test("Session Deletion", False, f"Error: {str(e)}")
            return False

    def run_all_tests(self):
        """Run all API tests"""
        print(f"🔍 Testing rravin API at {self.api_url}")
        print("=" * 60)
        
        # Test sequence
        tests = [
            self.test_api_root,
            self.test_create_session,
            self.test_get_session,
            self.test_file_upload,
            self.test_data_analysis,
            self.test_get_analysis,
            self.test_chat_functionality,
            self.test_chat_history,
            # self.test_session_deletion  # Skip cleanup for now to allow frontend testing
        ]
        
        for test in tests:
            try:
                test()
            except Exception as e:
                print(f"❌ {test.__name__} - Unexpected error: {str(e)}")
                self.tests_run += 1
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        if self.tests_passed == self.tests_run:
            print("🎉 All tests passed!")
        else:
            print("⚠️  Some tests failed. Check the details above.")
            
        return self.tests_passed, self.tests_run, self.test_results

def main():
    """Main test execution"""
    tester = RravinAPITester()
    passed, total, results = tester.run_all_tests()
    
    # Save detailed results
    results_file = "/app/backend_test_results.json"
    with open(results_file, 'w') as f:
        json.dump({
            "timestamp": datetime.now().isoformat(),
            "summary": {
                "passed": passed,
                "total": total,
                "success_rate": f"{(passed/total)*100:.1f}%" if total > 0 else "0%"
            },
            "session_id": tester.session_id,
            "analysis_id": tester.analysis_id,
            "test_results": results
        }, f, indent=2)
    
    print(f"\n📄 Detailed results saved to: {results_file}")
    
    # Return appropriate exit code
    return 0 if passed == total else 1

if __name__ == "__main__":
    sys.exit(main())