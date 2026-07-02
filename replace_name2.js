const fs = require('fs');
const path = require('path');

const walkSync = function(dir, filelist) {
  const files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(path.join(dir, file)).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'images' && file !== 'uploads' && file !== '.gemini' && !file.startsWith('.')) {
        filelist = walkSync(path.join(dir, file), filelist);
      }
    }
    else {
      const ext = path.extname(file).toLowerCase();
      if (['.html', '.js', '.css', '.json'].includes(ext)) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const targetDir = 'c:\\Users\\anmol\\PROJECT MEDICA';
const files = walkSync(targetDir);

let changedFiles = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  // Replace case-sensitive ADM Pharmacy
  content = content.replace(/(?<![a-zA-Z])ADM Pharmacy(?![a-zA-Z])/g, 'ADM Pharmacy');
  
  // Replace all uppercase
  content = content.replace(/(?<![a-zA-Z])ADM PHARMACY(?![a-zA-Z])/g, 'ADM PHARMACY');
  
  // Replace all lowercase
  content = content.replace(/(?<![a-zA-Z])adm pharmacy(?![a-zA-Z])/g, 'adm pharmacy');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    changedFiles++;
    console.log('Updated:', file);
  }
});

console.log(`Total files updated: ${changedFiles}`);
