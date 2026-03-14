export interface ScrumCard {
  id: string;
}

export interface BoardColumn {
  key: string;
  translationKey: string;
  cards: ScrumCard[];
}

export const boardColumns: BoardColumn[] = [
  { 
    key: 'idea', 
    translationKey: 'roadmap.idea', 
    cards: [
      { id: 'SCRUM-21' }, 
      { id: 'SCRUM-22' }, 
      { id: 'SCRUM-23' }, 
      { id: 'SCRUM-24' }
    ] 
  },
  { 
    key: 'todo', 
    translationKey: 'roadmap.todo', 
    cards: [
      { id: 'SCRUM-17' }, 
      { id: 'SCRUM-18' }, 
      { id: 'SCRUM-19' }, 
      { id: 'SCRUM-20' }
    ] 
  },
  { 
    key: 'inProgress', 
    translationKey: 'roadmap.inProgress', 
    cards: [
      { id: 'SCRUM-9' }, 
      { id: 'SCRUM-10' }, 
      { id: 'SCRUM-14' }, 
      { id: 'SCRUM-15' }, 
      { id: 'SCRUM-16' }
    ] 
  },
  { 
    key: 'inReview', 
    translationKey: 'roadmap.inReview', 
    cards: [
      { id: 'SCRUM-5' }, 
      { id: 'SCRUM-6' }, 
      { id: 'SCRUM-7' }, 
      { id: 'SCRUM-8' }
    ] 
  },
  { 
    key: 'done', 
    translationKey: 'roadmap.done', 
    cards: [
      { id: 'SCRUM-1' }, 
      { id: 'SCRUM-2' }
    ] 
  },
];
