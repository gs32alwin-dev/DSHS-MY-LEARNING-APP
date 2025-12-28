
import React, { useState, useEffect, useRef } from 'react';
import { SUBJECTS, CONTENT_TABS, INITIAL_FOLDERS, INITIAL_MATERIALS } from './constants.tsx';
import { Subject, ContentType, MindMapNode, StudyNote, Slide, Material, Folder } from './types.ts';
import { geminiService } from './services/geminiService.ts';
import MindMapViewer from './components/MindMapViewer.tsx';
import AudioPlayer from './components/AudioPlayer.tsx';
import SlideViewer from './components/SlideViewer.tsx';

const App: React.FC = () => {
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [activeTab, setActiveTab] = useState<ContentType>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  // App UI State
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedLink, setPastedLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasApiKey, setHasApiKey] = useState(true);

  // AI Content State
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [notes, setNotes] = useState<StudyNote | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  // --- PERSISTENCE & DATA MANAGEMENT ---
  const [isModified, setIsModified] = useState(() => localStorage.getItem('edusphere_is_modified') === 'true');

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('edusphere_folders_v4');
    return (saved && localStorage.getItem('edusphere_is_modified') === 'true') ? JSON.parse(saved) : INITIAL_FOLDERS;
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem('edusphere_materials_v4');
    return (saved && localStorage.getItem('edusphere_is_modified') === 'true') ? JSON.parse(saved) : INITIAL_MATERIALS;
  });

  // Sync state to LocalStorage immediately on change
  useEffect(() => {
    localStorage.setItem('edusphere_folders_v4', JSON.stringify(folders));
    localStorage.setItem('edusphere_materials_v4', JSON.stringify(materials));
    localStorage.setItem('edusphere_is_modified', isModified.toString());
  }, [materials, folders, isModified]);

  // API Key Selection logic
  useEffect(() => {
    const checkApiKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkApiKey();
  }, []);

  const handleOpenKeySelector = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
    }
  };

  // --- CONTENT ACTIONS ---

  const handleCreateFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFolder: Folder = {
      id: "fld-" + Math.random().toString(36).substr(2, 9),
      subjectId: selectedSubject?.id || 'general',
      name: (formData.get('name') as string) || 'New Chapter',
      createdAt: new Date().toLocaleDateString(),
    };
    setFolders(prev => [...prev, newFolder]);
    setIsModified(true);
    setShowFolderModal(false);
  };

  const handleFileUpload = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    let finalUrl = '';
    let finalType: any = formData.get('type') || 'doc';

    if (uploadTab === 'file' && selectedFile) {
      finalUrl = URL.createObjectURL(selectedFile);
      if (selectedFile.type.startsWith('image/')) finalType = 'image';
      else if (selectedFile.type.startsWith('video/')) finalType = 'video';
      else if (selectedFile.type === 'application/pdf') finalType = 'pdf';
    } else if (uploadTab === 'link') {
      finalUrl = pastedLink;
      finalType = 'link';
    }

    const newMaterial: Material = {
      id: "mat-" + Math.random().toString(36).substr(2, 9),
      subjectId: selectedSubject?.id || 'general',
      folderId: selectedFolder?.id,
      title: (formData.get('title') as string) || (uploadTab === 'file' ? selectedFile?.name : pastedLink) || 'Untitled',
      type: finalType,
      date: new Date().toLocaleDateString(),
      url: finalUrl
    };

    setMaterials(prev => [newMaterial, ...prev]);
    setIsModified(true);
    setShowUploadModal(false);
    setSelectedFile(null);
    setPastedLink('');
  };

  // --- ROBUST DELETION LOGIC ---

  const deleteMaterial = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Prevent the item from opening
    if (confirm("Are you sure you want to permanently delete this material from your local library?")) {
      setMaterials(prev => {
        const filtered = prev.filter(m => m.id !== id);
        console.log("Material deleted. Remaining count:", filtered.length);
        return filtered;
      });
      setIsModified(true);
      if (selectedMaterial?.id === id) setSelectedMaterial(null);
    }
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation(); // CRITICAL: Prevent the folder from opening
    if (confirm("Delete this chapter? All files inside will stay but the folder will be removed.")) {
      setFolders(prev => prev.filter(f => f.id !== id));
      setMaterials(prev => prev.map(m => m.folderId === id ? { ...m, folderId: undefined } : m));
      setIsModified(true);
      if (selectedFolder?.id === id) setSelectedFolder(null);
    }
  };

  const resetToOriginal = () => {
    if (confirm("DISCARD ALL browser changes? This will permanently delete your uploads and revert to the default school files.")) {
      setIsModified(false);
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleAnalyzeMaterial = async (material: Material) => {
    setLoading(true);
    setTopic(material.title);
    setSelectedMaterial(null);
    setActiveTab('notes');
    try {
      const [mm, nt, sl] = await Promise.all([
        geminiService.generateMindMap(material.title),
        geminiService.generateNotes(material.title),
        geminiService.generateSlides(material.title)
      ]);
      setMindMapData(mm);
      setNotes(nt);
      setSlides(sl);
      const audio = await geminiService.generateAudioSummary(nt.body);
      setAudioData(audio);
      const video = await geminiService.generateVideoLecture(material.title);
      setVideoUrl(video);
    } catch (error) {
      console.error("AI Analysis failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAIContentFromTopic = async (subject: Subject, selectedTopic: string) => {
    setLoading(true);
    setTopic(selectedTopic);
    setSelectedMaterial(null);
    try {
      const [mm, nt, sl] = await Promise.all([
        geminiService.generateMindMap(selectedTopic),
        geminiService.generateNotes(selectedTopic),
        geminiService.generateSlides(selectedTopic)
      ]);
      setMindMapData(mm);
      setNotes(nt);
      setSlides(sl);
      const audio = await geminiService.generateAudioSummary(nt.body);
      setAudioData(audio);
      const video = await geminiService.generateVideoLecture(selectedTopic);
      setVideoUrl(video);
    } catch (error) {
      console.error("AI Generation failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredSubjects = SUBJECTS.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubjectClick = (s: Subject) => {
    setSelectedSubject(s);
    setSelectedFolder(null);
    setActiveTab('materials');
    setTopic('Subject Overview');
    setSelectedMaterial(null);
  };

  const currentSubjectFolders = folders.filter(f => f.subjectId === selectedSubject?.id);
  const currentLevelMaterials = materials.filter(m => 
    m.subjectId === selectedSubject?.id && 
    m.folderId === selectedFolder?.id
  );

  const getMaterialIcon = (type: string) => {
    switch(type) {
      case 'pdf': return 'fa-file-pdf text-red-500';
      case 'video': return 'fa-play-circle text-blue-500';
      case 'image': return 'fa-image text-pink-500';
      case 'link': return 'fa-link text-emerald-500';
      default: return 'fa-file-alt text-slate-400';
    }
  };

  const generateConstantsCode = () => {
    return `// UPDATE constants.tsx WITH THIS CODE:\n\nexport const INITIAL_FOLDERS: Folder[] = ${JSON.stringify(folders, null, 2)};\n\nexport const INITIAL_MATERIALS: Material[] = ${JSON.stringify(materials, null, 2)};`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Draft Notification Header */}
      {isModified && (
        <div className="bg-rose-600 text-white px-6 py-3 flex items-center justify-between text-xs font-black uppercase tracking-widest shadow-lg z-[100]">
          <div className="flex items-center">
            <span className="bg-white text-rose-600 px-2 py-0.5 rounded mr-3 animate-pulse">LOCAL EDITS</span>
            Library modified. Sync to GitHub to update the public Netlify site.
          </div>
          <div className="flex space-x-6">
             <button onClick={() => setShowSettingsModal(true)} className="flex items-center hover:text-rose-200 transition-colors bg-rose-700 px-3 py-1 rounded-lg">
               <i className="fas fa-cloud-upload-alt mr-2"></i> Publish Changes
             </button>
             <button onClick={resetToOriginal} className="opacity-70 hover:opacity-100 hover:text-white underline">Reset All</button>
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setSelectedSubject(null); setSelectedFolder(null); }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 hover:scale-105 transition-transform">
            <i className="fas fa-graduation-cap text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">EduSphere <span className="text-indigo-600">AI</span></h1>
        </div>
        
        <div className="hidden lg:flex items-center bg-slate-100 rounded-full px-4 py-2 w-80 border border-slate-200">
          <i className="fas fa-search text-slate-400 mr-2"></i>
          <input 
            type="text" 
            placeholder="Search subjects..." 
            className="bg-transparent border-none outline-none w-full text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => setShowSettingsModal(true)} className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all shadow-sm ${isModified ? 'bg-amber-500 text-white animate-bounce' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
            <i className={`fas ${isModified ? 'fa-sync-alt' : 'fa-cog'}`}></i>
          </button>
          {selectedSubject && (
            <button onClick={() => setShowFolderModal(true)} className="hidden sm:flex items-center bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-black shadow-sm hover:bg-slate-50 transition-all">
              <i className="fas fa-folder-plus mr-2 text-indigo-500"></i> New Chapter
            </button>
          )}
          <button onClick={() => setShowUploadModal(true)} className="hidden sm:flex items-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all">
            <i className="fas fa-plus mr-2"></i> Add Content
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {!selectedSubject ? (
          <div>
            <div className="mb-12 text-center max-w-2xl mx-auto py-12">
               <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-100">Official Resource Portal</div>
              <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">Digital Library</h2>
              <p className="text-slate-500 text-xl leading-relaxed">Select a subject to manage folders and view learning resources.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSubjects.map(subject => {
                const count = materials.filter(m => m.subjectId === subject.id).length;
                return (
                  <div 
                    key={subject.id} 
                    onClick={() => handleSubjectClick(subject)}
                    className="bg-white p-8 rounded-[2rem] border border-slate-200 hover:border-indigo-500 hover:shadow-2xl transition-all group cursor-pointer relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 p-3 px-5 ${subject.color} rounded-bl-3xl text-white font-black text-[10px] uppercase shadow-sm`}>
                      {count} Items
                    </div>
                    <div className={`w-16 h-16 ${subject.color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:rotate-6 transition-transform shadow-lg`}>
                      {subject.icon.startsWith('fa-') ? (
                        <i className={`fas ${subject.icon} text-3xl`}></i>
                      ) : (
                        <span className="text-3xl font-bold leading-none">{subject.icon}</span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{subject.name}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{subject.description}</p>
                    <div className="flex items-center text-indigo-600 font-black text-sm uppercase tracking-wider">
                      Open Library <i className="fas fa-arrow-right ml-2 text-xs"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-10 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <button onClick={() => selectedFolder ? setSelectedFolder(null) : setSelectedSubject(null)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
                  <i className="fas fa-chevron-left text-slate-400"></i>
                </button>
                <h2 className="text-4xl font-black text-slate-900 tracking-tight">{selectedFolder ? selectedFolder.name : selectedSubject.name}</h2>
              </div>

              <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
                <input 
                  type="text" 
                  placeholder="Ask AI about a topic..." 
                  className="bg-transparent px-4 py-2 text-sm focus:outline-none w-48 font-bold"
                  onKeyDown={(e) => { if (e.key === 'Enter') loadAIContentFromTopic(selectedSubject, (e.target as HTMLInputElement).value); }}
                />
                <button onClick={() => { const el = document.querySelector('input[placeholder="Ask AI about a topic..."]') as HTMLInputElement; if (el.value) loadAIContentFromTopic(selectedSubject, el.value); }} className="bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-md hover:bg-indigo-700 transition-all">
                  Generate
                </button>
              </div>
            </div>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
              <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/50 p-2">
                {CONTENT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as ContentType); setSelectedMaterial(null); }}
                    className={`flex items-center space-x-2 py-3.5 px-7 m-1 text-sm font-black rounded-2xl transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-lg ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className={`fas ${tab.icon}`}></i>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-10 min-h-[600px] flex flex-col relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:32px_32px]">
                {loading && (
                  <div className="absolute inset-0 z-50 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="w-20 h-20 border-8 border-indigo-50 border-t-indigo-600 rounded-full animate-spin mb-6"></div>
                    <p className="text-indigo-950 font-black text-2xl animate-pulse">AI is generating "{topic}"...</p>
                  </div>
                )}

                {!loading && activeTab === 'materials' && (
                  <div className="w-full h-full max-w-6xl mx-auto">
                    {selectedMaterial ? (
                      <div className="animate-in fade-in zoom-in-95 h-full flex flex-col">
                         <div className="flex items-center justify-between mb-8">
                            <h3 className="text-3xl font-black text-slate-800 flex items-center">
                               <i className={`fas ${getMaterialIcon(selectedMaterial.type)} mr-4 text-4xl`}></i>
                               {selectedMaterial.title}
                            </h3>
                            <div className="flex space-x-4">
                               <button onClick={() => handleAnalyzeMaterial(selectedMaterial)} className="bg-indigo-600 text-white px-6 py-3 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center">
                                 <i className="fas fa-bolt mr-3"></i> AI Deep Dive
                               </button>
                               <button onClick={() => setSelectedMaterial(null)} className="text-slate-500 font-black text-sm bg-slate-100 px-6 py-3 rounded-2xl hover:bg-slate-200 transition-colors">
                                  Exit Preview
                               </button>
                            </div>
                         </div>
                         <div className="flex-1 w-full min-h-[500px] rounded-[2rem] overflow-hidden shadow-2xl bg-slate-900 border-4 border-slate-100">
                            {selectedMaterial.url ? (
                              selectedMaterial.type === 'video' ? ( <video src={selectedMaterial.url} controls className="w-full h-full" /> ) :
                              selectedMaterial.type === 'image' ? ( <div className="w-full h-full flex items-center justify-center p-8"><img src={selectedMaterial.url} className="max-w-full max-h-full object-contain" /></div> ) :
                              ( <iframe src={selectedMaterial.url} className="w-full h-full border-none bg-white" title={selectedMaterial.title} /> )
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white text-center">
                                 <i className="fas fa-eye-slash text-7xl mb-6 opacity-30"></i>
                                 <h4 className="text-2xl font-black">No Preview Available</h4>
                              </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-16">
                        {/* Chapters Grid */}
                        {!selectedFolder && (
                          <div>
                            <div className="flex items-center justify-between mb-8">
                              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Course Chapters</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                               {currentSubjectFolders.map(folder => (
                                 <div key={folder.id} onClick={() => setSelectedFolder(folder)} className="bg-white p-6 rounded-3xl border-2 border-slate-100 hover:border-indigo-400 hover:shadow-2xl transition-all cursor-pointer group relative">
                                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-500 mb-5 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm"><i className="fas fa-folder-open text-2xl"></i></div>
                                    <h4 className="font-black text-slate-800 text-lg mb-2">{folder.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Added: {folder.createdAt}</p>
                                    
                                    {/* DELETE BUTTON CHAPTER - FIXED INTERACTION */}
                                    <button 
                                      onClick={(e) => deleteFolder(folder.id, e)} 
                                      className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 hover:text-white z-30 shadow-md border border-rose-100"
                                      title="Delete Folder"
                                    >
                                      <i className="fas fa-trash-alt text-sm"></i>
                                    </button>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Resources Grid */}
                        <div>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8">{selectedFolder ? `Files in ${selectedFolder.name}` : 'Subject Resources'}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {currentLevelMaterials.map(mat => (
                              <div key={mat.id} onClick={() => setSelectedMaterial(mat)} className="bg-white p-7 rounded-[2rem] border-2 border-slate-50 hover:border-indigo-200 hover:shadow-2xl transition-all group cursor-pointer relative shadow-sm">
                                <div className="flex items-start justify-between mb-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${mat.type === 'pdf' ? 'bg-red-500' : mat.type === 'video' ? 'bg-blue-500' : mat.type === 'image' ? 'bg-pink-500' : mat.type === 'link' ? 'bg-emerald-500' : 'bg-slate-500'}`}>
                                    <i className={`fas ${mat.type === 'pdf' ? 'fa-file-pdf' : mat.type === 'video' ? 'fa-play-circle' : mat.type === 'image' ? 'fa-image' : mat.type === 'link' ? 'fa-link' : 'fa-file-alt'} text-xl`}></i>
                                  </div>
                                  
                                  {/* DELETE BUTTON MATERIAL - FIXED INTERACTION */}
                                  <button 
                                    onClick={(e) => deleteMaterial(mat.id, e)} 
                                    className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all z-30 shadow-md hover:bg-rose-600 hover:text-white border border-rose-100"
                                    title="Delete File"
                                  >
                                    <i className="fas fa-trash-alt text-sm"></i>
                                  </button>
                                </div>
                                <h4 className="font-black text-slate-800 text-lg mb-2 line-clamp-1">{mat.title}</h4>
                                <div className="flex items-center space-x-3">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mat.type}</span>
                                   {INITIAL_MATERIALS.some(im => im.id === mat.id) && <span className="bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full text-[8px] font-black uppercase border border-indigo-100">CORE</span>}
                                </div>
                              </div>
                            ))}
                            {currentLevelMaterials.length === 0 && (
                              <div className="col-span-full py-20 text-center border-4 border-dashed border-slate-100 rounded-[2rem]">
                                 <i className="fas fa-folder-open text-6xl text-slate-200 mb-6"></i>
                                 <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No resources found</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Content Containers */}
                {!loading && activeTab === 'video' && (
                  <div className="w-full flex flex-col items-center">
                    {videoUrl ? (
                      <div className="w-full aspect-video rounded-[3rem] overflow-hidden shadow-2xl bg-black border-8 border-slate-100">
                        <video src={videoUrl} controls className="w-full h-full" autoPlay />
                      </div>
                    ) : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">Generate an AI Deep Dive video from a resource first.</div>}
                  </div>
                )}
                {!loading && activeTab === 'mindmap' && (mindMapData ? <MindMapViewer data={mindMapData} /> : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Mind Map data.</div>)}
                {!loading && activeTab === 'audio' && (<AudioPlayer audioData={audioData} />)}
                {!loading && activeTab === 'slides' && (slides.length > 0 ? <SlideViewer slides={slides} /> : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Slides data.</div>)}
                {!loading && activeTab === 'notes' && (notes ? (
                  <div className="prose prose-slate max-w-4xl mx-auto bg-white p-14 rounded-[3rem] border border-slate-100 shadow-2xl overflow-y-auto max-h-[750px] custom-scrollbar">
                    <h2 className="text-5xl font-black text-indigo-950 mb-10 border-b-4 border-indigo-50 pb-6">{notes.title}</h2>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700 text-xl">{notes.body}</div>
                  </div>
                ) : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Notes generated yet.</div>)}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* PUBLISH / SETTINGS MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col border border-white/20">
            <div className="px-10 py-10 bg-indigo-600 text-white flex items-center justify-between">
               <div>
                  <h3 className="text-3xl font-black mb-2 text-white">Publish Changes to GitHub</h3>
                  <p className="text-indigo-100 text-sm opacity-80 font-bold uppercase tracking-widest">Update your school portal for everyone</p>
               </div>
               <button onClick={() => setShowSettingsModal(false)} className="w-12 h-12 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                  <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto space-y-10 custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className={`p-8 rounded-[2.5rem] border-4 ${isModified ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                    <h4 className={`text-xl font-black mb-4 flex items-center ${isModified ? 'text-amber-950' : 'text-emerald-950'}`}>
                      <i className={`fas ${isModified ? 'fa-pencil-ruler' : 'fa-check-double'} mr-4`}></i> 
                      {isModified ? 'Draft Saved Locally' : 'Synced with Files'}
                    </h4>
                    <p className={`text-sm leading-relaxed mb-6 font-medium ${isModified ? 'text-amber-800' : 'text-emerald-800'}`}>
                      {isModified 
                        ? 'Changes you make in the browser only you can see. To make them public, copy the code to constants.tsx.' 
                        : 'Your browser matches exactly what is in your school files.'}
                    </p>
                    <div className="bg-white/60 p-4 rounded-2xl text-[10px] font-black text-slate-600 uppercase tracking-widest flex justify-between">
                      <span>Chapters: {folders.length}</span>
                      <span>Materials: {materials.length}</span>
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-8 rounded-[2.5rem] border-4 border-indigo-200">
                    <h4 className="text-xl font-black text-indigo-950 mb-4 flex items-center">
                      <i className="fas fa-terminal mr-4"></i> Get Export Code
                    </h4>
                    <p className="text-sm text-indigo-800 leading-relaxed mb-6 font-medium">
                      Copy the code below, paste it into <strong>constants.tsx</strong> on GitHub, and Netlify will update.
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generateConstantsCode());
                        alert("COPIED! Now:\n1. Open constants.tsx\n2. Replace the data arrays\n3. Push to GitHub");
                      }}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center"
                    >
                      <i className="fas fa-copy mr-3"></i> Copy to Clipboard
                    </button>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Project Code Snippet</h4>
                  </div>
                  <pre className="bg-slate-950 text-indigo-400 p-8 rounded-[2.5rem] text-xs font-mono overflow-x-auto border-4 border-slate-800 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    {generateConstantsCode()}
                  </pre>
               </div>

               <div className="pt-6 flex space-x-6 border-t border-slate-100">
                  <button onClick={resetToOriginal} className="flex-1 border-4 border-rose-50 text-rose-500 py-4 rounded-2xl text-xs font-black hover:bg-rose-50 transition-all uppercase tracking-widest">Reset Browser State</button>
                  <button onClick={handleOpenKeySelector} className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl text-xs font-black hover:bg-slate-200 transition-all uppercase tracking-widest">Update API Key</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder & Upload Modals */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10 animate-in zoom-in-95">
            <h3 className="text-3xl font-black text-slate-900 mb-8">New Chapter</h3>
            <form onSubmit={handleCreateFolder} className="space-y-8">
               <input name="name" required autoFocus type="text" placeholder="e.g. Chapter 1: Introduction" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold focus:border-indigo-500 outline-none transition-all" />
               <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest">Create Chapter</button>
               <button type="button" onClick={() => setShowFolderModal(false)} className="w-full py-2 text-slate-400 font-black text-xs uppercase">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-10 bg-indigo-50 border-b border-indigo-100 flex items-center justify-between">
              <h3 className="text-3xl font-black text-slate-900">Add Resource</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400 text-2xl hover:text-slate-900"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleFileUpload} className="p-10 space-y-8">
               <div className="flex p-1.5 bg-slate-100 rounded-2xl">
                  <button type="button" onClick={() => setUploadTab('file')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${uploadTab === 'file' ? 'bg-white text-indigo-600 shadow-md' : 'text-slate-400'}`}>LOCAL FILE</button>
                  <button type="button" onClick={() => setUploadTab('link')} className={`flex-1 py-3 text-[10px] font-black rounded-xl transition-all ${uploadTab === 'link' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400'}`}>WEB LINK</button>
               </div>
               <input name="title" required placeholder="Resource Title" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold" />
               {uploadTab === 'file' ? (
                 <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-200 rounded-[2rem] p-10 text-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-200 transition-all">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    <i className="fas fa-cloud-upload-alt text-5xl text-slate-300 mb-4"></i>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{selectedFile ? selectedFile.name : 'Select PDF or Image'}</p>
                 </div>
               ) : (
                 <input type="url" required placeholder="Paste Link (e.g. YouTube/Drive)" value={pastedLink} onChange={(e) => setPastedLink(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold" />
               )}
               <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all uppercase tracking-widest">Confirm Upload</button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 p-10 text-center mt-auto">
        <p className="text-slate-400 font-black text-[10px] tracking-[0.4em] uppercase">EduSphere AI • Version 4.0 Stable</p>
      </footer>
    </div>
  );
};

export default App;
