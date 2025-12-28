
export type ContentType = 'video' | 'mindmap' | 'audio' | 'slides' | 'notes' | 'materials';

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  description: string;
}

export interface Folder {
  id: string;
  subjectId: string;
  name: string;
  createdAt: string;
}

export interface Material {
  id: string;
  subjectId: string;
  folderId?: string;
  title: string;
  type: 'pdf' | 'video' | 'doc' | 'image' | 'link';
  date: string;
  url?: string;
}

export interface MindMapNode {
  name: string;
  children?: MindMapNode[];
}

export interface Slide {
  title: string;
  content: string[];
}

export interface StudyNote {
  title: string;
  body: string;
}

export interface ChatMessage {
  role: 'user' | 'model';
  parts: { text: string }[];
}
