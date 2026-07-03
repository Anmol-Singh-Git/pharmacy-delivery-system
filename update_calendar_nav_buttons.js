const fs = require('fs');
const files = [
  'public/ORDERS.CSS',
  'public/SELLER-PAST-ORDERS.CSS',
  'public/SELLER-CATALOG.CSS'
];

const cssToAdd = `
.calendar-nav > button {
  background: #0f6c78;
  color: #ffffff;
  border: none;
  border-radius: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  cursor: pointer;
  transition: all 0.2s ease;
  line-height: 1;
}

.calendar-nav > button:hover {
  background: #0b5861;
}
`;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes('.calendar-nav > button')) {
    fs.writeFileSync(file, content + '\n' + cssToAdd);
    console.log(`Updated ${file}`);
  } else {
    console.log(`Already updated ${file}`);
  }
}
