import React, { useState, useRef, useEffect } from 'react';
import { StoryboardData, GenerationStatus, Frame } from './types';
import { generateStoryboardText, updateStoryboardText, generateFrameImage } from './services/geminiService';
import { getApiKey, setApiKey, clearApiKey } from './services/apiKey';
import FrameCard from './components/FrameCard';

function App() {
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState<GenerationStatus>(GenerationStatus.IDLE);
  const [data, setData] = useState<StoryboardData | null>(null);
  const [hasKey, setHasKey] = useState<boolean>(() => !!getApiKey());
  const [keyInput, setKeyInput] = useState('');

  const handleSaveKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyInput.trim()) return;
    setApiKey(keyInput);
    setKeyInput('');
    setHasKey(true);
  };

  const handleChangeKey = () => {
    if (window.confirm('Remove the saved Gemini API key from this browser?')) {
      clearApiKey();
      setHasKey(false);
    }
  };
  
  // Ref to scroll to results
  const resultRef = useRef<HTMLDivElement>(null);

  // Check URL for prompt on load
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedPrompt = urlParams.get('prompt');
    if (sharedPrompt) {
        setPrompt(sharedPrompt);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    // Update URL logic only for fresh creations usually, but we keep it here for simplicity
    try {
        const url = new URL(window.location.href);
        // If we are refining, we might not want to overwrite the initial prompt query param 
        // effectively, but for this simple app, keeping the last action as the "prompt" is okay,
        // or we can decide to only set it on fresh create.
        // Let's only update URL on fresh create to allow sharing the base concept.
        if (!data) {
            url.searchParams.set('prompt', prompt);
            window.history.replaceState({}, '', url);
        }
    } catch (err) {
        console.warn("Unable to update URL history:", err);
    }

    const isUpdate = !!data;
    setStatus(isUpdate ? GenerationStatus.PLANNING : GenerationStatus.PLANNING);
    
    // Clear data only if creating new
    if (!isUpdate) {
        setData(null);
    }

    try {
      let storyboard: StoryboardData;
      let framesWithLoading: Frame[] = [];

      if (isUpdate && data) {
         // UPDATE EXISTING
         storyboard = await updateStoryboardText(data, prompt);
         
         // Merge frames: Keep images for matching IDs
         framesWithLoading = storyboard.frames.map(newFrame => {
            // Loose comparison for IDs to handle string/number mismatch
            const existingFrame = data.frames.find(f => String(f.id) === String(newFrame.id));
            if (existingFrame && existingFrame.imageUrl) {
                // Keep existing image
                return { ...newFrame, imageUrl: existingFrame.imageUrl, isGeneratingImage: false };
            } else {
                // New frame or lost ID
                return { ...newFrame, isGeneratingImage: true };
            }
         });

      } else {
         // CREATE NEW
         storyboard = await generateStoryboardText(prompt);
         framesWithLoading = storyboard.frames.map(f => ({ ...f, isGeneratingImage: true }));
      }
      
      setData({ ...storyboard, frames: framesWithLoading });
      
      setStatus(GenerationStatus.VISUALIZING);
      setPrompt(''); // Clear prompt after submission if updating
      
      // Auto-scroll to results if creating new
      if (!isUpdate) {
        setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }

      // Generate Images sequentially for any frame that needs it
      const framesToGenerate = framesWithLoading.filter(f => f.isGeneratingImage);
      
      for (const frame of framesToGenerate) {
        try {
          const base64Image = await generateFrameImage(frame.imagePrompt);
          setData(prev => {
            if (!prev) return null;
            const newFrames = [...prev.frames];
            // Loose comparison for index finding
            const frameIndex = newFrames.findIndex(f => String(f.id) === String(frame.id));
            if (frameIndex !== -1) {
               newFrames[frameIndex] = { ...newFrames[frameIndex], imageUrl: base64Image, isGeneratingImage: false };
            }
            return { ...prev, frames: newFrames };
          });
          
          // Rate limit protection
          await new Promise(resolve => setTimeout(resolve, 1500)); 

        } catch (error) {
          console.error(`Failed to generate image for frame ${frame.id}`, error);
          setData(prev => {
            if (!prev) return null;
            const newFrames = [...prev.frames];
            const frameIndex = newFrames.findIndex(f => String(f.id) === String(frame.id));
            if (frameIndex !== -1) {
               newFrames[frameIndex] = { ...newFrames[frameIndex], isGeneratingImage: false };
            }
            return { ...prev, frames: newFrames };
          });
        }
      }

      setStatus(GenerationStatus.COMPLETE);

    } catch (error) {
      console.error(error);
      setStatus(GenerationStatus.ERROR);
    }
  };

  const handleStartOver = () => {
    if (window.confirm("Start a new storyboard? This will clear current progress.")) {
        setData(null);
        setPrompt('');
        setStatus(GenerationStatus.IDLE);
        // Clear URL param
        try {
            const url = new URL(window.location.href);
            url.searchParams.delete('prompt');
            window.history.replaceState({}, '', url);
        } catch (e) { /* ignore */ }
    }
  };

  const handleRegenerateMissingImages = async () => {
    if (!data) return;
    
    // Set status to visualizing (affects global UI if needed)
    // And mark missing frames as generating
    const missingFrames = data.frames.filter(f => !f.imageUrl);
    
    setData(prev => {
        if (!prev) return null;
        return {
            ...prev,
            frames: prev.frames.map(f => !f.imageUrl ? { ...f, isGeneratingImage: true } : f)
        };
    });
    
    // Process sequentially
    for (const frame of missingFrames) {
        try {
          const base64Image = await generateFrameImage(frame.imagePrompt);
          setData(prev => {
            if (!prev) return null;
            const newFrames = [...prev.frames];
            const frameIndex = newFrames.findIndex(f => String(f.id) === String(frame.id));
            if (frameIndex !== -1) {
               newFrames[frameIndex] = { ...newFrames[frameIndex], imageUrl: base64Image, isGeneratingImage: false };
            }
            return { ...prev, frames: newFrames };
          });
          
          // Rate limit protection
          await new Promise(resolve => setTimeout(resolve, 1500));

        } catch (error) {
          console.error(`Failed to generate image for frame ${frame.id}`, error);
          setData(prev => {
            if (!prev) return null;
            const newFrames = [...prev.frames];
            const frameIndex = newFrames.findIndex(f => String(f.id) === String(frame.id));
            if (frameIndex !== -1) {
               newFrames[frameIndex] = { ...newFrames[frameIndex], isGeneratingImage: false };
            }
            return { ...prev, frames: newFrames };
          });
        }
    }
  };

  const handleUpdateImage = (id: number, newImage: string) => {
    setData(prev => {
      if (!prev) return null;
      const newFrames = prev.frames.map(f => String(f.id) === String(id) ? { ...f, imageUrl: newImage } : f);
      return { ...prev, frames: newFrames };
    });
  };

  const handleUpdateText = (id: number, updatedFields: Partial<Frame>) => {
    setData(prev => {
      if (!prev) return null;
      const newFrames = prev.frames.map(f => String(f.id) === String(id) ? { ...f, ...updatedFields } : f);
      return { ...prev, frames: newFrames };
    });
  };

  const handleDeleteFrame = (id: number) => {
    if(!window.confirm("Are you sure you want to delete this frame?")) return;
    setData(prev => {
      if (!prev) return null;
      // Convert to string for safe comparison (API might return string IDs)
      return { ...prev, frames: prev.frames.filter(f => String(f.id) !== String(id)) };
    });
  };

  const handleAddFrame = (index: number) => {
    setData(prev => {
      if (!prev) return null;
      const newFrame: Frame = {
        id: Date.now(), // Simple unique ID
        action: "New Scene",
        audio: "[Silence]",
        textOverlay: "",
        camera: "Static",
        imagePrompt: `Vertical 9:16 aspect ratio, cinematic lighting, ${prev.strategy.style}`,
        imageUrl: undefined
      };
      
      const newFrames = [...prev.frames];
      newFrames.splice(index + 1, 0, newFrame);
      return { ...prev, frames: newFrames };
    });
  };

  const handleShare = async () => {
    if (!data) return;
    
    // Try to construct a shareable URL manually, since replaceState might have failed in restricted envs
    let shareUrl = window.location.href;
    try {
        const url = new URL(window.location.href);
        // If we have a stored prompt in url, use that, otherwise use current
        if (!url.searchParams.get('prompt') && prompt) {
             url.searchParams.set('prompt', prompt);
        }
        shareUrl = url.toString();
    } catch (e) {
        console.warn("Could not construct share URL object", e);
    }

    const textSummary = `
WE. STORYBOARD AI
------------------
CONCEPT: ${data.strategy.title}
LINK: ${shareUrl}
    `.trim();

    try {
        await navigator.clipboard.writeText(textSummary);
        alert("Storyboard link copied to clipboard!");
    } catch (err) {
        console.error('Failed to copy', err);
        window.prompt("Copy this link:", shareUrl);
    }
  };

  return (
    <div className="min-h-screen bg-agency-black text-white selection:bg-agency-accent selection:text-white font-sans antialiased">
      {/* Header */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-agency-black/80 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
           <a href="../" className="flex items-center gap-2 hover:opacity-80 transition-opacity" title="Back to We. Tools">
             <img src="../assets/we-logo.svg" alt="We." className="w-8 h-8" />
             <span className="font-bold tracking-tight text-agency-gray hidden sm:inline">Tools</span>
           </a>
           <span className="text-agency-gray/50">/</span>
           <span className="font-bold tracking-tight cursor-pointer" onClick={() => window.location.reload()}>Storyboard AI</span>
        </div>
        <div className="flex items-center gap-4">
           {hasKey && (
             <button
               onClick={handleChangeKey}
               className="text-xs text-agency-gray hover:text-white font-medium uppercase tracking-wider"
               title="Remove the saved Gemini API key"
             >
               Change key
             </button>
           )}
           {data && (
             <button 
               onClick={handleShare}
               className="text-xs font-semibold uppercase tracking-wide text-white hover:text-agency-accent transition-colors flex items-center gap-2 bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-full"
             >
               <span>Share Link</span>
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
               </svg>
             </button>
           )}
           <div className="text-xs text-agency-gray font-mono hidden md:block border-l border-white/10 pl-4">
             POWERED BY GEMINI 2.5
           </div>
        </div>
      </nav>

      <main className="pt-24 pb-20 px-4 max-w-5xl mx-auto">
        
        {/* Input Section */}
        <section className={`transition-all duration-700 ${data ? 'opacity-100' : 'min-h-[60vh] flex flex-col justify-center'}`}>
          <div className="max-w-2xl mx-auto text-center space-y-8">
             {!data && (
                <>
                  <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                    Turn ideas into <br/> <span className="text-agency-accent">visual stories.</span>
                  </h1>
                  <p className="text-agency-gray text-lg font-light max-w-lg mx-auto">
                    A professional storyboard generator for creators. Enter a concept, get a shot list and visuals instantly.
                  </p>
                </>
             )}
             
             {!hasKey && (
               <div className="max-w-xl mx-auto text-left bg-agency-dark/50 border border-white/10 rounded-xl p-8 space-y-4">
                 <h2 className="text-lg font-bold">Add your Gemini API key to start</h2>
                 <p className="text-sm text-agency-gray leading-relaxed">
                   This tool calls Google's Gemini API directly from your browser. Your key is saved
                   only in this browser's local storage — it is never sent anywhere except to Google.
                   Get a free key at{' '}
                   <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="text-agency-accent underline">
                     aistudio.google.com/apikey
                   </a>.
                 </p>
                 <form onSubmit={handleSaveKey} className="flex gap-2">
                   <input
                     type="password"
                     value={keyInput}
                     onChange={(e) => setKeyInput(e.target.value)}
                     placeholder="Paste your Gemini API key"
                     className="flex-1 bg-agency-black border border-white/10 rounded-lg py-3 px-4 text-white placeholder-agency-gray/50 focus:outline-none focus:border-agency-accent"
                   />
                   <button
                     type="submit"
                     className="bg-agency-accent hover:opacity-90 text-white font-semibold rounded-lg px-5 transition-all disabled:opacity-50"
                     disabled={!keyInput.trim()}
                   >
                     Save
                   </button>
                 </form>
               </div>
             )}

             {hasKey && (
             <form onSubmit={handleSubmit} className="relative w-full max-w-xl mx-auto group">
               <input
                 type="text"
                 value={prompt}
                 onChange={(e) => setPrompt(e.target.value)}
                 placeholder={data ? "Refine storyboard (e.g. 'Remove the second frame')..." : "E.g., A pickleball rookie's first game..."}
                 disabled={status === GenerationStatus.PLANNING || status === GenerationStatus.VISUALIZING}
                 className="w-full bg-agency-dark border border-white/10 rounded-full py-4 px-6 pr-32 text-white placeholder-agency-gray/50 focus:outline-none focus:border-agency-accent focus:ring-1 focus:ring-agency-accent transition-all shadow-lg"
               />
               <div className="absolute right-2 top-2 bottom-2 flex items-center gap-2">
                 {data && (
                   <button
                     type="button"
                     onClick={handleStartOver}
                     className="text-xs text-agency-gray hover:text-white px-3 font-medium uppercase tracking-wider"
                     title="Clear and start over"
                   >
                     New
                   </button>
                 )}
                 <button
                   type="submit"
                   disabled={status === GenerationStatus.PLANNING || status === GenerationStatus.VISUALIZING}
                   className="bg-agency-accent hover:opacity-90 text-white font-semibold rounded-full px-6 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                 >
                   {status === GenerationStatus.PLANNING ? 'Thinking...' : status === GenerationStatus.VISUALIZING ? 'Rendering...' : (data ? 'Update' : 'Create')}
                 </button>
               </div>
             </form>
             )}

             {status === GenerationStatus.ERROR && (
               <p className="text-red-400 text-sm">Something went wrong. Please check your API key and try again.</p>
             )}
          </div>
        </section>

        {/* Results Section */}
        {data && (
          <div ref={resultRef} className="mt-16 space-y-12 animate-fade-in-up">
            
            {/* Strategy Card */}
            <div className="bg-agency-dark/30 border border-white/10 p-8 rounded-xl grid md:grid-cols-3 gap-8">
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-agency-accent mb-2">Title</h3>
                    <p className="text-2xl font-semibold leading-tight">{data.strategy.title}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-agency-accent mb-2">Hook</h3>
                    <p className="text-base text-agency-gray leading-relaxed">{data.strategy.hook}</p>
                </div>
                <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest text-agency-accent mb-2">Style</h3>
                    <p className="text-base text-agency-gray leading-relaxed">{data.strategy.style}</p>
                </div>
            </div>

            {/* Frames Feed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                 <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold tracking-tight">Shot Sequence</h2>
                    {/* Retry Button */}
                    {data.frames.some(f => !f.imageUrl && !f.isGeneratingImage) && (
                        <button
                            onClick={handleRegenerateMissingImages}
                            className="text-xs bg-agency-dark hover:bg-agency-accent border border-white/10 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Regenerate Missing
                        </button>
                    )}
                 </div>
                 <span className="text-xs font-medium text-agency-gray bg-agency-dark px-2 py-1 rounded">
                    {status === GenerationStatus.VISUALIZING ? 'Generating Visuals...' : `${data.frames.length} SHOTS`}
                 </span>
              </div>
              
              <div className="bg-agency-dark/20 border border-white/5 rounded-xl overflow-hidden relative">
                {data.frames.map((frame, index) => (
                  <React.Fragment key={frame.id}>
                    <FrameCard 
                      frame={frame}
                      index={index} 
                      onUpdateImage={handleUpdateImage}
                      onUpdateText={handleUpdateText}
                      onDelete={handleDeleteFrame}
                    />
                    
                    {/* Add Frame In-Between */}
                    <div className="h-4 hover:h-12 flex items-center justify-center transition-all group/add cursor-pointer -my-2 relative z-10"
                         onClick={() => handleAddFrame(index)}>
                        <div className="w-full h-[1px] bg-agency-dark group-hover/add:bg-agency-accent transition-colors"></div>
                        <div className="absolute bg-agency-black border border-agency-dark group-hover/add:border-agency-accent text-agency-gray group-hover/add:text-white rounded-full w-8 h-8 flex items-center justify-center transition-all opacity-0 group-hover/add:opacity-100 transform scale-0 group-hover/add:scale-100">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                        </div>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </div>

            {/* Asset List */}
            <div className="grid md:grid-cols-3 gap-6 pt-8 border-t border-white/10">
               <div className="bg-agency-dark/30 p-6 rounded-xl border border-white/5 hover:bg-agency-dark/50 transition-colors">
                 <div className="flex items-center gap-2 mb-3 text-agency-gray">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" /></svg>
                   <h3 className="font-bold uppercase tracking-wider text-xs">Sound</h3>
                 </div>
                 <p className="text-base font-medium">{data.assets.music}</p>
               </div>

               <div className="bg-agency-dark/30 p-6 rounded-xl border border-white/5 hover:bg-agency-dark/50 transition-colors">
                 <div className="flex items-center gap-2 mb-3 text-agency-gray">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                   <h3 className="font-bold uppercase tracking-wider text-xs">Props</h3>
                 </div>
                 <ul className="list-disc list-inside text-sm space-y-2 text-white/80">
                   {data.assets.props.map((prop, i) => <li key={i}>{prop}</li>)}
                 </ul>
               </div>

               <div className="bg-agency-dark/30 p-6 rounded-xl border border-white/5 hover:bg-agency-dark/50 transition-colors">
                 <div className="flex items-center gap-2 mb-3 text-agency-gray">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                   <h3 className="font-bold uppercase tracking-wider text-xs">Talent</h3>
                 </div>
                 <ul className="list-disc list-inside text-sm space-y-2 text-white/80">
                   {data.assets.talent.map((t, i) => <li key={i}>{t}</li>)}
                 </ul>
               </div>

          </div>
        </div>
      )}
      </main>
    </div>
  );
}

export default App;