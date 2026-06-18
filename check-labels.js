const fs = require('fs');
const html = fs.readFileSync('public/SELLER-DASHBOARD.HTML', 'utf8');

let labelCount = 0;
let lines = html.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const opens = (line.match(/<label\b/gi) || []).length;
  const closes = (line.match(/<\/label>/gi) || []).length;
  
  for(let j=0; j<opens; j++){
    console.log(`Line ${i+1}: OPEN <label>`);
    labelCount++;
  }
  for(let j=0; j<closes; j++){
    console.log(`Line ${i+1}: CLOSE </label>`);
    labelCount--;
  }
}

console.log('Final count:', labelCount);
