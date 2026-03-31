import * as lucide from 'lucide-react';
const icons = [
  'CheckCircle2', 'XCircle', 'AlertCircle', 'Trophy', 'Users', 'User', 'ArrowLeft'
];
const missing = icons.filter(icon => !lucide[icon]);
console.log('Missing icons in PlacarResultados:', missing);
