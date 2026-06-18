const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, 'public');
const files = fs.readdirSync(dir).filter(f => f.toLowerCase().endsWith('.css'));

const replacements = [
  // Typography
  { regex: /font-family\s*:\s*[^;]+;/gi, replace: '/* font-family: var(--font-body); */' },
  
  // Specific legacy button gradients -> Mustard Yellow
  { regex: /linear-gradient\(135deg,\s*#00b4d8,\s*#0077b6\)/gi, replace: 'linear-gradient(135deg, var(--secondary), var(--secondary-hover))' },
  { regex: /linear-gradient\(to\s+right,\s*#00b4d8,\s*#0077b6\)/gi, replace: 'linear-gradient(135deg, var(--secondary), var(--secondary-hover))' },

  // Primary Colors (Teal instead of dark nav/hero)
  { regex: /#081018/gi, replace: 'var(--primary)' },
  { regex: /rgba\(13,26,38,0\.96\)/gi, replace: 'var(--primary)' },
  { regex: /rgba\(23,56,77,0\.92\)/gi, replace: 'var(--primary-hover)' },
  { regex: /rgba\(123,224,236,0\.22\)/gi, replace: 'rgba(223, 175, 52, 0.22)' }, // mustard accent

  // Secondary/Accent Colors (Mustard instead of cyan/blue)
  { regex: /#00b4d8/gi, replace: 'var(--secondary)' },
  { regex: /#0077b6/gi, replace: 'var(--secondary-hover)' },
  { regex: /#7be0ec/gi, replace: 'var(--secondary)' },
  { regex: /rgba\(0,119,182,0\.24\)/gi, replace: 'rgba(223, 175, 52, 0.24)' },
  
  // Text Colors
  { regex: /#18212f/gi, replace: 'var(--text-main)' },
  { regex: /#0f2235/gi, replace: 'var(--text-main)' },
  { regex: /#142235/gi, replace: 'var(--text-main)' },
  { regex: /#102033/gi, replace: 'var(--text-main)' },
  { regex: /#4e6276/gi, replace: 'var(--text-muted)' },
  { regex: /#5b6c7e/gi, replace: 'var(--text-muted)' },

  // Common UI Colors
  { regex: /#e4edf4/gi, replace: 'var(--border)' },
  { regex: /#f8fbfd/gi, replace: 'var(--bg-color)' },
  { regex: /#eef7fa/gi, replace: 'rgba(223, 175, 52, 0.1)' } // mustard light hover
];

files.forEach(file => {
    // Skip the new theme file
    if(file === 'theme.css') return;

    let cp = path.join(dir, file);
    let c = fs.readFileSync(cp, 'utf8');
    let original = c;

    replacements.forEach(rule => {
        c = c.replace(rule.regex, rule.replace);
    });

    if(c !== original){
        fs.writeFileSync(cp, c);
        console.log('Updated CSS ' + file);
    }
});
