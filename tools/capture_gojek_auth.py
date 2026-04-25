"""
Mitmproxy addon to capture Gojek authentication headers.
Run with: mitmdump -s capture_gojek_auth.py --set block_global=false

Then configure your Android device to use this proxy and open the Gojek app.
The captured headers will be saved to gojek_captured_headers.json
"""
import json
import os
from datetime import datetime
from mitmproxy import http

OUTPUT_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gojek_captured_headers.json")

class GojekHeaderCapture:
    def __init__(self):
        self.captured = {}
        
    def response(self, flow: http.HTTPFlow):
        # Capture responses from Gojek API
        if "gojekapi.com" in flow.request.host or "go-jek.com" in flow.request.host or "accounts.goto-products.com" in flow.request.host:
            headers = dict(flow.request.headers)
            
            # Extract relevant auth headers
            auth_headers = {}
            for key, value in headers.items():
                key_lower = key.lower()
                if any(x in key_lower for x in ['x-app', 'x-device', 'x-firebase', 'x-unique', 'x-platform', 'x-user', 'authorization', 'user-agent', 'gojek']):
                    auth_headers[key] = value
            
            if auth_headers:
                self.captured[flow.request.host] = {
                    "timestamp": datetime.now().isoformat(),
                    "url": flow.request.url,
                    "method": flow.request.method,
                    "headers": auth_headers,
                    "body": flow.request.text if flow.request.text else None
                }
                
                # Save to file
                with open(OUTPUT_FILE, 'w') as f:
                    json.dump(self.captured, f, indent=2)
                
                print(f"\n[CAPTURED] {flow.request.host}")
                print(f"  Headers: {list(auth_headers.keys())}")
                
                # Check for the golden ticket
                if 'x-firebase-appcheck' in auth_headers:
                    print(f"\n  ★★★ FIREBASE APP CHECK TOKEN CAPTURED ★★★")
                    print(f"  Token: {auth_headers['x-firebase-appcheck'][:50]}...")

addons = [GojekHeaderCapture()]