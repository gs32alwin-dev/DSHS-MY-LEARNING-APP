
import { Subject, Folder, Material } from './types';

export const SUBJECTS: Subject[] = [
  { id: 'english', name: 'English - 1st Language', icon: 'fa-book-open', color: 'bg-blue-600', description: 'Literature, Grammar, and Composition.' },
  { id: 'kannada', name: 'Kannada - 2nd Language', icon: 'ಕ', color: 'bg-amber-600', description: 'Regional language and literature.' },
  { id: 'hindi', name: 'Hindi - 3rd Language', icon: 'अ', color: 'bg-rose-600', description: 'National language and grammar.' },
  { id: 'math', name: 'Mathematics', icon: 'fa-calculator', color: 'bg-indigo-600', description: 'Algebra, Geometry, and Statistics.' },
  { id: 'science', name: 'Science', icon: 'fa-flask', color: 'bg-emerald-600', description: 'Physics, Chemistry, and Biology.' },
  { id: 'social', name: 'Social Studies', icon: 'fa-globe-americas', color: 'bg-orange-600', description: 'History, Geography, and Civics.' },
  { id: 'exam-tips', name: 'Exam Tips and Tricks', icon: 'fa-lightbulb', color: 'bg-purple-600', description: 'Strategies and methods to excel in your examinations.' },
  { id: 'others', name: 'Others', icon: 'fa-ellipsis-h', color: 'bg-slate-600', description: 'Miscellaneous resources and community uploads.' }
];

export const CONTENT_TABS = [
  { id: 'materials', label: 'Study Library', icon: 'fa-folder-open' },
  { id: 'video', label: 'AI Videos', icon: 'fa-play-circle' },
  { id: 'mindmap', label: 'Mind Map', icon: 'fa-project-diagram' },
  { id: 'audio', label: 'Audio Summary', icon: 'fa-volume-up' },
  { id: 'slides', label: 'Slides', icon: 'fa-desktop' },
  { id: 'notes', label: 'Notes', icon: 'fa-file-alt' },
];

/**
 * =========================================================================
 * PERMANENT CONTENT STORAGE (SEED DATA)
 * =========================================================================
 */

export const INITIAL_FOLDERS: Folder[] = [
  {
    id: "seed-folder-1",
    subjectId: "math",
    name: "Chapter 1: Number Systems",
    createdAt: "2024-05-20"
  },
  {
    id: "seed-folder-2",
    subjectId: "science",
    name: "Unit 1: Chemical Reactions",
    createdAt: "2024-05-20"
  }
];

export const INITIAL_MATERIALS: Material[] = [
  {
    id: "seed-mat-1",
    subjectId: "math",
    folderId: "seed-folder-1",
    title: "Introduction to Rational Numbers (Video)",
    type: "video",
    url: "https://www.w3schools.com/html/mov_bbb.mp4",
    date: "2024-05-20"
  },
  {
    id: "seed-mat-2",
    subjectId: "math",
    folderId: "seed-folder-1",
    title: "Number System Flowchart",
    type: "image",
    url: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=1000",
    date: "2024-05-20"
  },
  {
    id: "seed-mat-3",
    subjectId: "science",
    folderId: "seed-folder-2",
    title: "Class Notes - Balancing Equations",
    type: "link",
    url: "https://en.wikipedia.org/wiki/Chemical_reaction",
    date: "2024-05-20"
  }
];
