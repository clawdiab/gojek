"""
Mitmproxy addon to capture ALL traffic with verbose logging.
Captures all auth-related domains including goto-products.com, gopayapi.com, goidentitas.id
"""
import json
import os
import sys
from datetime import datetime
from mitmproxy import http

OUTPUT_FILE = os.path.expanduser("~/gojek/gojek_captured_headers.json")
ALL_LOG = os.path.expanduser("~/gojek/all_traffic.log")

# Domains to capture full request/response details
CAPTURE_DOMAINS = [
    "gojek", "go-jek", "gojekapi",
    "goto-products.com", "gopayapi.com", "goidentitas.id",
    "goid", "gopay"
]

class CaptureAll:
    def __init__(self):
        self.captured = {}
        self.count = 0
        # Load existing captured data
        if os.path.exists(OUTPUT_FILE):
            try:
                with open(OUTPUT_FILE) as f:
                    self.captured = json.load(f)
                self.count = len(self.captured)
                print(f"[*] Loaded {self.count} existing captures", flush=True)
            except:
                pass
        print("[*] Capture addon loaded (all auth domains)!", flush=True)
        
    def _should_capture(self, host):
        return any(d in host for d in CAPTURE_DOMAINS)
        
    def request(self, flow: http.HTTPFlow):
        self.count += 1
        host = flow.request.host
        url = flow.request.url
        line = f"[{self.count}] {flow.request.method} {url}\n"
        print(line.strip(), flush=True)
        
        # Get body
        body_text = None
        try:
            body_text = flow.request.text if flow.request.text else None
        except:
            try:
                body_text = flow.request.content.hex() if flow.request.content else None
            except:
                pass
        
        with open(ALL_LOG, 'a') as f:
            f.write(f"{datetime.now().isoformat()} {line}")
            for k, v in flow.request.headers.items():
                f.write(f"  {k}: {v}\n")
            if body_text:
                f.write(f"  [BODY]: {body_text}\n")
            f.write("\n")
        
        # Capture traffic from relevant domains
        if self._should_capture(host):
            headers = dict(flow.request.headers)
            entry = {
                "timestamp": datetime.now().isoformat(),
                "url": url,
                "method": flow.request.method,
                "headers": headers,
                "body": body_text
            }
            
            key = f"{flow.request.method}_{host}_{self.count}"
            self.captured[key] = entry
            
            with open(OUTPUT_FILE, 'w') as f:
                json.dump(self.captured, f, indent=2)
            
            print(f"  ★ CAPTURED! ({host})", flush=True)
            
            if 'x-firebase-appcheck' in {k.lower() for k in headers}:
                print(f"  ★★★ FIREBASE APP CHECK TOKEN FOUND! ★★★", flush=True)

    def response(self, flow: http.HTTPFlow):
        host = flow.request.host
        if self._should_capture(host):
            # Find the matching request entry and add response
            url = flow.request.url
            method = flow.request.method
            
            # Get response body
            resp_text = None
            try:
                resp_text = flow.response.text if flow.response and flow.response.text else None
            except:
                pass
            
            status = flow.response.status_code if flow.response else None
            
            # Update the captured entry with response
            for key in reversed(list(self.captured.keys())):
                entry = self.captured[key]
                if entry['url'] == url and entry['method'] == method and 'status_code' not in entry:
                    entry['status_code'] = status
                    entry['response_body'] = resp_text[:2000] if resp_text else None
                    
                    with open(OUTPUT_FILE, 'w') as f:
                        json.dump(self.captured, f, indent=2)
                    
                    print(f"  ← {status} {url[:80]}", flush=True)
                    
                    with open(ALL_LOG, 'a') as f:
                        f.write(f"  [RESPONSE {status}]: {resp_text[:500] if resp_text else 'N/A'}\n\n")
                    break

addons = [CaptureAll()]