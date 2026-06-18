async function run() {
  const form = new FormData();
  form.append("pharmacy_name", "Test Shop");
  form.append("owner_name", "Test Owner");
  form.append("mobile", "1234567890");
  form.append("email", "test@example.com");
  form.append("address", "123 Test St");
  form.append("city", "Test City");
  form.append("pincode", "123456");
  form.append("gstin", "TESTGSTIN");

  try {
    const res = await fetch("http://localhost:5000/api/seller-profile/test@example.com", {
      method: "POST",
      body: form
    });
    const data = await res.json();
    console.log("Response:", data);
  } catch (err) {
    console.error("Error:", err);
  }
}

run();
