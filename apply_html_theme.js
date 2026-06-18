const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.html'));

const themeCssLink = '<link rel="stylesheet" href="/theme.css">';

files.forEach(file => {
    let cp = path.join(dir, file);
    let c = fs.readFileSync(cp, 'utf8');
    let changed = false;

    // Inject theme.css if not present
    if(!c.includes('theme.css') && c.includes('</head>')) {
        c = c.replace('</head>', '    ' + themeCssLink + '\n</head>');
        changed = true;
    }

    if(changed){
        fs.writeFileSync(cp, c);
        console.log('Updated HTML ' + file);
    }
});
