
import React, { useState, useEffect, useRef } from 'react';
import { SUBJECTS, CONTENT_TABS, INITIAL_FOLDERS, INITIAL_MATERIALS } from './constants.tsx';
import { Subject, ContentType, MindMapNode, StudyNote, Slide, Material, Folder } from './types.ts';
import { geminiService } from './services/geminiService.ts';
import MindMapViewer from './components/MindMapViewer.tsx';
import AudioPlayer from './components/AudioPlayer.tsx';
import SlideViewer from './components/SlideViewer.tsx';

const App: React.FC = () => {
  // --- ROLE & PREVIEW MANAGEMENT ---
  const [isAdmin, setIsAdmin] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('role') === 'admin') return true;
    return localStorage.getItem('edusphere_role') === 'admin';
  });

  const [isPreviewMode, setIsPreviewMode] = useState(false); // Admin can toggle this to see student view
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [adminPasscode, setAdminPasscode] = useState('');
  const [loginError, setLoginError] = useState(false);

  // App UI State
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
  const [activeTab, setActiveTab] = useState<ContentType>('materials');
  const [searchQuery, setSearchQuery] = useState('');
  const [topic, setTopic] = useState('');
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedLink, setPastedLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Sync state to LocalStorage
  useEffect(() => {
    localStorage.setItem('edusphere_folders_v4', JSON.stringify(folders));
    localStorage.setItem('edusphere_materials_v4', JSON.stringify(materials));
    localStorage.setItem('edusphere_is_modified', isModified.toString());
  }, [materials, folders, isModified]);

  // Handle Admin Login Logic
  const handleAdminAuth = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (adminPasscode === "admin123") {
      setIsAdmin(true);
      localStorage.setItem('edusphere_role', 'admin');
      setShowAdminLogin(false);
      setAdminPasscode('');
      setLoginError(false);
    } else {
      setLoginError(true);
      setAdminPasscode('');
      setTimeout(() => setLoginError(false), 1500);
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setIsPreviewMode(false);
    localStorage.removeItem('edusphere_role');
    window.history.replaceState({}, '', window.location.pathname);
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

  const deleteMaterial = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAdmin || isPreviewMode) return;
    if (confirm("Delete this resource locally?")) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      setIsModified(true);
      if (selectedMaterial?.id === id) setSelectedMaterial(null);
    }
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (!isAdmin || isPreviewMode) return;
    if (confirm("Delete this chapter? Files inside will be detached.")) {
      setFolders(prev => prev.filter(f => f.id !== id));
      setMaterials(prev => prev.map(m => m.folderId === id ? { ...m, folderId: undefined } : m));
      setIsModified(true);
      if (selectedFolder?.id === id) setSelectedFolder(null);
    }
  };

  const resetToOriginal = () => {
    if (confirm("Discard ALL browser edits and revert to the original site code?")) {
      setIsModified(false);
      localStorage.removeItem('edusphere_folders_v4');
      localStorage.removeItem('edusphere_materials_v4');
      localStorage.removeItem('edusphere_is_modified');
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
    return `/**\n * COPY AND PASTE THIS INTO constants.tsx\n */\n\nexport const INITIAL_FOLDERS: Folder[] = ${JSON.stringify(folders, null, 2)};\n\nexport const INITIAL_MATERIALS: Material[] = ${JSON.stringify(materials, null, 2)};`;
  };

  const isRealAdmin = isAdmin && !isPreviewMode;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Draft Notification Header - ADMIN ONLY */}
      {isAdmin && (
        <div className={`${isPreviewMode ? 'bg-indigo-600' : 'bg-rose-600'} text-white px-6 py-3 flex items-center justify-between text-[10px] font-black uppercase tracking-[0.2em] shadow-lg z-[100] transition-colors duration-500`}>
          <div className="flex items-center">
            <span className="bg-white text-indigo-950 px-2 py-0.5 rounded mr-3">
              {isPreviewMode ? 'STUDENT PREVIEW' : 'CREATOR MODE'}
            </span>
            {isPreviewMode 
              ? 'Showing exactly what students see' 
              : isModified ? 'You have unpublished changes' : 'Library is in sync with code'}
          </div>
          <div className="flex items-center space-x-6">
             <div className="flex items-center space-x-2">
                <span className="opacity-70">Preview Mode</span>
                <button 
                  onClick={() => setIsPreviewMode(!isPreviewMode)}
                  className={`w-12 h-6 rounded-full relative transition-all ${isPreviewMode ? 'bg-emerald-400' : 'bg-white/20'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isPreviewMode ? 'left-7' : 'left-1'}`}></div>
                </button>
             </div>
             {!isPreviewMode && (
                <button onClick={() => setShowSettingsModal(true)} className="bg-white/20 hover:bg-white/30 px-3 py-1 rounded-lg transition-colors">
                  <i className="fas fa-rocket mr-2"></i> Deploy
                </button>
             )}
          </div>
        </div>
      )}

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 px-6 py-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => { setSelectedSubject(null); setSelectedFolder(null); }}>
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-200">
            <i className="fas fa-graduation-cap text-xl"></i>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-slate-800">EduSphere <span className="text-indigo-600">AI</span></h1>
        </div>
        
        <div className="hidden lg:flex items-center bg-slate-100 rounded-full px-4 py-2 w-80 border border-slate-200">
          <i className="fas fa-search text-slate-400 mr-2"></i>
          <input 
            type="text" 
            placeholder="Search resources..." 
            className="bg-transparent border-none outline-none w-full text-sm font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-4">
          {isRealAdmin && (
            <>
              <button onClick={() => setShowSettingsModal(true)} className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all shadow-sm ${isModified ? 'bg-amber-500 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'}`}>
                <i className={`fas ${isModified ? 'fa-sync-alt' : 'fa-cog'}`}></i>
              </button>
              {selectedSubject && (
                <button onClick={() => setShowFolderModal(true)} className="hidden sm:flex items-center bg-white border border-slate-200 text-slate-700 px-5 py-2.5 rounded-xl text-sm font-black shadow-sm">
                  <i className="fas fa-folder-plus mr-2 text-indigo-500"></i> Chapter
                </button>
              )}
              <button onClick={() => setShowUploadModal(true)} className="hidden sm:flex items-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-black shadow-lg shadow-indigo-200">
                <i className="fas fa-plus mr-2"></i> Upload
              </button>
            </>
          )}
          {(!isAdmin || isPreviewMode) && (
            <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4 py-2 bg-indigo-50 rounded-lg border border-indigo-100">
              Student Portal
            </div>
          )}
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {!selectedSubject ? (
          <div>
            <div className="mb-12 text-center max-w-2xl mx-auto py-12">
               <div className="inline-block px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-6 border border-indigo-100">Official Resource Portal</div>
              <h2 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">Learning Library</h2>
              <p className="text-slate-500 text-xl leading-relaxed">Choose your subject to access pre-loaded chapters and AI study tools.</p>
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
                    <div className={`absolute top-0 right-0 p-3 px-5 ${subject.color} rounded-bl-3xl text-white font-black text-[10px] uppercase`}>
                      {count} Resources
                    </div>
                    <div className={`w-16 h-16 ${subject.color} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg`}>
                      {subject.icon.startsWith('fa-') ? <i className={`fas ${subject.icon} text-3xl`}></i> : <span className="text-3xl font-bold">{subject.icon}</span>}
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{subject.name}</h3>
                    <p className="text-slate-500 text-sm mb-6 leading-relaxed">{subject.description}</p>
                    <div className="flex items-center text-indigo-600 font-black text-sm uppercase tracking-wider">
                      Open Lessons <i className="fas fa-arrow-right ml-2 text-xs"></i>
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
                    <p className="text-indigo-950 font-black text-2xl">Crafting your lesson on "{topic}"...</p>
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
                                  Exit
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
                                 <h4 className="text-2xl font-black">Preview Not Available</h4>
                              </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-16">
                        {/* Chapters */}
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
                                    <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{folder.createdAt}</p>
                                    {isRealAdmin && (
                                      <button 
                                        onClick={(e) => deleteFolder(folder.id, e)} 
                                        className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all hover:bg-rose-600 hover:text-white z-30 shadow-md border border-rose-100"
                                      >
                                        <i className="fas fa-trash-alt text-sm"></i>
                                      </button>
                                    )}
                                 </div>
                               ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Resources */}
                        <div>
                          <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em] mb-8">{selectedFolder ? `Files in ${selectedFolder.name}` : 'Lessons & Files'}</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {currentLevelMaterials.map(mat => (
                              <div key={mat.id} onClick={() => setSelectedMaterial(mat)} className="bg-white p-7 rounded-[2rem] border-2 border-slate-50 hover:border-indigo-200 hover:shadow-2xl transition-all group cursor-pointer relative shadow-sm">
                                <div className="flex items-start justify-between mb-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${mat.type === 'pdf' ? 'bg-red-500' : mat.type === 'video' ? 'bg-blue-500' : mat.type === 'image' ? 'bg-pink-500' : mat.type === 'link' ? 'bg-emerald-500' : 'bg-slate-500'}`}>
                                    <i className={`fas ${mat.type === 'pdf' ? 'fa-file-pdf' : mat.type === 'video' ? 'fa-play-circle' : mat.type === 'image' ? 'fa-image' : mat.type === 'link' ? 'fa-link' : 'fa-file-alt'} text-xl`}></i>
                                  </div>
                                  {isRealAdmin && (
                                    <button 
                                      onClick={(e) => deleteMaterial(mat.id, e)} 
                                      className="w-10 h-10 flex items-center justify-center bg-rose-50 text-rose-500 rounded-full opacity-0 group-hover:opacity-100 transition-all z-30 shadow-md hover:bg-rose-600 hover:text-white border border-rose-100"
                                    >
                                      <i className="fas fa-trash-alt text-sm"></i>
                                    </button>
                                  )}
                                </div>
                                <h4 className="font-black text-slate-800 text-lg mb-2 line-clamp-1">{mat.title}</h4>
                                <div className="flex items-center justify-between">
                                   <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{mat.type}</span>
                                   {mat.url?.startsWith('blob:') && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">Local Only</span>}
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
                      <div className="w-full aspect-video rounded-[3rem] overflow-hidden shadow-2xl bg-black border-8 border-slate-100">
                        <video src={videoUrl} controls className="w-full h-full" autoPlay />
                      </div>
                    ) : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">Select a resource and click "AI Deep Dive" to generate a video.</div>}
                  </div>
                )}
                {!loading && activeTab === 'mindmap' && (mindMapData ? <MindMapViewer data={mindMapData} /> : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Mind Map generated.</div>)}
                {!loading && activeTab === 'audio' && (<AudioPlayer audioData={audioData} />)}
                {!loading && activeTab === 'slides' && (slides.length > 0 ? <SlideViewer slides={slides} /> : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Slides available.</div>)}
                {!loading && activeTab === 'notes' && (notes ? (
                  <div className="prose prose-slate max-w-4xl mx-auto bg-white p-14 rounded-[3rem] border border-slate-100 shadow-2xl overflow-y-auto max-h-[750px] custom-scrollbar">
                    <h2 className="text-5xl font-black text-indigo-950 mb-10 border-b-4 border-indigo-50 pb-6">{notes.title}</h2>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700 text-xl">{notes.body}</div>
                  </div>
                ) : <div className="text-slate-400 font-black py-20 text-center uppercase tracking-widest">No Notes generated.</div>)}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* DEPLOYMENT CONSOLE */}
      {showSettingsModal && isRealAdmin && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-xl">
          <div className="bg-white w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 max-h-[90vh] flex flex-col">
            <div className="px-10 py-10 bg-indigo-600 text-white flex items-center justify-between">
               <div>
                  <h3 className="text-3xl font-black mb-2 flex items-center">
                    <i className="fas fa-terminal mr-4 opacity-50"></i> Deployment Console
                  </h3>
                  <p className="text-indigo-100 text-sm font-bold uppercase tracking-widest">Prepare your portal for public access</p>
               </div>
               <button onClick={() => setShowSettingsModal(false)} className="w-12 h-12 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/40 transition-colors">
                  <i className="fas fa-times text-xl"></i>
               </button>
            </div>
            
            <div className="p-10 flex-1 overflow-y-auto space-y-10 custom-scrollbar">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-emerald-50 p-8 rounded-[2.5rem] border-4 border-emerald-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-black text-emerald-950">1. Permanent Link</h4>
                      <i className="fas fa-share-alt text-emerald-400 text-xl"></i>
                    </div>
                    <p className="text-sm text-emerald-800 leading-relaxed mb-6 font-medium">
                      Share this link with students. Note: They only see what you have <strong>synced</strong> to the code.
                    </p>
                    <button 
                      onClick={() => {
                        const baseUrl = window.location.origin + window.location.pathname;
                        navigator.clipboard.writeText(baseUrl);
                        alert("Student Portal Link Copied!");
                      }}
                      className="w-full bg-emerald-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-emerald-700 transition-all flex items-center justify-center"
                    >
                      <i className="fas fa-link mr-3"></i> Copy Public Link
                    </button>
                  </div>

                  <div className="bg-indigo-50 p-8 rounded-[2.5rem] border-4 border-indigo-200">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xl font-black text-indigo-950">2. Sync to GitHub</h4>
                      <i className="fas fa-cloud-upload-alt text-indigo-400 text-xl"></i>
                    </div>
                    <p className="text-sm text-indigo-800 leading-relaxed mb-6 font-medium">
                      Copy the code below, paste it into <strong>constants.tsx</strong>, and push to GitHub to make your uploads public.
                    </p>
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(generateConstantsCode());
                        alert("Code Copied! Now paste it into constants.tsx and push to GitHub.");
                      }}
                      className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-black text-sm shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center"
                    >
                      <i className="fas fa-copy mr-3"></i> Copy Data Code
                    </button>
                  </div>
               </div>

               <div className="p-8 bg-slate-50 border-2 border-slate-100 rounded-[2rem]">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Deployment Checklist</h4>
                  <ul className="space-y-3 text-sm font-medium text-slate-600">
                    <li className="flex items-center"><i className="fas fa-check-circle text-emerald-500 mr-3"></i> Use Web Links for permanence (e.g. YouTube/Drive)</li>
                    <li className="flex items-center"><i className="fas fa-check-circle text-emerald-500 mr-3"></i> Replace arrays in constants.tsx with the copied code</li>
                    <li className="flex items-center"><i className="fas fa-check-circle text-emerald-500 mr-3"></i> Deploy to Netlify via GitHub Push</li>
                  </ul>
               </div>

               <div className="space-y-6">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-[0.4em]">Current JSON Data State</h4>
                  <pre className="bg-slate-950 text-indigo-400 p-8 rounded-[2.5rem] text-xs font-mono overflow-x-auto border-4 border-slate-800 shadow-2xl max-h-60 overflow-y-auto custom-scrollbar">
                    {generateConstantsCode()}
                  </pre>
               </div>

               <div className="pt-6 border-t border-slate-100 flex justify-between items-center">
                  <button onClick={resetToOriginal} className="text-rose-500 text-[10px] font-black uppercase tracking-widest hover:underline">Discard Local Edits</button>
                  <p className="text-slate-400 text-[9px] font-black uppercase">EduSphere v4.1 Sync Logic</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* ADMIN LOGIN */}
      {showAdminLogin && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in">
           <div className={`bg-white w-full max-w-sm rounded-[2.5rem] shadow-2xl p-10 transform transition-all duration-300 ${loginError ? 'translate-x-2 border-4 border-rose-500' : 'border-4 border-white'}`}>
              <div className="text-center mb-8">
                 <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <i className="fas fa-user-shield text-2xl"></i>
                 </div>
                 <h3 className="text-2xl font-black text-slate-900">Creator Access</h3>
                 <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-2">Enter Passcode</p>
              </div>
              <form onSubmit={handleAdminAuth} className="space-y-6">
                 <input 
                    type="password" 
                    placeholder="••••••••" 
                    autoFocus
                    className="w-full bg-slate-100 border-none rounded-2xl px-6 py-5 text-center text-2xl font-black tracking-widest focus:ring-4 focus:ring-indigo-500/20"
                    value={adminPasscode}
                    onChange={(e) => setAdminPasscode(e.target.value)}
                 />
                 <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">Unlock</button>
                 <button type="button" onClick={() => setShowAdminLogin(false)} className="w-full text-slate-400 font-black text-[10px] uppercase">Cancel</button>
              </form>
           </div>
        </div>
      )}

      {/* CONTENT MODALS */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl p-10">
            <h3 className="text-3xl font-black text-slate-900 mb-8">New Chapter</h3>
            <form onSubmit={handleCreateFolder} className="space-y-8">
               <input name="name" required autoFocus type="text" placeholder="Chapter Name" className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold outline-none" />
               <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl hover:bg-indigo-700">Create</button>
               <button type="button" onClick={() => setShowFolderModal(false)} className="w-full py-2 text-slate-400 font-black text-xs uppercase text-center">Cancel</button>
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
                 <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed border-slate-200 rounded-[2rem] p-10 text-center cursor-pointer hover:bg-indigo-50">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={(e) => setSelectedFile(e.target.files?.[0] || null)} />
                    <i className="fas fa-cloud-upload-alt text-5xl text-slate-300 mb-4"></i>
                    <p className="text-[10px] font-black text-slate-400 uppercase">{selectedFile ? selectedFile.name : 'Select PDF/Image/Video'}</p>
                    <p className="text-[8px] text-amber-600 font-bold mt-2 italic">* Use "Web Link" for permanent sharing</p>
                 </div>
               ) : (
                 <input type="url" required placeholder="Paste YouTube/Drive/Public Link" value={pastedLink} onChange={(e) => setPastedLink(e.target.value)} className="w-full bg-slate-50 border-4 border-slate-100 rounded-2xl px-6 py-5 text-sm font-bold" />
               )}
               <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-2xl font-black shadow-xl hover:bg-indigo-700 transition-all">Confirm Upload</button>
            </form>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 p-12 text-center mt-auto">
        <div className="flex flex-col items-center space-y-6">
          <p className="text-slate-400 font-black text-[10px] tracking-[0.4em] uppercase">EduSphere AI • Education Portal</p>
          <div className="flex items-center space-x-6">
            {!isAdmin ? (
              <button 
                onClick={() => setShowAdminLogin(true)} 
                className="group flex items-center space-x-3 bg-slate-50 hover:bg-indigo-600 px-6 py-3 rounded-2xl transition-all border border-slate-200 shadow-sm"
              >
                <i className="fas fa-lock text-slate-300 group-hover:text-white"></i>
                <span className="text-xs font-black text-slate-500 group-hover:text-white uppercase tracking-widest">Admin Entry</span>
              </button>
            ) : (
              <button onClick={handleLogout} className="text-xs font-black text-slate-400 hover:text-rose-600 uppercase tracking-widest underline underline-offset-4">Logout Creator Mode</button>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
