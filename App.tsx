
import React, { useState, useEffect, useRef } from 'react';
import { SUBJECTS, CONTENT_TABS } from './constants.tsx';
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
  const [uploadTab, setUploadTab] = useState<'file' | 'link'>('file');
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pastedLink, setPastedLink] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [folders, setFolders] = useState<Folder[]>(() => {
    const saved = localStorage.getItem('edusphere_folders');
    return saved ? JSON.parse(saved) : [];
  });

  const [materials, setMaterials] = useState<Material[]>(() => {
    const saved = localStorage.getItem('edusphere_materials');
    return saved ? JSON.parse(saved) : [];
  });

  // Persistence
  useEffect(() => {
    localStorage.setItem('edusphere_materials', JSON.stringify(materials));
    localStorage.setItem('edusphere_folders', JSON.stringify(folders));
  }, [materials, folders]);

  const filteredSubjects = SUBJECTS.filter(s => 
    s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadAIContent = async (subject: Subject, selectedTopic: string) => {
    setLoading(true);
    setTopic(selectedTopic);
    setSelectedMaterial(null);
    try {
      const [mm, nt, sl] = await Promise.all([
        geminiService.generateMindMap(subject.name, selectedTopic),
        geminiService.generateNotes(subject.name, selectedTopic),
        geminiService.generateSlides(subject.name, selectedTopic)
      ]);
      setMindMapData(mm);
      setNotes(nt);
      setSlides(sl);
      const audio = await geminiService.generateAudioSummary(nt.body);
      setAudioData(audio);
      
      if (selectedFolder) {
        const aiMaterial: Material = {
          id: Math.random().toString(36).substr(2, 9),
          subjectId: subject.id,
          folderId: selectedFolder.id,
          title: `AI Notes: ${selectedTopic}`,
          type: 'doc',
          date: new Date().toLocaleDateString(),
        };
        setMaterials(prev => [aiMaterial, ...prev]);
      }
    } catch (error) {
      console.error("Error loading content:", error);
    } finally {
      setLoading(false);
    }
  };

  // Content Generation State
  const [mindMapData, setMindMapData] = useState<MindMapNode | null>(null);
  const [notes, setNotes] = useState<StudyNote | null>(null);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [audioData, setAudioData] = useState<Uint8Array | null>(null);

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
      id: Math.random().toString(36).substr(2, 9),
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
      id: Math.random().toString(36).substr(2, 9),
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
    setMaterials(materials.filter(m => m.id !== id));
    if (selectedMaterial?.id === id) setSelectedMaterial(null);
  };

  const deleteFolder = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("Are you sure? This will not delete the files, but they will become uncategorized.")) {
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
        
        <div className="hidden md:flex items-center bg-slate-100 rounded-full px-4 py-2 w-96 border border-slate-200">
          <i className="fas fa-search text-slate-400 mr-2"></i>
          <input 
            type="text" 
            placeholder="Search files or folders..." 
            className="bg-transparent border-none outline-none w-full text-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex items-center space-x-4">
          {selectedSubject && (
            <button 
              onClick={() => setShowFolderModal(true)}
              className="hidden sm:flex items-center bg-white border border-slate-200 text-slate-600 px-4 py-2 rounded-lg text-sm font-bold shadow-sm hover:bg-slate-50 transition-all"
            >
              <i className="fas fa-folder-plus mr-2 text-indigo-500"></i> New Chapter
            </button>
          )}
          <button 
            onClick={() => setShowUploadModal(true)}
            className="hidden sm:flex items-center bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95"
          >
            <i className="fas fa-plus mr-2"></i> Add Content
          </button>
          <div className="w-9 h-9 bg-slate-200 rounded-full border border-slate-300 overflow-hidden cursor-pointer">
            <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=student" alt="Avatar" />
          </div>
        </div>
      </nav>

      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full">
        {!selectedSubject ? (
          <div>
            <div className="mb-10 text-center max-w-2xl mx-auto py-10">
              <h2 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">Welcome, Student!</h2>
              <p className="text-slate-500 text-xl leading-relaxed">Select your subject to access your chapters, videos, and AI tools.</p>
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
                      {count} Files
                    </div>
                    <div className={`w-16 h-16 ${subject.color} rounded-2xl flex items-center justify-center text-white mb-6 group-hover:rotate-6 transition-transform shadow-xl`}>
                      <i className={`fas ${subject.icon} text-3xl`}></i>
                    </div>
                    <h3 className="text-2xl font-bold mb-3">{subject.name}</h3>
                    <p className="text-slate-500 text-sm mb-6">{subject.description}</p>
                    <div className="flex items-center text-indigo-600 font-bold text-sm">
                      Open Library <i className="fas fa-arrow-right ml-2 text-xs"></i>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Subject Header & Breadcrumbs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 space-y-4 md:space-y-0">
              <div className="flex items-center space-x-6">
                <button 
                  onClick={() => {
                    if (selectedFolder) setSelectedFolder(null);
                    else setSelectedSubject(null);
                  }}
                  className="w-12 h-12 flex items-center justify-center bg-white border border-slate-200 rounded-2xl hover:bg-slate-50 transition-colors shadow-sm"
                >
                  <i className="fas fa-chevron-left text-slate-400"></i>
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2 text-slate-400 text-sm font-bold uppercase tracking-widest mb-1">
                    <span className="hover:text-indigo-600 cursor-pointer" onClick={() => setSelectedSubject(null)}>Subjects</span>
                    <i className="fas fa-chevron-right text-[10px]"></i>
                    <span className="hover:text-indigo-600 cursor-pointer" onClick={() => setSelectedFolder(null)}>{selectedSubject.name}</span>
                    {selectedFolder && (
                      <>
                        <i className="fas fa-chevron-right text-[10px]"></i>
                        <span className="text-slate-900">{selectedFolder.name}</span>
                      </>
                    )}
                  </div>
                  <h2 className="text-4xl font-extrabold text-slate-900 tracking-tight">
                    {selectedFolder ? selectedFolder.name : selectedSubject.name}
                  </h2>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-100">
                <input 
                  type="text" 
                  placeholder="Topic for AI help..." 
                  className="bg-transparent px-4 py-2 text-sm focus:outline-none w-48 font-medium"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      loadAIContent(selectedSubject, (e.target as HTMLInputElement).value);
                      (e.target as HTMLInputElement).value = '';
                    }
                  }}
                />
                <button 
                  onClick={() => {
                    const el = document.querySelector('input[placeholder="Topic for AI help..."]') as HTMLInputElement;
                    if (el.value) loadAIContent(selectedSubject, el.value);
                  }}
                  className="bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all active:scale-95"
                >
                  Ask AI
                </button>
              </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white rounded-[2rem] border border-slate-200 shadow-xl overflow-hidden flex flex-col flex-1">
              <div className="flex flex-wrap border-b border-slate-100 bg-slate-50/50 p-2">
                {CONTENT_TABS.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id as ContentType);
                      setSelectedMaterial(null);
                    }}
                    className={`flex items-center space-x-2 py-3 px-6 m-1 text-sm font-bold rounded-xl transition-all ${
                      activeTab === tab.id 
                      ? 'bg-white text-indigo-600 shadow-md ring-1 ring-slate-200' 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <i className={`fas ${tab.icon}`}></i>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              <div className="p-8 min-h-[550px] flex flex-col relative bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:24px_24px]">
                {loading && (
                  <div className="absolute inset-0 z-10 bg-white/95 backdrop-blur-md flex flex-col items-center justify-center">
                    <div className="relative">
                       <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
                    </div>
                    <p className="mt-6 text-indigo-900 font-extrabold text-lg">Gemini AI is generating your study pack...</p>
                  </div>
                )}

                {!loading && (activeTab === 'materials') && (
                  <div className="w-full h-full max-w-6xl mx-auto">
                    {selectedMaterial ? (
                      <div className="animate-in fade-in zoom-in-95 duration-300 h-full flex flex-col">
                         <div className="flex items-center justify-between mb-6">
                            <h3 className="text-2xl font-bold flex items-center">
                               <i className={`fas ${getMaterialIcon(selectedMaterial.type)} mr-3`}></i>
                               {selectedMaterial.title}
                            </h3>
                            <button onClick={() => setSelectedMaterial(null)} className="text-slate-500 hover:text-slate-800 font-bold text-sm bg-slate-100 px-4 py-2 rounded-xl transition-colors">
                               Close Viewer <i className="fas fa-times ml-2"></i>
                            </button>
                         </div>
                         
                         <div className="flex-1 w-full min-h-[500px] rounded-3xl overflow-hidden shadow-2xl bg-slate-900 border border-slate-700">
                            {selectedMaterial.url ? (
                              selectedMaterial.type === 'video' ? (
                                <video src={selectedMaterial.url} controls className="w-full h-full object-contain" />
                              ) : selectedMaterial.type === 'image' ? (
                                <div className="w-full h-full flex items-center justify-center p-4">
                                   <img src={selectedMaterial.url} className="max-w-full max-h-full object-contain rounded-xl" alt={selectedMaterial.title} />
                                </div>
                              ) : selectedMaterial.type === 'link' ? (
                                <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-center p-12">
                                   <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6 shadow-sm">
                                      <i className="fas fa-external-link-alt text-3xl"></i>
                                   </div>
                                   <h4 className="text-2xl font-black text-slate-800 mb-2">External Learning Resource</h4>
                                   <p className="text-slate-500 max-w-md mb-8">This resource is hosted externally. Click below to open it in a new window.</p>
                                   <a 
                                      href={selectedMaterial.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="bg-emerald-600 text-white px-10 py-4 rounded-2xl font-black shadow-xl shadow-emerald-100 hover:bg-emerald-700 transition-all hover:scale-105"
                                   >
                                      Visit Website <i className="fas fa-arrow-right ml-2"></i>
                                   </a>
                                </div>
                              ) : (
                                <iframe src={selectedMaterial.url} className="w-full h-full border-none bg-white" title={selectedMaterial.title} />
                              )
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center text-white p-12 text-center">
                                 <i className={`fas ${getMaterialIcon(selectedMaterial.type)} text-6xl mb-6 opacity-50`}></i>
                                 <h4 className="text-xl font-bold mb-2">No File Preview Available</h4>
                                 <p className="text-slate-400 max-w-sm">This material record was created without an actual file source.</p>
                              </div>
                            )}
                         </div>
                      </div>
                    ) : (
                      <div className="space-y-12">
                        {/* Folders Section */}
                        {!selectedFolder && (
                          <div>
                            <div className="flex items-center justify-between mb-6">
                               <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">Chapters & Folders</h3>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                               {currentSubjectFolders.length === 0 ? (
                                 <div 
                                  onClick={() => setShowFolderModal(true)}
                                  className="col-span-full border-2 border-dashed border-slate-200 rounded-3xl py-12 flex flex-col items-center justify-center text-slate-400 hover:bg-slate-50 hover:border-indigo-300 transition-all cursor-pointer group"
                                 >
                                    <i className="fas fa-folder-plus text-3xl mb-4 group-hover:scale-110 transition-transform"></i>
                                    <span className="font-bold">Create your first chapter folder</span>
                                 </div>
                               ) : (
                                 currentSubjectFolders.map(folder => (
                                   <div 
                                      key={folder.id} 
                                      onClick={() => setSelectedFolder(folder)}
                                      className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:shadow-xl transition-all cursor-pointer group relative"
                                   >
                                      <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-500 mb-4 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                                         <i className="fas fa-folder text-xl"></i>
                                      </div>
                                      <h4 className="font-bold text-slate-800 mb-1">{folder.name}</h4>
                                      <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{folder.createdAt}</p>
                                      <button 
                                        onClick={(e) => deleteFolder(folder.id, e)}
                                        className="absolute top-4 right-4 text-slate-300 hover:text-red-500 transition-colors"
                                      >
                                        <i className="fas fa-trash-alt text-xs"></i>
                                      </button>
                                   </div>
                                 ))
                               )}
                            </div>
                          </div>
                        )}

                        {/* Materials Section */}
                        <div>
                          <div className="flex items-center justify-between mb-6">
                             <h3 className="text-lg font-black text-slate-800 uppercase tracking-widest">
                               {selectedFolder ? `${selectedFolder.name} Materials` : 'Recent Files'}
                             </h3>
                             {selectedFolder && (
                               <button onClick={() => setSelectedFolder(null)} className="text-indigo-600 font-bold text-xs uppercase tracking-widest hover:underline">
                                 <i className="fas fa-arrow-left mr-1"></i> Back to chapters
                               </button>
                             )}
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in zoom-in-95 duration-300">
                            {currentLevelMaterials.length === 0 ? (
                              <div className="col-span-full py-20 text-center bg-slate-50/50 rounded-[2rem] border-2 border-dashed border-slate-200">
                                 <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 shadow-sm">
                                    <i className="fas fa-file-upload text-3xl"></i>
                                 </div>
                                 <h3 className="text-xl font-bold text-slate-800 mb-2">No materials here</h3>
                                 <p className="text-slate-500 mb-8 max-w-xs mx-auto">Upload documents, images, or paste links for this chapter.</p>
                                 <button 
                                   onClick={() => setShowUploadModal(true)}
                                   className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all"
                                 >
                                   Add to {selectedFolder ? selectedFolder.name : 'Subject'}
                                 </button>
                              </div>
                            ) : (
                              currentLevelMaterials.map(mat => (
                                <div 
                                  key={mat.id} 
                                  onClick={() => setSelectedMaterial(mat)}
                                  className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:shadow-xl transition-all group cursor-pointer"
                                >
                                  <div className="flex items-start justify-between mb-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${
                                      mat.type === 'pdf' ? 'bg-red-500' : 
                                      mat.type === 'video' ? 'bg-blue-500' :
                                      mat.type === 'image' ? 'bg-pink-500' :
                                      mat.type === 'link' ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}>
                                      <i className={`fas ${
                                        mat.type === 'pdf' ? 'fa-file-pdf' : 
                                        mat.type === 'video' ? 'fa-play-circle' :
                                        mat.type === 'image' ? 'fa-image' :
                                        mat.type === 'link' ? 'fa-link' : 'fa-file-alt'
                                      }`}></i>
                                    </div>
                                    <button 
                                      onClick={(e) => deleteMaterial(mat.id, e)}
                                      className="w-8 h-8 flex items-center justify-center text-slate-300 hover:text-red-500 transition-colors rounded-lg"
                                    >
                                      <i className="fas fa-trash-alt text-xs"></i>
                                    </button>
                                  </div>
                                  <h4 className="font-bold text-slate-800 mb-1 line-clamp-1">{mat.title}</h4>
                                  <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">{mat.date} • {mat.type.toUpperCase()}</p>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* AI TABS CONTENT */}
                {!loading && activeTab === 'video' && (
                  <div className="aspect-video w-full bg-slate-900 rounded-[2.5rem] overflow-hidden relative group shadow-2xl">
                    <img src={`https://picsum.photos/seed/${topic}/1280/720`} className="w-full h-full object-cover opacity-40 grayscale" alt="Video" />
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-12">
                       <button className="w-24 h-24 bg-white rounded-full flex items-center justify-center text-indigo-600 mb-8 shadow-2xl hover:scale-110 transition-transform group">
                          <i className="fas fa-play text-4xl ml-2"></i>
                       </button>
                       <h3 className="text-4xl font-black text-white mb-4 tracking-tight">Lecture: {topic}</h3>
                       <p className="text-indigo-100 text-lg font-medium max-w-lg">Master the fundamentals of {topic} in this breakdown.</p>
                    </div>
                  </div>
                )}

                {!loading && activeTab === 'mindmap' && mindMapData && (
                  <div className="w-full h-[600px] animate-in fade-in duration-500">
                    <MindMapViewer data={mindMapData} />
                  </div>
                )}

                {!loading && activeTab === 'audio' && (
                  <div className="py-12"><AudioPlayer audioData={audioData} /></div>
                )}

                {!loading && activeTab === 'slides' && slides.length > 0 && (
                  <div className="py-8"><SlideViewer slides={slides} /></div>
                )}

                {!loading && activeTab === 'notes' && notes && (
                  <div className="prose prose-slate max-w-4xl mx-auto bg-white p-12 rounded-[2rem] border border-slate-100 shadow-2xl overflow-y-auto max-h-[700px] custom-scrollbar animate-in slide-in-from-bottom-8">
                    <div className="flex items-center justify-between mb-10 border-b border-slate-100 pb-8">
                       <h2 className="text-4xl font-black text-indigo-950 m-0">{notes.title}</h2>
                    </div>
                    <div className="whitespace-pre-wrap leading-relaxed text-slate-700 text-lg">
                      {notes.body}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* New Folder Modal */}
      {showFolderModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-8 border-b border-slate-100 flex items-center justify-between bg-indigo-50/30">
               <h3 className="text-2xl font-black text-slate-800">New Chapter Folder</h3>
               <button onClick={() => setShowFolderModal(false)} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                  <i className="fas fa-times"></i>
               </button>
            </div>
            <form onSubmit={handleCreateFolder} className="p-8 space-y-6">
               <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Folder Name</label>
                  <input name="name" required autoFocus type="text" placeholder="e.g. Chapter 1: Introduction" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none transition-colors" />
               </div>
               <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-[1.5rem] font-black shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-[0.98]">
                  Create Folder
               </button>
            </form>
          </div>
        </div>
      )}

      {/* Upload/Add Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
            <div className="px-8 py-8 border-b border-slate-100 bg-indigo-50/30">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-2xl font-black text-slate-800">Add Content</h3>
                  <button onClick={() => { setShowUploadModal(false); setSelectedFile(null); setPastedLink(''); }} className="w-10 h-10 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-600 shadow-sm">
                    <i className="fas fa-times"></i>
                  </button>
               </div>
               <div className="flex p-1 bg-white rounded-2xl shadow-sm border border-slate-100">
                  <button 
                    onClick={() => setUploadTab('file')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${uploadTab === 'file' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-file-upload mr-2"></i> File
                  </button>
                  <button 
                    onClick={() => setUploadTab('link')}
                    className={`flex-1 py-3 text-xs font-black uppercase tracking-widest rounded-xl transition-all ${uploadTab === 'link' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-link mr-2"></i> Link
                  </button>
               </div>
            </div>
            <form onSubmit={handleFileUpload} className="p-8 space-y-6">
               <input 
                 type="file" 
                 className="hidden" 
                 ref={fileInputRef} 
                 accept="image/*,video/*,application/pdf"
                 onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
               />
               
               <div>
                  <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Display Title</label>
                  <input name="title" required type="text" placeholder={selectedFile ? selectedFile.name : uploadTab === 'link' ? "e.g. YouTube Lecture" : "e.g. Chapter Summary"} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none transition-colors" />
               </div>

               {uploadTab === 'file' ? (
                 <>
                   <div>
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Category</label>
                      <select name="type" className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-5 py-4 text-sm focus:border-indigo-500 focus:ring-0 outline-none transition-colors">
                         <option value="pdf">PDF Document</option>
                         <option value="video">Video Lecture</option>
                         <option value="image">Image / Photo</option>
                         <option value="doc">Study Sheet</option>
                      </select>
                   </div>
                   
                   <div 
                     onClick={() => fileInputRef.current?.click()}
                     className={`border-2 border-dashed rounded-3xl p-10 text-center transition-all cursor-pointer group ${selectedFile ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:bg-indigo-50/50'}`}
                   >
                      <div className={`w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-sm group-hover:scale-110 transition-transform ${selectedFile ? 'text-indigo-600' : 'text-slate-400'}`}>
                        <i className={`fas ${selectedFile ? 'fa-check-circle' : 'fa-cloud-upload-alt'} text-2xl`}></i>
                      </div>
                      <p className="text-sm font-bold text-slate-600 line-clamp-1">
                        {selectedFile ? selectedFile.name : 'Select PDF, Image, or Video'}
                      </p>
                   </div>
                 </>
               ) : (
                 <div>
                    <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-2">Paste URL</label>
                    <div className="relative">
                       <i className="fas fa-link absolute left-5 top-5 text-slate-400"></i>
                       <input 
                         type="url" 
                         required 
                         placeholder="https://..." 
                         value={pastedLink}
                         onChange={(e) => setPastedLink(e.target.value)}
                         className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-12 pr-5 py-4 text-sm focus:border-emerald-500 focus:ring-0 outline-none transition-colors" 
                       />
                    </div>
                    <p className="mt-3 text-[10px] text-slate-400 leading-relaxed">
                       Paste links from YouTube, Wikipedia, or other educational sources to save them here.
                    </p>
                 </div>
               )}

               <button 
                 type="submit" 
                 disabled={uploadTab === 'file' ? !selectedFile : !pastedLink}
                 className={`w-full py-5 rounded-[1.5rem] font-black shadow-xl transition-all active:scale-[0.98] ${
                   (uploadTab === 'file' ? selectedFile : pastedLink) 
                   ? (uploadTab === 'file' ? 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-100' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-100') + ' text-white'
                   : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                 }`}
               >
                  {uploadTab === 'file' ? 'Save File' : 'Save Link'}
               </button>
            </form>
          </div>
        </div>
      )}

      <footer className="bg-white border-t border-slate-200 p-8 text-center mt-auto">
        <p className="text-slate-400 font-bold text-sm tracking-wide uppercase">EDUSPHERE AI • EMPOWERING EDUCATION</p>
      </footer>
    </div>
  );
};

export default App;
