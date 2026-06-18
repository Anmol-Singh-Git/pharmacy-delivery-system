const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.html'));

const logoHtml = '<a class="logo-container" href="/HOMEPAGE.HTML"><img src="/images/logo.png" alt="meddeliver logo" class="site-logo"></a>';
const linkCss = '<link rel="stylesheet" href="/logo-styles.css">';

files.forEach(file => {
    let cp = path.join(dir, file);
    let c = fs.readFileSync(cp, 'utf8');
    let changed = false;

    // Inject CSS if not present
    if(!c.includes('logo-styles.css') && c.includes('</head>')) {
        c = c.replace('</head>', '    ' + linkCss + '\n</head>');
        changed = true;
    }

    // Replace the plain text links
    const regex1 = /<a\s+class=["']logo["']\s+href=["']HOMEPAGE\.HTML["']>\s*MedDeliver\s*<\/a>/gi;
    if(regex1.test(c)){
        c = c.replace(regex1, logoHtml);
        changed = true;
    }

    const regex2 = /<a\s+href=["']\/HOMEPAGE\.HTML["']\s+class=["']logo-container["']>\s*<img\s+src=["']\/images\/logo\.png["']\s+class=["']site-logo["']\s+alt=["']meddeliver logo["']>\s*<\/a>/gi;
    if(regex2.test(c)){
        // Already replaced / properly structured. Do nothing
    }

    // specific replacement for PRODUCTDETAILS.HTML JS literal
    const t1 = '<span class="logo">MedDeliver</span>';
    if(c.includes(t1)){
        const jLogo = '<a href="/HOMEPAGE.HTML" class="logo-container"><img src="/images/logo.png" class="site-logo" alt="meddeliver logo"></a>';
        c = c.split(t1).join(jLogo);
        changed = true;
    }

    if(changed){
        fs.writeFileSync(cp, c);
        console.log('Updated ' + file);
    }
});
