async function testEndpoint(name: string, url: string, cookie?: string) {
  try {
    const res = await fetch(url, {
      headers: cookie ? { Cookie: `aceone.session=${cookie}` } : {},
    });
    console.log(`[${res.status === 200 ? "OK" : res.status}] ${name}: ${url} (status: ${res.status})`);
    return res;
  } catch (err: any) {
    console.error(`[ERROR] ${name}:`, err.message);
  }
}

async function main() {
  console.log("=== Testing Endpoints on Port 3007 ===");
  await testEndpoint("Login Page", "http://localhost:3007/login");
  await testEndpoint("API Notifications (Unauthorized)", "http://localhost:3007/api/notifications");
}

main().catch(console.error);
