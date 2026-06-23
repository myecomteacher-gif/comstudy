import os
import json
import uuid
import sys
import mimetypes
from urllib.parse import urlparse, parse_qs
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

# Constants
PORT = 8000
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DATA_FILE = os.path.join(DATA_DIR, "reservations.json")
PUBLIC_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "public")

# Admin credentials
ADMIN_USER = "admin"
ADMIN_PASSWORD = "1111"
# Generate a session token for the admin upon login
CURRENT_ADMIN_TOKEN = str(uuid.uuid4())

# Initialize data
def init_db():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)
    if not os.path.exists(DATA_FILE):
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump({"reservations": [], "blocked_dates": []}, f, ensure_ascii=False, indent=2)

def load_data():
    init_db()
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading database: {e}")
        return {"reservations": [], "blocked_dates": []}

def save_data(data):
    init_db()
    try:
        with open(DATA_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Error saving database: {e}")
        return False

# Sanitization helper to remove passwords from output
def sanitize_data(data):
    sanitized_reservations = []
    for res in data.get("reservations", []):
        res_copy = res.copy()
        if "password" in res_copy:
            del res_copy["password"]  # Remove password for client side
        sanitized_reservations.append(res_copy)
    return {
        "reservations": sanitized_reservations,
        "blocked_dates": data.get("blocked_dates", [])
    }

class ReservationRequestHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Allow CORS
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def check_admin_auth(self):
        auth_header = self.headers.get('Authorization')
        if not auth_header:
            return False
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
            return token == CURRENT_ADMIN_TOKEN
        return False

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # API: Get reservations and blocked dates
        if path == "/api/reservations":
            data = load_data()
            sanitized = sanitize_data(data)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps(sanitized, ensure_ascii=False).encode('utf-8'))
            return

        # API: Check admin authentication status
        elif path == "/api/admin/status":
            is_authenticated = self.check_admin_auth()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"authenticated": is_authenticated}).encode('utf-8'))
            return

        # Serve static files
        else:
            # Map root to index.html
            if path == "/" or path == "":
                filepath = os.path.join(PUBLIC_DIR, "index.html")
            else:
                # Strip leading slash
                rel_path = path.lstrip("/")
                filepath = os.path.join(PUBLIC_DIR, rel_path)

            # Prevent directory traversal attacks
            filepath = os.path.abspath(filepath)
            if not filepath.startswith(os.path.abspath(PUBLIC_DIR)):
                self.send_response(403)
                self.end_headers()
                self.wfile.write(b"Forbidden")
                return

            if os.path.exists(filepath) and os.path.isfile(filepath):
                # Guess content type
                content_type, _ = mimetypes.guess_type(filepath)
                if not content_type:
                    content_type = "application/octet-stream"
                
                self.send_response(200)
                self.send_header('Content-Type', content_type)
                # Read file
                try:
                    with open(filepath, 'rb') as f:
                        content = f.read()
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                except Exception as e:
                    self.send_response(500)
                    self.end_headers()
                    self.wfile.write(f"Server error: {e}".encode('utf-8'))
            else:
                # Fallback to index.html if not found (for SPA routing, though not strictly needed here)
                fallback_index = os.path.join(PUBLIC_DIR, "index.html")
                if os.path.exists(fallback_index) and path != "/favicon.ico":
                    self.send_response(200)
                    self.send_header('Content-Type', 'text/html; charset=utf-8')
                    with open(fallback_index, 'rb') as f:
                        content = f.read()
                    self.send_header('Content-Length', str(len(content)))
                    self.end_headers()
                    self.wfile.write(content)
                else:
                    self.send_response(404)
                    self.end_headers()
                    self.wfile.write(b"Not Found")

    def do_POST(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            req_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
            return

        # API: Create Reservation
        if path == "/api/reservations":
            date = req_data.get("date")
            name = req_data.get("name")
            purpose = req_data.get("purpose")
            password = req_data.get("password")
            time_slots = req_data.get("time_slots", [])  # List of slots, e.g., ["1", "2"]

            if not all([date, name, purpose, password, time_slots]):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "모든 필드를 입력해야 합니다."}).encode('utf-8'))
                return

            data = load_data()

            # Check if date is blocked
            if date in data.get("blocked_dates", []):
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "해당 날짜는 예약이 불가능합니다(관리자 제한)."}).encode('utf-8'))
                return

            # Check for double booking (overlap in time slots on the same date)
            for res in data.get("reservations", []):
                if res["date"] == date:
                    # Check intersection of slots
                    overlap = set(res["time_slots"]).intersection(set(time_slots))
                    if overlap:
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": f"선택한 시간대({', '.join(overlap)})는 이미 예약되어 있습니다."}).encode('utf-8'))
                        return

            # Create new reservation
            new_res = {
                "id": str(uuid.uuid4()),
                "date": date,
                "name": name,
                "purpose": purpose,
                "password": password,
                "time_slots": time_slots
            }
            data["reservations"].append(new_res)
            save_data(data)

            self.send_response(201)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            # Send back sanitized new reservation
            res_sanitized = new_res.copy()
            del res_sanitized["password"]
            self.wfile.write(json.dumps(res_sanitized, ensure_ascii=False).encode('utf-8'))
            return

        # API: Admin Login
        elif path == "/api/admin/login":
            username = req_data.get("username")
            password = req_data.get("password")

            if username == ADMIN_USER and password == ADMIN_PASSWORD:
                self.send_response(200)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"token": CURRENT_ADMIN_TOKEN, "message": "Login successful"}).encode('utf-8'))
            else:
                self.send_response(401)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "아이디 또는 비밀번호가 일치하지 않습니다."}).encode('utf-8'))
            return

        # API: Admin Block Date
        elif path == "/api/admin/block":
            if not self.check_admin_auth():
                self.send_response(403)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "권한이 없습니다."}).encode('utf-8'))
                return

            date = req_data.get("date")
            if not date:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "날짜를 지정해야 합니다."}).encode('utf-8'))
                return

            data = load_data()
            if date not in data["blocked_dates"]:
                data["blocked_dates"].append(date)
                # Optionally cancel all reservations on that date
                # We will keep them but user can't book new ones, or we can leave them. Let's just keep them.
                save_data(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "blocked_dates": data["blocked_dates"]}).encode('utf-8'))
            return

        else:
            self.send_response(404)
            self.end_headers()

    def do_PUT(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            req_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Invalid JSON"}).encode('utf-8'))
            return

        # API: Update Reservation
        # Expected path: /api/reservations/<id>
        if path.startswith("/api/reservations/"):
            res_id = path.split("/")[-1]
            data = load_data()

            # Find reservation
            target_res = None
            target_index = -1
            for idx, res in enumerate(data.get("reservations", [])):
                if res["id"] == res_id:
                    target_res = res
                    target_index = idx
                    break

            if not target_res:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "예약을 찾을 수 없습니다."}).encode('utf-8'))
                return

            # Auth check: Admin or matching password
            is_admin = self.check_admin_auth()
            provided_password = req_data.get("password")

            if not is_admin and target_res["password"] != provided_password:
                self.send_response(403)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "비밀번호가 일치하지 않습니다."}).encode('utf-8'))
                return

            # Validate fields
            name = req_data.get("name", target_res["name"])
            purpose = req_data.get("purpose", target_res["purpose"])
            time_slots = req_data.get("time_slots", target_res["time_slots"])
            date = target_res["date"] # Keep same date

            # Check overlap with other reservations on same date
            for res in data.get("reservations", []):
                if res["id"] != res_id and res["date"] == date:
                    overlap = set(res["time_slots"]).intersection(set(time_slots))
                    if overlap:
                        self.send_response(400)
                        self.send_header('Content-Type', 'application/json; charset=utf-8')
                        self.end_headers()
                        self.wfile.write(json.dumps({"error": f"선택한 시간대({', '.join(overlap)})는 이미 다른 예약이 존재합니다."}).encode('utf-8'))
                        return

            # Update reservation
            target_res["name"] = name
            target_res["purpose"] = purpose
            target_res["time_slots"] = time_slots
            # If new password is provided, update it (only if not admin or if admin sets it)
            if "new_password" in req_data and req_data["new_password"]:
                target_res["password"] = req_data["new_password"]

            data["reservations"][target_index] = target_res
            save_data(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            res_sanitized = target_res.copy()
            del res_sanitized["password"]
            self.wfile.write(json.dumps(res_sanitized, ensure_ascii=False).encode('utf-8'))
            return
        else:
            self.send_response(404)
            self.end_headers()

    def do_DELETE(self):
        parsed_url = urlparse(self.path)
        path = parsed_url.path

        # Read request body
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length).decode('utf-8')
        try:
            req_data = json.loads(body) if body else {}
        except json.JSONDecodeError:
            req_data = {}

        # API: Unblock Date
        if path == "/api/admin/block":
            if not self.check_admin_auth():
                self.send_response(403)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "권한이 없습니다."}).encode('utf-8'))
                return

            date = req_data.get("date")
            if not date:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "날짜를 지정해야 합니다."}).encode('utf-8'))
                return

            data = load_data()
            if date in data["blocked_dates"]:
                data["blocked_dates"].remove(date)
                save_data(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "blocked_dates": data["blocked_dates"]}).encode('utf-8'))
            return

        # API: Delete Reservation
        # Expected path: /api/reservations/<id>
        elif path.startswith("/api/reservations/"):
            res_id = path.split("/")[-1]
            data = load_data()

            # Find reservation
            target_res = None
            for res in data.get("reservations", []):
                if res["id"] == res_id:
                    target_res = res
                    break

            if not target_res:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "예약을 찾을 수 없습니다."}).encode('utf-8'))
                return

            # Auth check: Admin or matching password
            is_admin = self.check_admin_auth()
            provided_password = req_data.get("password")

            if not is_admin and target_res["password"] != provided_password:
                self.send_response(403)
                self.send_header('Content-Type', 'application/json; charset=utf-8')
                self.end_headers()
                self.wfile.write(json.dumps({"error": "비밀번호가 일치하지 않습니다."}).encode('utf-8'))
                return

            # Delete reservation
            data["reservations"] = [r for r in data["reservations"] if r["id"] != res_id]
            save_data(data)

            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "message": "예약이 성공적으로 삭제되었습니다."}).encode('utf-8'))
            return
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    init_db()
    # Add mime types for CSS & JS just in case system registry has bad settings
    mimetypes.add_type("text/html", ".html")
    mimetypes.add_type("text/css", ".css")
    mimetypes.add_type("application/javascript", ".js")
    
    server_address = ('', PORT)
    httpd = ThreadingHTTPServer(server_address, ReservationRequestHandler)
    print(f"Starting server on port {PORT}...")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server...")
        sys.exit(0)

if __name__ == "__main__":
    run_server()
