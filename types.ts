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
  isHost: boolean;
  diff?: number; // Optional property to track difference in results
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  WRITING = 'WRITING', // New phase for custom mode
  GUESSING = 'GUESSING',
  REVEAL = 'REVEAL',
  GAME_OVER = 'GAME_OVER'
}

export enum GameMode {
  PREDEFINED = 'PREDEFINED',
  CUSTOM = 'CUSTOM'
}

export interface GameState {
  mode: GameMode; // Track selected game mode
  phase: GamePhase;
  players: Player[];
  currentQuestionIndex: number;
  timeRemaining: number;
  questions: Question[];
  winnerId: string | null;
  activeQuestionerId: string | null; // ID of the player currently asking the question (Custom Mode)
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