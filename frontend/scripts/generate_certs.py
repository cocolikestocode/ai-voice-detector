import os
import subprocess
from pathlib import Path

CERTS_DIR = Path(__file__).resolve().parent.parent / "certs"
CERTS_DIR.mkdir(parents=True, exist_ok=True)

OPENSSL_PATH = r"C:\msys64\ucrt64\bin\openssl.exe"
if not os.path.exists(OPENSSL_PATH):
    OPENSSL_PATH = "openssl"

def generate():
    ca_key = CERTS_DIR / "ca.key"
    ca_crt = CERTS_DIR / "ca.crt"
    server_key = CERTS_DIR / "server.key"
    server_csr = CERTS_DIR / "server.csr"
    server_crt = CERTS_DIR / "server.crt"
    ext_file = CERTS_DIR / "server.ext"

    print("Generating Root CA...")
    # Generate CA private key
    subprocess.run([
        OPENSSL_PATH, "genrsa", "-out", str(ca_key), "2048"
    ], check=True)

    # Generate Root CA certificate
    subprocess.run([
        OPENSSL_PATH, "req", "-x509", "-new", "-nodes",
        "-key", str(ca_key),
        "-sha256", "-days", "1024",
        "-out", str(ca_crt),
        "-subj", "/C=IN/ST=Delhi/L=New Delhi/O=DeepFense SIH2026/CN=DeepFense Local Root CA"
    ], check=True)

    print("Generating Server Key and CSR...")
    # Generate Server private key
    subprocess.run([
        OPENSSL_PATH, "genrsa", "-out", str(server_key), "2048"
    ], check=True)

    # Generate CSR
    subprocess.run([
        OPENSSL_PATH, "req", "-new",
        "-key", str(server_key),
        "-out", str(server_csr),
        "-subj", "/C=IN/ST=Delhi/L=New Delhi/O=DeepFense SIH2026/CN=10.255.214.64"
    ], check=True)

    # Write extensions file with SANs
    ext_content = """authorityKeyIdentifier=keyid,issuer
basicConstraints=CA:FALSE
keyUsage = digitalSignature, nonRepudiation, keyEncipherment, dataEncipherment
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = 10.255.214.64
IP.3 = 192.168.56.1
IP.4 = 0.0.0.0
"""
    with open(ext_file, "w") as f:
        f.write(ext_content)

    print("Signing Server Certificate with Root CA...")
    subprocess.run([
        OPENSSL_PATH, "x509", "-req",
        "-in", str(server_csr),
        "-CA", str(ca_crt),
        "-CAkey", str(ca_key),
        "-CAcreateserial",
        "-out", str(server_crt),
        "-days", "825",
        "-sha256",
        "-extfile", str(ext_file)
    ], check=True)

    # Cleanup CSR and ext
    if server_csr.exists():
        server_csr.unlink()
    if ext_file.exists():
        ext_file.unlink()

    print(f"Certificates generated successfully in: {CERTS_DIR}")
    print(f"  Root CA Certificate (for Android): {ca_crt}")
    print(f"  Server Key: {server_key}")
    print(f"  Server Certificate: {server_crt}")

if __name__ == "__main__":
    generate()
