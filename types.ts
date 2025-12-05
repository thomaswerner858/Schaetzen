export interface Question {
  id: number;
  frage: string;
  antwort: number;
  einheit: string;
}

export interface Player {
  id: string;
  name: string;
  score: number;
  currentGuess: number | null;
  hasGuessed: boolean;
  isHost: boolean; // For this simulation, we'll designate one tab as host for timer logic
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  GUESSING = 'GUESSING',
  REVEAL = 'REVEAL',
  GAME_OVER = 'GAME_OVER'
}

export interface GameState {
  phase: GamePhase;
  players: Player[];
  currentQuestionIndex: number;
  timeRemaining: number;
  questions: Question[];
  winnerId: string | null; // Winner of the round
}

// Events for the BroadcastChannel simulation
export type GameEvent = 
  | { type: 'JOIN'; payload: Player }
  | { type: 'SYNC_STATE'; payload: GameState }
  | { type: 'START_GAME' }
  | { type: 'SUBMIT_GUESS'; payload: { playerId: string; guess: number } }
  | { type: 'TIME_TICK'; payload: number }
  | { type: 'PHASE_CHANGE'; payload: { phase: GamePhase; winnerId?: string | null } }
  | { type: 'NEXT_ROUND' }
  | { type: 'RESTART' };
