import React, { useState } from 'react';
import { Frame } from '../types';
import { editFrameImage, generateFrameImage } from '../services/geminiService';

interface FrameCardProps {
  frame: Frame;
  index: number;
  onUpdateImage: (id: number, newImage: string) => void;
  onUpdateText: (id: number, updatedFrame: Partial<Frame>) => void;
  onDelete: (id: number) => void;
}

const FrameCard: React.FC<FrameCardProps> = ({ frame, index, onUpdateImage, onUpdateText, onDelete }) => {
  const [isEditingVisual, setIsEditingVisual] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  
  // Visual Edit State
  const [editPrompt, setEditPrompt] = useState('');
  const [isProcessingVisual, setIsProcessingVisual] = useState(false);
  
  // Text Edit State
  const [textForm, setTextForm] = useState({
    action: frame.action,
    audio: frame.audio,
    textOverlay: frame.textOverlay,
    camera: frame.camera,
    imagePrompt: frame.imagePrompt
  });

  const [error, setError] = useState<string | null>(null);

  const isLoading = isProcessingVisual || frame.isGeneratingImage;

  // Handle "Edit Image" (Modify existing)
  const handleEditImageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!frame.imageUrl || !editPrompt.trim()) return;

    setIsProcessingVisual(true);
    setError(null);
    try {
      const newImageBase64 = await editFrameImage(frame.imageUrl, editPrompt);
      onUpdateImage(frame.id, newImageBase64);
      setIsEditingVisual(false);
      setEditPrompt('');
    } catch (err) {
      console.error(err);
      setError("Failed to edit image.");
    } finally {
      setIsProcessingVisual(false);
    }
  };

  // Handle "Regenerate Image" (Create new from prompt)
  const handleRegenerateImage = async () => {
    if (!textForm.imagePrompt.trim()) return;

    setIsProcessingVisual(true);
    setError(null);
    try {
      const newImageBase64 = await generateFrameImage(textForm.imagePrompt);
      onUpdateImage(frame.id, newImageBase64);
    } catch (err) {
      console.error(err);
      setError("Failed to generate image.");
    } finally {
      setIsProcessingVisual(false);
    }
  };

  // Handle Text Updates
  const handleTextSave = () => {
    onUpdateText(frame.id, textForm);
    setIsEditingText(false);
  };

  return (
    <div className="flex flex-col md:flex-row items-start gap-6 p-6 border-b border-agency-dark last:border-0 bg-agency-black/50 hover:bg-agency-dark/30 transition-colors group/card relative">
      
      {/* Delete Button (Always visible now for better UX) */}
      {!isEditingText && (
        <button 
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(frame.id);
          }}
          className="absolute top-3 right-3 p-2 text-agency-gray/50 hover:text-red-500 transition-colors z-20 rounded-full hover:bg-white/10"
          title="Delete Frame"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      )}

      {/* Text Info Column */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="bg-agency-accent text-white font-bold px-3 py-1 text-sm rounded-full">
              FRAME {index + 1}
            </span>
            {!isEditingText && (
               <span className="text-agency-gray text-xs uppercase tracking-widest">{frame.camera}</span>
            )}
          </div>
          
          {!isEditingText ? (
            <button 
              onClick={() => setIsEditingText(true)}
              className="text-agency-gray hover:text-white text-xs underline decoration-agency-accent/50 hover:decoration-agency-accent"
            >
              Edit Details
            </button>
          ) : (
            <div className="flex gap-2">
               <button onClick={() => setIsEditingText(false)} className="text-xs text-agency-gray hover:text-white">Cancel</button>
               <button onClick={handleTextSave} className="text-xs bg-agency-accent text-white px-3 py-1 rounded hover:bg-red-600 font-bold">Save</button>
            </div>
          )}
        </div>
        
        {isEditingText ? (
           <div className="space-y-3 animate-fade-in">
             <div>
               <label className="text-xs text-agency-gray uppercase font-bold">Action / Visual</label>
               <textarea 
                 value={textForm.action} 
                 onChange={e => setTextForm({...textForm, action: e.target.value})}
                 className="w-full bg-agency-dark border border-white/10 rounded p-2 text-white focus:border-agency-accent outline-none text-sm"
                 rows={2}
               />
             </div>
             <div className="grid grid-cols-2 gap-3">
               <div>
                  <label className="text-xs text-agency-gray uppercase font-bold">Camera</label>
                  <input 
                    value={textForm.camera} 
                    onChange={e => setTextForm({...textForm, camera: e.target.value})}
                    className="w-full bg-agency-dark border border-white/10 rounded p-2 text-white focus:border-agency-accent outline-none text-sm"
                  />
               </div>
               <div>
                  <label className="text-xs text-agency-gray uppercase font-bold">Text Overlay</label>
                  <input 
                    value={textForm.textOverlay} 
                    onChange={e => setTextForm({...textForm, textOverlay: e.target.value})}
                    className="w-full bg-agency-dark border border-white/10 rounded p-2 text-white focus:border-agency-accent outline-none text-sm"
                  />
               </div>
             </div>
             <div>
                <label className="text-xs text-agency-gray uppercase font-bold">Audio</label>
                <input 
                  value={textForm.audio} 
                  onChange={e => setTextForm({...textForm, audio: e.target.value})}
                  className="w-full bg-agency-dark border border-white/10 rounded p-2 text-white focus:border-agency-accent outline-none text-sm"
                />
             </div>
             <div>
                <label className="text-xs text-agency-gray uppercase font-bold">Image Prompt (For AI)</label>
                <textarea 
                  value={textForm.imagePrompt} 
                  onChange={e => setTextForm({...textForm, imagePrompt: e.target.value})}
                  className="w-full bg-agency-dark border border-white/10 rounded p-2 text-agency-gray focus:text-white focus:border-agency-accent outline-none text-xs font-mono"
                  rows={3}
                />
             </div>
           </div>
        ) : (
          <div className="space-y-2">
            <h4 className="text-white font-serif text-xl leading-tight">{frame.action}</h4>
            
            <div className="bg-agency-dark p-3 rounded border-l-2 border-agency-gray">
              <p className="text-xs text-agency-gray mb-1 uppercase font-bold">Audio</p>
              <p className="text-sm italic text-white/90">{frame.audio}</p>
            </div>

            <div className="bg-agency-dark p-3 rounded border-l-2 border-agency-accent">
               <p className="text-xs text-agency-accent mb-1 uppercase font-bold">Text Overlay</p>
               <p className="text-sm font-bold text-white">{frame.textOverlay}</p>
            </div>
            
            <div className="pt-4 text-xs text-agency-gray/50 font-mono truncate">
               Prompt: {frame.imagePrompt}
            </div>
          </div>
        )}
      </div>

      {/* Visual Column */}
      <div className="w-full md:w-[220px] lg:w-[280px] shrink-0 flex flex-col items-center">
        <div className="relative w-full aspect-[9/16] bg-agency-dark rounded-lg overflow-hidden border border-agency-dark shadow-2xl group">
          {frame.imageUrl ? (
            <>
              <img 
                src={`data:image/png;base64,${frame.imageUrl}`} 
                alt={`Frame ${index + 1}`} 
                className="w-full h-full object-cover"
              />
              
              {/* Controls Overlay */}
              {!isEditingVisual && !isLoading && (
                <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={handleRegenerateImage}
                    className="bg-black/50 hover:bg-agency-accent backdrop-blur-md text-white p-2 rounded-full border border-white/20"
                    title="Regenerate from Prompt"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setIsEditingVisual(true)}
                    className="bg-black/50 hover:bg-agency-accent backdrop-blur-md text-white p-2 rounded-full border border-white/20"
                    title="Edit with AI Instruction"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 21l2.846-.813a4.5 4.5 0 003.09-3.09L21.75 15l-.813-2.846a4.5 4.5 0 00-3.09-3.09L15 9l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L12 15m0 0l-6.259 6.285" />
                    </svg>
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-4 text-center">
              {isLoading ? (
                 <>
                   <div className="w-8 h-8 border-2 border-agency-accent border-t-transparent rounded-full animate-spin mb-4"></div>
                   <p className="text-xs text-agency-gray">Generating Visual...</p>
                 </>
              ) : (
                 <button 
                   onClick={handleRegenerateImage}
                   className="group/gen flex flex-col items-center gap-2"
                 >
                   <div className="w-12 h-12 rounded-full bg-agency-dark border border-white/10 flex items-center justify-center group-hover/gen:border-agency-accent group-hover/gen:bg-agency-accent/20 transition-all">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-agency-gray group-hover/gen:text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 21l2.846-.813a4.5 4.5 0 003.09-3.09L21.75 15l-.813-2.846a4.5 4.5 0 00-3.09-3.09L15 9l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L12 15m0 0l-6.259 6.285" />
                      </svg>
                   </div>
                   <p className="text-xs text-agency-gray group-hover/gen:text-white">Generate Image</p>
                 </button>
              )}
            </div>
          )}
          
          {/* Edit Mode Overlay */}
          {isEditingVisual && (
            <div className="absolute inset-0 bg-black/90 backdrop-blur-md p-4 flex flex-col justify-center z-20">
              <h5 className="text-white font-bold text-sm mb-2">Refine Image</h5>
              <form onSubmit={handleEditImageSubmit} className="flex flex-col gap-2">
                <textarea 
                  className="w-full bg-agency-dark border border-white/20 rounded p-2 text-sm text-white focus:border-agency-accent outline-none resize-none"
                  rows={3}
                  placeholder="E.g., Make it darker, add a cat..."
                  value={editPrompt}
                  onChange={(e) => setEditPrompt(e.target.value)}
                  autoFocus
                />
                <div className="flex gap-2 mt-2">
                   <button 
                    type="button" 
                    onClick={() => { setIsEditingVisual(false); setError(null); }}
                    className="flex-1 bg-white/10 text-xs py-2 rounded hover:bg-white/20 transition"
                   >
                     Cancel
                   </button>
                   <button 
                    type="submit"
                    disabled={!editPrompt.trim()}
                    className="flex-1 bg-agency-accent text-white text-xs py-2 rounded font-bold hover:bg-red-600 transition disabled:opacity-50"
                   >
                     Apply
                   </button>
                </div>
              </form>
            </div>
          )}

           {/* Processing State Overlay for existing images */}
           {isLoading && frame.imageUrl && (
             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-20">
               <div className="text-center">
                 <div className="w-8 h-8 border-2 border-agency-accent border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                 <p className="text-xs font-bold text-white">Refining Frame...</p>
               </div>
             </div>
           )}

           {/* Error State */}
           {error && (
             <div className="absolute top-0 left-0 right-0 bg-red-500/90 text-white text-xs p-2 text-center z-30">
               {error}
               <button onClick={() => setError(null)} className="ml-2 font-bold hover:text-black">x</button>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default FrameCard;