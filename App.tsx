
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
  
  // App State
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

  // Initialize from Seed Data + LocalStorage
  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('edusphere_folders');
    const local = saved ? JSON.parse(saved) : [];
    const merged = [...INITIAL_FOLDERS];
    local.forEach((l: Folder) => {
        if (!merged.find(m => m.id === l.id)) merged.push(l);
    });
    return merged;
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem('edusphere_materials');
    const local = saved ? JSON.parse(saved) : [];
    const merged = [...INITIAL_MATERIALS];
    local.forEach((l: Material) => {
        if (!merged.find(m => m.id === l.id)) merged.push(l);
    });
    return merged;
  });

  // Persistence for LOCAL testing (not for students)
  useEffect(() => {
    const localFolders = folders.filter(f => !INITIAL_FOLDERS.find(ifld => ifld.id === f.id));
    const localMaterials = materials.filter(m => !INITIAL_MATERIALS.find(imat => imat.id === m.id));
    localStorage.setItem('edusphere_folders', JSON.stringify(localFolders));
    localStorage.setItem('edusphere_materials', JSON.stringify(localMaterials));
  }, [materials, folders]);

  // API Key Check
  useEffect(() => {
    const checkApiKey = async () => {
      if (typeof window !== 'undefined' && (window as any).aistudio) {
        const has = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkApiKey();
  }, []);

  const filteredSubjects = SUBJECTS.filter(s =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpenKeySelector = async () => {
    if (typeof window !== 'undefined' && (window as any).aistudio) {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true);
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
      alert("AI Analysis error. Check your API key.");
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

  const handleSubjectClick = (s: Subject) => {
    setSelectedSubject(s);
    setSelectedFolder(null);
    setActiveTab('materials');
    setTopic('Subject Overview');
    setSelectedMaterial(null);
  };

  const handleCreateFolder = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newFolder: Folder = {
      id: "fld-" + Math.random().toString(36).substr(2, 9),
      subjectId: selectedSubject?.id || 'general',
      name: (formData.get('name') as string) || 'New Chapter',
      createdAt: new Date().toLocaleDateString(),
    };
    setFolders([...folders, newFolder]);
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

    setMaterials([newMaterial, ...materials]);
    setShowUploadModal(false);
    setSelectedFile(null);
    setPastedLink('');
  };

  const deleteMaterial = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this material?")) {
      setMaterials(materials.filter(m => m.id !== id));
      if (selectedMaterial?.id === id) setSelectedMaterial(null);
    }
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Delete this chapter?")) {
      setFolders(folders.filter(f => f.id !== id));
      setMaterials(materials.map(m => m.folderId === id ? { ...m, folderId: undefined } : m));
      if (selectedFolder?.id === id) setSelectedFolder(null);
    }
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

  // Helper to generate code for constants.tsx
  const generateConstantsCode = () => {
    return `// Copy this into INITIAL_FOLDERS in constants.tsx
export const INITIAL_FOLDERS: Folder[] = ${JSON.stringify(folders, null, 2)};

// Copy this into INITIAL_MATERIALS in constants.tsx
export const INITIAL_MATERIALS: Material[] = ${JSON.stringify(materials, null, 2)};`;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setSelectedSubject(null); setSelectedFolder(null); }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 transition-transform hover:scale-105">
            <i className="fas fa-graduation-cap text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">EduSphere <span className="text-indigo-600">AI</span></h1>
        </div>
        
        <div className="hidden lg:flex items-center bg-slate-100 rounded-full px-4 py-2 w-80 border border-slate-200">
          <i className="fas fa-search text-slate-400 mr-2"></i>
          <input 
            type="text" 
            placeholder="Search subjects or topics..." 
            className="bg-transparent border-none outline-none w-full text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-4">
          <button onClick={() => setShowSettingsModal(true)} className="w-10 h-10 flex items-center justify-center bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-colors" title="Deployment Center">
            <i className="fas fa-tools"></i>
          </button>
          {selectedSubject && (
            <button onClick={() => setShowFolderModal(true)} className="hidden sm:flex items-center bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-all">
              <i className="fas fa-folder-plus mr-2 text-indigo-500"></i> New Chapter
            </button>
          )}
          <button onClick={() => setShowUploadModal(true)} className="hidden sm:flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
            <i className="fas fa-plus mr-2"></i> Add Content
          </button>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {!selectedSubject ? (
          <div>
            <div className="mb-10 text-center max-w-2xl mx-auto py-10">
               <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-xs font-black uppercase tracking-widest mb-4">Official Student Portal</div>
              <h2 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Your Digital Library</h2>
              <p className="text-slate-500 text-xl leading-relaxed">Choose your subject below to access pre-loaded chapters and AI study tools.</p>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredSubjects.map(subject => {
                const count = materials.filter(m => m.subjectId === subject.id).length;
                return (
                  <div 
                    key={subject.id} 
                    onClick={() => handleSubjectClick(subject)}
                    className="bg-white p-8 rounded-3xl border border-slate-200 hover:border-indigo-500 hover:shadow-2xl hover:shadow-indigo-100 transition-all group cursor-pointer relative overflow-hidden"
                  >
                    <div className={`absolute top-0 right-0 p-3 px-5 ${subject.color} rounded-bl-3xl text-white font-bold text-xs shadow-sm`}>
                      {count} Resources
                    </div>
                    <div className={`w-16 h-16 ${subject.color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:rotate-6 transition-transform shadow-xl`}>
                      {subject.icon.startsWith('fa-') ? (
                        <i className={`fas ${subject.icon} text-3xl`}></i>
                      ) : (
                        <span className="text-3xl font-bold leading-none">{subject.icon}</span>
                      )}
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{subject.name}</h3>
                    <p className="text-slate-500 text-sm mb-6">{subject.description}</p>
                    <div className="flex items-center text-indigo-600 font-bold text-sm">
                      Enter Classroom <i className="fas fa-arrow-right ml-2 text-xs"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <button onClick={() => selectedFolder ? setSelectedFolder(null) : setSelectedSubject(null)} className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm">
                  <i className="fas fa-chevron-left text-slate-400"></i>
                </button>
                <div className="flex flex-col">
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">{selectedFolder ? selectedFolder.name : selectedSubject.name}</h2>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <input 
                  type="text" 
                  placeholder="Ask AI about a topic..." 
                  className="bg-transparent px-4 py-2 text-sm focus:outline-none w-48 font-medium"
                  onKeyDown={(e) => { if (e.key === 'Enter') loadAIContentFromTopic(selectedSubject, (e.target as HTMLInputElement).value); }}
                />
                <button onClick={() => { const el = document.querySelector('input[placeholder="Ask AI about a topic..."]') as HTMLInputElement; if (el.value) loadAIContentFromTopic(selectedSubject, el.value); }} className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg hover:bg-indigo-700 transition-all">
                  Generate
                </button>
              </div>
            </div>

            {/* Content Display */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
              <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/50 p-2">
                {CONTENT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => { setActiveTab(tab.id as ContentType); setSelectedMaterial(null); }}
                    className={`flex items-center space-x-2 py-3 px-6 m-1 text-sm font-bold rounded-xl transition-all ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className={`fas ${tab.icon}`}></i>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-8 min-h-[550px] flex flex-col relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                {loading && (
                  <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    <p className="mt-6 text-indigo-900 font-extrabold text-lg">AI is processing "{topic}"...</p>
                  </div>
                )}

                {!loading && activeTab === 'materials' && (
                  <div className="w-full h-full max-w-6xl mx-auto">
                    {selectedMaterial ? (
                      <div className="animate-in fade-in zoom-in-95 h-full flex flex-col">
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold flex items-center">
                               <i className={`fas ${getMaterialIcon(selectedMaterial.type)} mr-3`}></i>
                               {selectedMaterial.title}
                            </h3>
                            <div className="flex space-x-3">
                               <button onClick={() => handleAnalyzeMaterial(selectedMaterial)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl font-bold text-sm shadow-lg hover:bg-indigo-700 transition-all flex items-center">
                                 <i className="fas fa-sparkles mr-2"></i> AI Deep Dive
                               </button>
                               <button onClick={() => setSelectedMaterial(null)} className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 px-4 py-2 rounded-xl">
                                  Close
                               </button>
                            </div>
                         </div>
                         <div className="flex-1 w-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700">
                            {selectedMaterial.url ? (
                              selectedMaterial.type === 'video' ? ( <video src={selectedMaterial.url} controls className="w-full h-full object-contain" /> ) :
                              selectedMaterial.type === 'image' ? ( <div className="w-full h-full flex items-center justify-center p-4"><img src={selectedMaterial.url} className="max-w-full max-h-full object-contain rounded-xl" /></div> ) :
                              ( <iframe src={selectedMaterial.url} className="w-full h-full border-none bg-white" title={selectedMaterial.title} /> )
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 text-center">
                                 <i className={`fas ${getMaterialIcon(selectedMaterial.type)} text-6xl mb-6 opacity-50`}></i>
                                 <h4 className="text-xl font-bold">No Preview Available</h4>
                              </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-12">
                        {/* Chapters */}
                        {!selectedFolder && (
                          <div>
                            <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-6">Chapters</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                               {currentSubjectFolders.map(folder => (
                                 <div key={folder.id} onClick={() => setSelectedFolder(folder)} className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer group relative">
                                    <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all"><i className="fas fa-folder text-xl"></i></div>
                                    <h4 className="font-bold text-slate-800 mb-1">{folder.name}</h4>
                                    <p className="text-[10px] text-slate-400 font-bold uppercase">Uploaded: {folder.createdAt}</p>
                                    <button onClick={(e) => deleteFolder(folder.id, e)} className="absolute top-4 right-4 text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-trash-alt text-xs"></i></button>
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                        {/* Resources */}
                        <div>
                          <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest mb-6">{selectedFolder ? selectedFolder.name : 'General Resources'}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {currentLevelMaterials.map(mat => (
                              <div key={mat.id} onClick={() => setSelectedMaterial(mat)} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all group cursor-pointer relative">
                                <div className="flex items-start justify-between mb-4">
                                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${mat.type === 'pdf' ? 'bg-red-500' : mat.type === 'video' ? 'bg-blue-500' : mat.type === 'image' ? 'bg-pink-500' : mat.type === 'link' ? 'bg-emerald-500' : 'bg-slate-400'}`}>
                                    <i className={`fas ${mat.type === 'pdf' ? 'fa-file-pdf' : mat.type === 'video' ? 'fa-play-circle' : mat.type === 'image' ? 'fa-image' : mat.type === 'link' ? 'fa-link' : 'fa-file-alt'}`}></i>
                                  </div>
                                  <button onClick={(e) => deleteMaterial(mat.id, e)} className="w-8 h-8 flex items-center justify-center text-slate-200 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"><i className="fas fa-trash-alt"></i></button>
                                </div>
                                <h4 className="font-bold text-slate-800 mb-1 line-clamp-1">{mat.title}</h4>
                                <div className="flex items-center space-x-2">
                                   <p className="text-[10px] text-slate-400 font-bold uppercase">{mat.type.toUpperCase()}</p>
                                   {INITIAL_MATERIALS.find(im => im.id === mat.id) && <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Core</span>}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Views */}
                {!loading && activeTab === 'video' && (
                  <div className="w-full flex flex-col items-center">
                    {videoUrl ? (
                      <div className="w-full aspect-video rounded-[2.5rem] overflow-hidden shadow-2xl bg-slate-900 border border-slate-700">
                        <video src={videoUrl} controls className="w-full h-full object-contain" autoPlay />
                      </div>
                    ) : <div className="text-slate-400 font-bold">No AI Video generated. Use "AI Deep Dive" on a resource first.</div>}
                  </div>
                )}

                {!loading && activeTab === 'mindmap' && (mindMapData ? <MindMapViewer data={mindMapData} /> : <div className="text-slate-400 font-bold">No Mind Map generated.</div>)}
                {!loading && activeTab === 'audio' && (<AudioPlayer audioData={audioData} />)}
                {!loading && activeTab === 'slides' && (slides.length > 0 ? <SlideViewer slides={slides} /> : <div className="text-slate-400 font-bold">No Slides generated.</div>)}
                {!loading && activeTab === 'notes' && (notes ? (
                  <div className="prose prose-slate max-w-4xl mx-auto bg-white p-12 rounded-[2rem] border border-slate-100 shadow-2xl overflow-y-auto max-h-[700px] custom-scrollbar">
                    <h2 className="text-4xl font-black text-indigo-950 mb-8 border-b border-slate-100 pb-4">{notes.title}</h2>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700 text-lg">{notes.body}</div>
                  </div>
                ) : <div className="text-slate-400 font-bold">No Notes generated.</div>)}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DEPLOYMENT CENTER MODAL */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-4xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="px-8 py-8 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
               <div>
                  <h3 className="text-2xl font-black">Creator Deployment Center</h3>
                  <p className="text-indigo-100 text-sm opacity-80">Make your uploaded content permanent for all students.</p>
               </div>
               <button onClick={() => setShowSettingsModal(false)} className="w-10 h-10 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                  <i className="fas fa-times"></i>
               </button>
            </div>
            
            <div className="p-8 flex-1 overflow-y-auto space-y-8">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100">
                    <h4 className="text-lg font-black text-emerald-900 mb-4 flex items-center">
                      <i className="fas fa-save mr-3"></i> 1. Upload & Save
                    </h4>
                    <p className="text-sm text-emerald-800 leading-relaxed mb-4">
                      Upload all your PDF notes, videos, and links using the "Add Content" button in the main app. Once you are happy with the library, move to step 2.
                    </p>
                    <div className="bg-white/50 p-3 rounded-xl text-xs font-bold text-emerald-600 italic">
                      Current: {folders.length} Chapters, {materials.length} Materials
                    </div>
                  </div>

                  <div className="bg-indigo-50 p-6 rounded-3xl border border-indigo-100">
                    <h4 className="text-lg font-black text-indigo-900 mb-4 flex items-center">
                      <i className="fas fa-code mr-3"></i> 2. Copy Code
                    </h4>
                    <p className="text-sm text-indigo-800 leading-relaxed mb-4">
                      Copy the code block below. This code contains all your uploaded resources in a permanent format.
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generateConstantsCode());
                        alert("Code copied! Now paste it into constants.tsx");
                      }}
                      className="w-full bg-indigo-600 text-white py-3 rounded-xl font-black text-xs shadow-lg hover:bg-indigo-700 transition-all"
                    >
                      <i className="fas fa-copy mr-2"></i> Copy Data Code
                    </button>
                  </div>
               </div>

               <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">3. Update constants.tsx</h4>
                  <div className="relative group">
                    <pre className="bg-slate-900 text-indigo-300 p-6 rounded-3xl text-xs font-mono overflow-x-auto border-4 border-slate-800 shadow-inner max-h-60 overflow-y-auto custom-scrollbar">
                      {generateConstantsCode()}
                    </pre>
                    <div className="absolute top-4 right-4 bg-indigo-600 text-white text-[10px] px-2 py-1 rounded font-bold uppercase">Constants.tsx Code</div>
                  </div>
                  <div className="flex items-center space-x-3 text-amber-600 bg-amber-50 p-4 rounded-2xl border border-amber-100">
                    <i className="fas fa-exclamation-triangle"></i>
                    <p className="text-xs font-medium leading-relaxed">
                      <strong>Important:</strong> After pasting this code and deploying, students will see your updates instantly. Local browser storage is only for your testing.
                    </p>
                  </div>
               </div>

               <div className="pt-4 flex space-x-4">
                  <button onClick={() => { if(confirm("Clear all locally uploaded content?")) { localStorage.clear(); window.location.reload(); } }} className="flex-1 border border-red-200 text-red-500 py-3 rounded-xl text-xs font-black hover:bg-red-50 transition-all uppercase">Reset Local View</button>
                  <button onClick={handleOpenKeySelector} className="flex-1 bg-slate-100 text-slate-600 py-3 rounded-xl text-xs font-black hover:bg-slate-200 transition-all uppercase">Manage API Key</button>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* New Folder & Upload Modals (Hidden by default) */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-8">
            <h3 className="text-2xl font-black text-slate-800 mb-6">New Chapter</h3>
            <form onSubmit={handleCreateFolder} className="space-y-6">
               <input name="name" required autoFocus type="text" placeholder="e.g. Chapter 1: Basic Principles" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 outline-none transition-colors" />
               <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">Create</button>
               <button type="button" onClick={() => setShowFolderModal(false)} className="w-full py-2 text-slate-400 font-bold text-sm">Cancel</button>
            </form>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden">
            <div className="p-8 bg-indigo-50 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-2xl font-black text-slate-800">Add Study Resource</h3>
              <button onClick={() => setShowUploadModal(false)} className="text-slate-400"><i className="fas fa-times"></i></button>
            </div>
            <form onSubmit={handleFileUpload} className="p-8 space-y-6">
               <div className="flex p-1 bg-slate-100 rounded-xl mb-4">
                  <button type="button" onClick={() => setUploadTab('file')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${uploadTab === 'file' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>FILE</button>
                  <button type="button" onClick={() => setUploadTab('link')} className={`flex-1 py-2 text-xs font-black rounded-lg transition-all ${uploadTab === 'link' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}>URL LINK</button>
               </div>
               <input name="title" required placeholder="Resource Title" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm" />
               {uploadTab === 'file' ? (
                 <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center cursor-pointer hover:bg-indigo-50 transition-all">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    <i className="fas fa-cloud-upload-alt text-3xl text-slate-300 mb-2"></i>
                    <p className="text-xs font-bold text-slate-400">{selectedFile ? selectedFile.name : 'Click to Upload'}</p>
                 </div>
               ) : (
                 <input type="url" required placeholder="Paste Drive or YouTube Link" value={pastedLink} onChange={(e) => setPastedLink(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm" />
               )}
               <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">Confirm</button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 p-8 text-center mt-auto">
        <p className="text-slate-400 font-bold text-[10px] tracking-[0.2em] uppercase">EduSphere AI • Empowering Every Student</p>
      </footer>
    </div>
  );
};

export default App;
