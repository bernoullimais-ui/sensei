import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, Move, Type, Calendar, BookOpen, Download, Save, Trash2, Clock, QrCode } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface CertificateField {
  id: string;
  type: 'name' | 'date' | 'title' | 'workload' | 'day' | 'month' | 'custom' | 'qrcode';
  text?: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  fontSize: number;
  color: string;
  fontWeight: string;
  fontFamily: string;
}

export interface CertificateTemplate {
  backgroundImage: string;
  fields: CertificateField[];
}

interface CertificateDesignerProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: CertificateTemplate) => void;
  initialTemplate?: CertificateTemplate | null;
  targetName: string; // Course or Module name for preview
}

const CertificateDesigner: React.FC<CertificateDesignerProps> = ({
  isOpen,
  onClose,
  onSave,
  initialTemplate,
  targetName
}) => {
  const [template, setTemplate] = useState<CertificateTemplate>(
    initialTemplate || { backgroundImage: '', fields: [] }
  );
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  // Update when initialTemplate changes (e.g. switching modules)
  useEffect(() => {
    if (initialTemplate) {
      setTemplate(initialTemplate);
      if (initialTemplate.backgroundImage) {
        const img = new Image();
        img.onload = () => setImageSize({ width: img.width, height: img.height });
        img.src = initialTemplate.backgroundImage;
      }
    } else {
      setTemplate({ backgroundImage: '', fields: [] });
      setImageSize(null);
    }
  }, [initialTemplate, isOpen]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const img = new Image();
      img.onload = () => {
        // Compress image if needed
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1600;
        const MAX_HEIGHT = 1600;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Use JPEG with 0.8 quality to significantly reduce size
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          setImageSize({ width, height });
          setTemplate({ ...template, backgroundImage: compressedDataUrl });
        } else {
          // Fallback if canvas fails
          setImageSize({ width: img.width, height: img.height });
          setTemplate({ ...template, backgroundImage: dataUrl });
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const addField = (type: CertificateField['type']) => {
    const newField: CertificateField = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      x: 50,
      y: 50,
      fontSize: 24,
      color: '#000000',
      fontWeight: '600',
      fontFamily: 'Inter'
    };
    setTemplate({ ...template, fields: [...template.fields, newField] });
    setSelectedFieldId(newField.id);
  };

  const updateField = (id: string, updates: Partial<CertificateField>) => {
    setTemplate({
      ...template,
      fields: template.fields.map(f => f.id === id ? { ...f, ...updates } : f)
    });
  };

  const removeField = (id: string) => {
    setTemplate({
      ...template,
      fields: template.fields.filter(f => f.id !== id)
    });
    if (selectedFieldId === id) setSelectedFieldId(null);
  };

  const handleDrag = (e: React.MouseEvent | React.TouchEvent, fieldId: string) => {
    if (!containerRef.current) return;
    
    const container = containerRef.current.getBoundingClientRect();
    
    const onMove = (moveEvent: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX;
      const clientY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY;
      
      const x = ((clientX - container.left) / container.width) * 100;
      const y = ((clientY - container.top) / container.height) * 100;
      
      updateField(fieldId, { 
        x: Math.max(0, Math.min(100, x)), 
        y: Math.max(0, Math.min(100, y)) 
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  };

  const handleSave = () => {
    if (!template.backgroundImage) {
      alert('Por favor, carregue uma imagem de fundo para o certificado.');
      return;
    }
    console.log('Save button clicked in CertificateDesigner', template);
    onSave(template);
  };

  if (!isOpen) return null;

  const selectedField = template.fields.find(f => f.id === selectedFieldId);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden"
      >
        <div className="p-4 border-b flex items-center justify-between bg-slate-50">
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BookOpen className="text-red-600" />
            Designer de Certificado - {targetName}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Main Workspace */}
          <div className="flex-1 p-8 bg-slate-200 overflow-auto flex items-center justify-center min-h-[400px]">
            {template.backgroundImage ? (
              <div 
                ref={containerRef}
                className="relative shadow-xl bg-white bg-no-repeat bg-center"
                style={{ 
                  backgroundImage: `url(${template.backgroundImage})`,
                  backgroundSize: '100% 100%',
                  width: imageSize ? (imageSize.width > imageSize.height ? '842px' : 'auto') : '842px',
                  height: imageSize ? (imageSize.width > imageSize.height ? 'auto' : '595px') : 'auto',
                  aspectRatio: imageSize ? `${imageSize.width} / ${imageSize.height}` : '1.414',
                  maxWidth: '100%',
                  maxHeight: '100%'
                }}
              >
                {template.fields.map(field => (
                  <div
                    key={field.id}
                    onMouseDown={(e) => {
                      setSelectedFieldId(field.id);
                      handleDrag(e, field.id);
                    }}
                    className={`absolute cursor-move select-none whitespace-nowrap p-1 rounded border-2 transition-all group ${
                      selectedFieldId === field.id ? 'border-red-500 bg-red-50/20' : 'border-transparent hover:border-slate-300'
                    }`}
                    style={{
                      left: `${field.x}%`,
                      top: `${field.y}%`,
                      transform: 'translate(-50%, -50%)',
                      fontSize: `${field.fontSize}px`,
                      color: field.color || '#000',
                      fontWeight: field.fontWeight || '400',
                      fontFamily: field.fontFamily || 'Inter'
                    }}
                  >
                    {field.type === 'name' && 'NOME DO PARTICIPANTE'}
                    {field.type === 'date' && new Date().toLocaleDateString('pt-BR')}
                    {field.type === 'title' && targetName}
                    {field.type === 'workload' && '40 HORAS'}
                    {field.type === 'day' && new Date().getDate().toString().padStart(2, '0')}
                    {field.type === 'month' && new Date().toLocaleString('pt-BR', { month: 'long' })}
                    {field.type === 'custom' && (field.text || 'TEXTO PERSONALIZADO')}
                    {field.type === 'qrcode' && (
                      <div className="flex flex-col items-center gap-1">
                        <QrCode size={field.fontSize * 1.5} />
                        <span className="text-[10px] font-bold">VALIDAÇÃO DIGITAL</span>
                      </div>
                    )}
                    
                    {selectedFieldId === field.id && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        <Move size={10} /> Arraste para posicionar
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="w-full max-w-md h-64 border-2 border-dashed border-slate-400 rounded-xl flex flex-col items-center justify-center gap-4 bg-white/50 hover:bg-white hover:border-red-500 cursor-pointer transition-all"
              >
                <Upload className="text-slate-400" size={48} />
                <div className="text-center">
                  <p className="font-medium text-slate-700">Upload de Layout</p>
                  <p className="text-sm text-slate-500">Selecione uma imagem para o fundo do certificado</p>
                </div>
              </div>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImageUpload} 
              accept="image/*" 
              className="hidden" 
            />
          </div>

          {/* Sidebar Controls */}
          <div className="w-full lg:w-72 border-l bg-slate-50 p-6 overflow-y-auto">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Type size={18} className="text-red-600" />
              Campos Dinâmicos
            </h3>
            
            <div className="space-y-2 mb-8">
              <button 
                onClick={() => addField('name')}
                disabled={!template.backgroundImage}
                className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-red-100 flex items-center justify-center"><Type size={14} className="text-red-600" /></div>
                Nome do Participante
              </button>
              <button 
                onClick={() => addField('date')}
                disabled={!template.backgroundImage}
                className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-blue-100 flex items-center justify-center"><Calendar size={14} className="text-blue-600" /></div>
                Data de Conclusão de Curso
              </button>
              <button 
                onClick={() => addField('title')}
                disabled={!template.backgroundImage}
                className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-green-100 flex items-center justify-center"><BookOpen size={14} className="text-green-600" /></div>
                Nome do Curso / Módulo
              </button>
              <button 
                onClick={() => addField('workload')}
                disabled={!template.backgroundImage}
                className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-purple-100 flex items-center justify-center"><Clock size={14} className="text-purple-600" /></div>
                Carga Horária
              </button>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button 
                  onClick={() => addField('day')}
                  disabled={!template.backgroundImage}
                  className="text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Dia
                </button>
                <button 
                  onClick={() => addField('month')}
                  disabled={!template.backgroundImage}
                  className="text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  Mês
                </button>
              </div>
              <button 
                onClick={() => addField('qrcode')}
                disabled={!template.backgroundImage}
                className="w-full text-left px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm hover:border-red-500 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center"><QrCode size={14} className="text-slate-600" /></div>
                Código de Autenticidade (QR)
              </button>
            </div>

            {selectedField && (
              <div className="space-y-4 border-t pt-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800 text-sm italic">Propriedades do Campo</h4>
                  <button 
                    onClick={() => removeField(selectedField.id)}
                    className="p-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Tamanho da Fonte</label>
                    <input 
                      type="range" 
                      min="8" max="120" 
                      value={selectedField.fontSize} 
                      onChange={(e) => updateField(selectedField.id, { fontSize: parseInt(e.target.value) })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-red-600"
                    />
                    <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                      <span>8px</span>
                      <span className="font-bold text-red-600">{selectedField.fontSize}px</span>
                      <span>120px</span>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Cor do Texto</label>
                    <div className="flex gap-2 items-center">
                      <input 
                        type="color" 
                        value={selectedField.color} 
                        onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                        className="w-10 h-10 border-0 p-0 overflow-hidden cursor-pointer rounded-md"
                      />
                      <input 
                        type="text" 
                        value={selectedField.color.toUpperCase()} 
                        onChange={(e) => updateField(selectedField.id, { color: e.target.value })}
                        className="flex-1 px-2 py-1 border rounded text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-slate-500 uppercase tracking-wider block mb-1">Peso da Fonte</label>
                    <select 
                      value={selectedField.fontWeight}
                      onChange={(e) => updateField(selectedField.id, { fontWeight: e.target.value })}
                      className="w-full px-2 py-1 border rounded text-xs"
                    >
                      <option value="300">Light (300)</option>
                      <option value="400">Regular (400)</option>
                      <option value="600">Semi-Bold (600)</option>
                      <option value="700">Bold (700)</option>
                      <option value="800">Extra-Bold (800)</option>
                    </select>
                  </div>
                </div>
              </div>
            )}

            {!template.backgroundImage && (
              <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                <p>⚠️ Faça o upload de uma imagem antes de adicionar campos.</p>
              </div>
            )}
            
            {template.backgroundImage && (
              <div className="mt-8 space-y-2">
                <button 
                  onClick={handleSave}
                  className="w-full py-3 bg-red-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-700 transition-all shadow-lg active:scale-95"
                >
                  <Save size={18} />
                  Salvar Template
                </button>
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full py-3 bg-white border-2 border-red-200 text-red-600 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-50 transition-all"
                >
                  <Upload size={18} />
                  Trocar Imagem
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CertificateDesigner;
