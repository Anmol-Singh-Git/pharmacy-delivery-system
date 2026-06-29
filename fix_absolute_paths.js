const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir);
files.forEach(file => {
  if (file.endsWith('.HTML') || file.endsWith('.html') || file.endsWith('.js')) {
    const filePath = path.join(dir, file);
    let content = fs.readFileSync(filePath, 'utf8');
    let replaced = false;
    
    // Replace src="/images/..." with src="./images/..."
    content = content.replace(/src=[\"']\/images\//ig, (match) => {
      replaced = true;
      return match.replace('/images/', './images/');
    });

    // Replace src="/api.js" with src="./api.js"
    content = content.replace(/src=[\"']\/api\.js[\"']/ig, (match) => {
      replaced = true;
      return 'src=\"./api.js\"';
    });

    // Replace href="/..." in navbar logic in api.js or others, except if it's already ./ or http
    // Actually, earlier we saw href="/HOMEPAGE.HTML" inside api.js and other files.
    content = content.replace(/href=[\"']\/(?![/])/ig, (match) => {
      replaced = true;
      return 'href=\"./';
    });

    if (replaced) {
      console.log('Replaced absolute paths in ' + file);
      fs.writeFileSync(filePath, content, 'utf8');
    }
  }
});
console.log('Done fixing absolute paths.');
