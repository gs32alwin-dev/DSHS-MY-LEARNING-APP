
import { Subject } from './types';

export const SUBJECTS: Subject[] = [
  { id: 'math', name: 'Maths', icon: 'fa-calculator', color: 'bg-indigo-600', description: 'Algebra, Geometry, and Statistics.' },
  { id: 'science', name: 'Science', icon: 'fa-flask', color: 'bg-emerald-600', description: 'Physics, Chemistry, and Biology.' },
  { id: 'english', name: 'English', icon: 'fa-book-open', color: 'bg-blue-600', description: 'Literature, Grammar, and Composition.' },
  { id: 'kannada', name: 'Kannada', icon: 'fa-language', color: 'bg-amber-600', description: 'Regional language and literature.' },
  { id: 'hindi', name: 'Hindi', icon: 'fa-pen-nib', color: 'bg-rose-600', description: 'National language and grammar.' },
  { id: 'social', name: 'Social Science', icon: 'fa-globe-americas', color: 'bg-orange-600', description: 'History, Geography, and Civics.' }
];

export const CONTENT_TABS = [
  { id: 'materials', label: 'My Materials', icon: 'fa-folder-open' },
  { id: 'video', label: 'AI Videos', icon: 'fa-play-circle' },
  { id: 'mindmap', label: 'Mind Map', icon: 'fa-project-diagram' },
  { id: 'audio', label: 'Audio Summary', icon: 'fa-volume-up' },
  { id: 'slides', label: 'Slides', icon: 'fa-desktop' },
  { id: 'notes', label: 'Notes', icon: 'fa-file-alt' },
];
