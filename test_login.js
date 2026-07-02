fetch("http://localhost:5000/api/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "anmol@admpharmacy.com", password: "DevAccess2026!" })
}).then(res => res.json()).then(console.log);
