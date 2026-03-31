import fs from 'fs';
const code = fs.readFileSync('src/components/PlacarResultados.tsx', 'utf8');
const tags = [...code.matchAll(/<([A-Z][a-zA-Z0-9_]*)/g)].map(m => m[1]);
const uniqueTags = [...new Set(tags)];
console.log('All JSX tags starting with uppercase in PlacarResultados:', uniqueTags);
