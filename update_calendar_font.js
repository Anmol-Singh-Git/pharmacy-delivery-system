const fs = require('fs');

const files = [
  'public/ORDERS.CSS',
  'public/SELLER-PAST-ORDERS.CSS',
  'public/SELLER-CATALOG.CSS'
];

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  // Replace font-weight:700; with font-weight:500; inside .calendar-day
  // Also we have .calendar-day { ... font-weight: 700; } in ORDERS.CSS due to my injection
  content = content.replace(/\.calendar-day\s*\{\s*[\s\S]*?\}/g, match => {
    return match.replace(/font-weight:\s*700/g, 'font-weight: 500');
  });
  
  fs.writeFileSync(file, content);
  console.log(`Updated ${file}`);
}
