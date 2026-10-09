#!/usr/bin/python3
"""Exercise the actual HAProxy config with isolated loopback fixture backends."""
import http.client
import http.server
import json
import pathlib
import socket
import ssl
import subprocess
import tempfile
import threading
import time


class Backend(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        payload = json.dumps({"environment": self.server.environment,
                              "origin": self.headers.get("Origin"),
                              "forwardedFor": self.headers.get("X-Forwarded-For"),
                              "forwardedProto": self.headers.get("X-Forwarded-Proto"),
                              "forwarded": self.headers.get("Forwarded")}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        try:
            self.wfile.write(payload)
        except (BrokenPipeError, ConnectionResetError):
            # HAProxy health checks can close after receiving the HTTP headers.
            pass

    def log_message(self, *args):
        pass


def request(sni, host):
    with socket.create_connection(("127.0.0.1", 18443), timeout=10) as raw:
        with ssl.create_default_context().wrap_socket(raw, server_hostname=sni) as connection:
            wire = ("GET /v1/network HTTP/1.1\r\nHost: " + host + "\r\n"
                    "Origin: https://testnet.app.daclify.com\r\n"
                    "X-Forwarded-For: 192.0.2.99\r\nX-Forwarded-Proto: http\r\n"
                    "Forwarded: for=192.0.2.99\r\nConnection: close\r\n\r\n")
            connection.sendall(wire.encode())
            response = http.client.HTTPResponse(connection)
            response.begin()
            return response.status, response.read()


def main():
    servers = {}
    for environment in ("mainnet", "testnet"):
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Backend)
        server.environment = environment
        threading.Thread(target=server.serve_forever, daemon=True).start()
        servers[environment] = server
    with tempfile.TemporaryDirectory(prefix="daclify-routing-") as temporary:
        config = pathlib.Path(__file__).with_name("haproxy.cfg").read_text()
        config = "\n".join(line for line in config.splitlines()
                           if "stats socket" not in line and "bind [::]" not in line)
        config = config.replace("bind :80", "bind 127.0.0.1:18080").replace("bind :443", "bind 127.0.0.1:18443")
        for environment, port in [("mainnet", 3018), ("testnet", 3028)]:
            config = config.replace("127.0.0.1:" + str(port), "127.0.0.1:" + str(servers[environment].server_port))
        path = pathlib.Path(temporary) / "haproxy.cfg"
        path.write_text(config + "\n")
        subprocess.run(["haproxy", "-c", "-f", str(path)], check=True)
        process = subprocess.Popen(["haproxy", "-db", "-f", str(path)], stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
        try:
            for attempt in range(30):
                if process.poll() is not None:
                    raise RuntimeError("Isolated HAProxy failed to start")
                try:
                    status, body = request("api.daclify.com", "api.daclify.com")
                    if status == 200:
                        break
                except (OSError, ssl.SSLError):
                    pass
                time.sleep(0.1)
            else:
                raise RuntimeError("Isolated HAProxy did not become ready")
            for environment, host in [("mainnet", "api.daclify.com"), ("testnet", "testnet.api.daclify.com")]:
                status, body = request(host, host)
                payload = json.loads(body)
                assert status == 200 and payload["environment"] == environment
                assert payload["origin"] == "https://testnet.app.daclify.com"
                assert payload["forwardedFor"] == "127.0.0.1" and payload["forwardedProto"] == "https"
                assert payload["forwarded"] is None
            assert request("api.daclify.com", "unknown.daclify.com")[0] == 421
            assert request("api.daclify.com", "testnet.api.daclify.com")[0] == 421
            assert request("testnet.api.daclify.com", "api.daclify.com")[0] == 421
            assert request("api.daclify.com", "api.daclify.com.evil.example")[0] == 421
            assert request("api.daclify.com", "api.daclify.com:444")[0] == 421
            servers["mainnet"].shutdown()
            servers["mainnet"].server_close()
            assert request("api.daclify.com", "api.daclify.com")[0] == 503
            assert json.loads(request("testnet.api.daclify.com", "testnet.api.daclify.com")[1])["environment"] == "testnet"
            servers["testnet"].shutdown()
            servers["testnet"].server_close()
            assert request("testnet.api.daclify.com", "testnet.api.daclify.com")[0] == 503
            print("Actual HAProxy config: hostname/SNI isolation, Origin, spoofed forwarding headers and independent backend failures passed.")
        finally:
            process.terminate()
            process.wait(timeout=5)
            for server in servers.values():
                server.shutdown()
                server.server_close()


if __name__ == "__main__":
    main()
