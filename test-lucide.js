import * as lucide from 'lucide-react';
const icons = [
  'User', 'Award', 'Activity', 'BookOpen', 'CheckCircle', 'AlertTriangle',
  'XCircle', 'Plus', 'Trash2', 'FileText', 'ChevronRight', 'Maximize',
  'Save', 'Upload', 'Download', 'Users', 'UserCheck', 'ClipboardSignature',
  'Layers', 'Lock', 'LogIn', 'LogOut', 'Settings', 'Radio', 'UserPlus',
  'Clock', 'Edit', 'Trophy'
];
const missing = icons.filter(icon => !lucide[icon]);
console.log('Missing icons:', missing);
