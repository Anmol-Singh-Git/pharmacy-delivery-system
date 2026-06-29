const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir);
files.forEach(file => {
  if (file.endsWith('.HTML') || file.endsWith('.html')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let replaced = false;
    content = content.replace(/href=[\"']\/([^\"']+\.css)[\"']/ig, (match, p1) => {
      replaced = true;
      console.log('Replaced in ' + file + ': ' + match + ' -> href=\"./' + p1 + '\"');
      return 'href=\"./' + p1 + '\"';
    });
    if (replaced) {
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
console.log('Done replacing absolute CSS paths.');
