const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      filelist = walkSync(path.join(dir, file), filelist);
    }
    else {
      filelist.push(path.join(dir, file));
    }
  });
  return filelist;
};

const allFiles = walkSync(path.join(__dirname, 'public'));

allFiles.forEach(file => {
  if (file.endsWith('.html') || file.endsWith('.js') || file.endsWith('.css')) {
    let content = fs.readFileSync(file, 'utf8');
    if (content.includes('api.js')) {
      content = content.replace(/api\.js/g, 'core.js');
      fs.writeFileSync(file, content);
      console.log('Updated:', file);
    }
  }
});
