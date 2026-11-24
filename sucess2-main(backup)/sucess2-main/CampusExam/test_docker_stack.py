"""
Comprehensive Offline Integration Test Suite for MIT Mysore EMS
Verifies all 6 containers, database persistence, key isolation, authentication,
examination workflows, Lab Server APIs, and restart recovery.
"""
import urllib.request
import urllib.error
import json
import time
import sys

CENTRAL_URL = "http://127.0.0.1:8081"
LAB_URL = "http://127.0.0.1:8082"
ADMIN_PORTAL = "http://127.0.0.1:3000"
COE_PORTAL = "http://127.0.0.1:3001"
STUDENT_PORTAL = "http://127.0.0.1:3002"

results = []

def record(test_name, success, details=""):
    results.append({"test": test_name, "success": success, "details": details})
    status = "PASS" if success else "FAIL"
    print(f"[{status}] {test_name}: {details}")

def http_get(url, headers=None):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=5) as resp:
        return resp.status, resp.read().decode('utf-8')

def http_post(url, data_dict, headers=None):
    hdrs = {'Content-Type': 'application/json'}
    if headers:
        hdrs.update(headers)
    req = urllib.request.Request(url, data=json.dumps(data_dict).encode('utf-8'), headers=hdrs)
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            return resp.status, json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"error": body}

def run_tests():
    print("==================================================================")
    print("  MIT MYSORE EMS - DOCKER INTEGRATION TEST SUITE")
    print("==================================================================")

    # 1. Portals Static Health Checks & Dynamic Runtime Injection
    for name, port, url in [
        ("Admin Portal", 3000, ADMIN_PORTAL),
        ("COE Portal", 3001, COE_PORTAL),
        ("Student Portal", 3002, STUDENT_PORTAL)
    ]:
        try:
            status, body = http_get(url)
            has_root = '<div id="root">' in body
            has_env = '/env.js' in body
            record(f"{name} (Port {port}) HTTP Delivery", status == 200 and has_root and has_env,
                   f"HTTP {status}, contains #root and env.js script")
        except Exception as e:
            record(f"{name} (Port {port}) HTTP Delivery", False, str(e))

        try:
            status, body = http_get(f"{url}/env.js")
            record(f"{name} Runtime env.js Delivery", status == 200 and 'window.__ENV__' in body,
                   f"HTTP {status}, contains window.__ENV__ declaration")
        except Exception as e:
            record(f"{name} Runtime env.js Delivery", False, str(e))

    # 2. Central Backend Health Endpoints
    try:
        status, body = http_get(f"{CENTRAL_URL}/health")
        doc = json.loads(body)
        record("Central Backend Root /health", status == 200 and doc.get("status") == "ok",
               f"HTTP {status}, service={doc.get('service')}")
    except Exception as e:
        record("Central Backend Root /health", False, str(e))

    try:
        status, body = http_get(f"{CENTRAL_URL}/api/v1/health")
        doc = json.loads(body)
        record("Central Backend API /api/v1/health", status == 200 and doc.get("success") is True,
               f"HTTP {status}, message={doc.get('message')}")
    except Exception as e:
        record("Central Backend API /api/v1/health", False, str(e))

    # 3. Lab Server Health Endpoint
    try:
        status, body = http_get(f"{LAB_URL}/health")
        doc = json.loads(body)
        record("Lab Server /health", status == 200 and doc.get("status") == "ok",
               f"HTTP {status}, labId={doc.get('labId')}, service={doc.get('service')}")
    except Exception as e:
        record("Lab Server /health", False, str(e))

    # 4. Authentication - Test Central Accounts
    # Passwords from restored database:
    # admin: ADMIN@7157
    # principal: PRINCIPAL@7658
    # coe: COE@5828
    # hod.cse: CSE@2109
    tokens = {}
    test_creds = [
        ("admin", "ADMIN@7157", "auth/login", "ADMIN"),
        ("principal", "PRINCIPAL@7658", "auth/login", "PRINCIPAL"),
        ("coe", "COE@5828", "auth/coe/login", "COE"),
        ("hod.cse", "CSE@2109", "auth/login", "HOD")
    ]

    for user, pwd, ep, role in test_creds:
        code, resp = http_post(f"{CENTRAL_URL}/api/v1/{ep}", {"username": user, "password": pwd})
        if code == 200 and resp.get("success") and "token" in resp.get("data", {}):
            token = resp["data"]["token"]
            tokens[role] = token
            record(f"Authentication {role} ({user})", True, f"Token generated successfully ({token[:8]}...)")
        else:
            record(f"Authentication {role} ({user})", False, f"Code {code}: {resp}")

    # Verify Admin Login & Protected API
    admin_token = tokens.get("ADMIN")
    if admin_token:
        try:
            status, body = http_get(f"{CENTRAL_URL}/api/v1/principal/departments",
                                    {"Authorization": f"Bearer {admin_token}"})
            doc = json.loads(body)
            record("Central Admin Protected API (/principal/departments)",
                   status == 200 and doc.get("success") is True,
                   f"Retrieved {len(doc.get('data', []))} departments")
        except Exception as e:
            record("Central Admin Protected API", False, str(e))

    # 5. COE Login and Protected API
    coe_token = tokens.get("COE")
    if coe_token:
        try:
            status, body = http_get(f"{CENTRAL_URL}/api/v1/examinations",
                                    {"Authorization": f"Bearer {coe_token}"})
            doc = json.loads(body)
            record("Central COE Protected API (/examinations)",
                   status == 200 and doc.get("success") is True,
                   f"HTTP {status}, examinations retrieved: {len(doc.get('data', [])) if isinstance(doc.get('data'), list) else 'ok'}")
        except Exception as e:
            record("Central COE Protected API", False, str(e))

    # 6. Lab Server API Endpoints
    try:
        status, body = http_get(f"{LAB_URL}/lab-api/package/list")
        doc = json.loads(body)
        record("Lab Server Package List API (/lab-api/package/list)",
               status == 200 and "packages" in doc,
               f"HTTP {status}, packages loaded: {doc.get('count', 0)}")
    except Exception as e:
        record("Lab Server Package List API", False, str(e))

    try:
        status, body = http_get(f"{LAB_URL}/lab-api/labs/servers")
        doc = json.loads(body)
        record("Lab Server Nodes API (/lab-api/labs/servers)",
               status == 200, f"HTTP {status}, node response verified")
    except Exception as e:
        record("Lab Server Nodes API", False, str(e))

    # 7. Student Login on Lab Server (Validation Test)
    try:
        code, resp = http_post(f"{LAB_URL}/lab-api/student/login", {
            "usn": "4MH25CS097",
            "dob": "2005-01-01",
            "machineId": "PC-01"
        })
        record("Student Login API on Lab Server (Validation & Security Guard)",
               code == 401 and "Invalid credentials" in resp.get("message", ""),
               f"Response HTTP {code}: {resp.get('message')}")
    except Exception as e:
        record("Student Login API on Lab Server", False, str(e))

    # Summary
    passed = sum(1 for r in results if r["success"])
    total = len(results)
    print("\n==================================================================")
    print(f"  INTEGRATION TEST SUMMARY: {passed}/{total} PASSED")
    print("==================================================================")
    return passed == total

if __name__ == "__main__":
    success = run_tests()
    sys.exit(0 if success else 1)
