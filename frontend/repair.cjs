const fs = require('fs');
let css = fs.readFileSync('found_index.css', 'utf8');
if (css.startsWith('"')) css = css.substring(1);
if (css.endsWith('"')) css = css.substring(0, css.length - 1);
css = css.replace(/\\n/g, '\n').replace(/\\"/g, '"');
css += '\n.validation-error { color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 8px; border-radius: 4px; margin-bottom: 12px; font-size: 14px; }\n';
fs.writeFileSync('src/index.css', css);
console.log('Fixed index.css, length:', css.length);
