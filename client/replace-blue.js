const fs = require('fs');
const path = require('path');

const replacements = [
  ['bg-blue-600', 'bg-[#154CB3]'],
  ['hover:bg-blue-700', 'hover:bg-[#154cb3df]'],
  ['bg-blue-500', 'bg-[#154CB3]'],
  ['bg-blue-700', 'bg-[#154CB3]'],
  ['border-blue-600', 'border-[#154CB3]'],
  ['text-blue-600', 'text-[#154CB3]'],
  ['border-blue-500', 'border-[#154CB3]'],
  ['hover:border-blue-500', 'hover:border-[#154CB3]'],
  ['focus:ring-blue-500', 'focus:ring-[#154CB3]'],
  ['focus:border-blue-500', 'focus:border-[#154CB3]'],
];

function replaceInFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  replacements.forEach(([from, to]) => {
    if (content.includes(from)) {
      content = content.replace(new RegExp(from, 'g'), to);
      modified = true;
    }
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Updated: ${path.relative(process.cwd(), filePath)}`);
  }
}

function walkDir(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      walkDir(filePath);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
      replaceInFile(filePath);
    }
  });
}

console.log('🔵 Replacing all lighter blue colors with brand color #154CB3...\n');
walkDir(path.join(__dirname, 'app'));
console.log('\n✨ Done! All blue colors replaced.');
