import { useEffect, useReducer, useRef } from 'react';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  onSnapshot, 
  setDoc, 
  updateDoc, 
  runTransaction,
  arrayUnion,
  getDoc
} from 'firebase/firestore';
import { GameState, GamePhase, Player, Question } from '../types';
import { fetchQuestions, ROUND_DURATION, FIREBASE_CONFIG } from '../constants';

// Initialize Firebase only if config is present and no app exists
let db: any;
try {
  if (FIREBASE_CONFIG.apiKey !== "DEIN_API_KEY") {
    const app = !getApps().length ? initializeApp(FIREBASE_CONFIG) : getApp();
    db = getFirestore(app);
  }
} catch (e) {
  console.error("Firebase init error:", e);
}

// Fixed Room ID for this demo to ensure all users land in the same lobby
const ROOM_ID = "schatzduell_main_room";

const initialState: GameState = {
  phase: GamePhase.LOBBY,
  players: [],
  currentQuestionIndex: 0,
  timeRemaining: ROUND_DURATION,
  questions: [],
  winnerId: null,
};

// Reducer now mainly handles local UI optimisations or purely local state if needed.
// Most state comes directly from Firestore via SYNC.
function gameReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case 'SYNC_STATE':
      return { ...action.payload };
    default:
      return state;
  }
}

export const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const myPlayerId = useRef<string>(localStorage.getItem('schatzduell_pid') || `player-${Math.random().toString(36).substr(2, 9)}`);
  
  // Persist ID to survive reloads
  useEffect(() => {
    localStorage.setItem('schatzduell_pid', myPlayerId.current);
  }, []);

  const isHost = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- FIREBASE SYNC & JOIN LOGIC ---
  useEffect(() => {
    if (!db) {
      console.warn("Firebase not configured. Check constants.ts");
      return;
    }

    const gameRef = doc(db, "games", ROOM_ID);

    // 1. Listen to real-time updates
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GameState;
        
        // Simple logic to determine if I am the host (e.g., first player in list)
        if (data.players.length > 0 && data.players[0].id === myPlayerId.current) {
          isHost.current = true;
        } else {
          isHost.current = false;
        }

        dispatch({ type: 'SYNC_STATE', payload: data });
      } else {
        // Create room if it doesn't exist
        setDoc(gameRef, initialState).catch(console.error);
      }
    });

    // 2. Auto-Join
    const joinGame = async () => {
      const me: Player = {
        id: myPlayerId.current,
        name: `Spieler ${myPlayerId.current.substr(-4)}`,
        score: 0,
        currentGuess: null,
        hasGuessed: false,
        isHost: false, 
      };

      try {
        await runTransaction(db, async (transaction) => {
          const sfDoc = await transaction.get(gameRef);
          if (!sfDoc.exists()) return;

          const currentPlayers = sfDoc.data().players as Player[];
          const playerExists = currentPlayers.find(p => p.id === me.id);

          if (!playerExists) {
             // Only join if in Lobby to avoid joining mid-game weirdness, 
             // but for robustness allow re-join if needed.
             transaction.update(gameRef, {
               players: arrayUnion(me)
             });
          }
        });
      } catch (e) {
        console.error("Error joining game:", e);
      }
    };

    joinGame();

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);


  // --- HOST TIMER LOGIC ---
  // The host is responsible for ticking the clock in Firestore
  useEffect(() => {
    if (!db) return;

    // Only the host runs the timer interval
    if (isHost.current && state.phase === GamePhase.GUESSING) {
      // Clear existing to avoid doubles
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(async () => {
        // We read latest state from ref/closure, but better to check local state
        // In a real production app, we would use ServerTimestamp + offset
        // For this demo, writing the tick every second is easier to understand.
        
        if (state.timeRemaining > 0) {
           await updateDoc(doc(db, "games", ROOM_ID), {
             timeRemaining: state.timeRemaining - 1
           });
        } else {
           if (timerRef.current) clearInterval(timerRef.current);
           evaluateRound();
        }
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.phase, state.timeRemaining, isHost.current]); // Add isHost.current dependency

  
  // --- ACTIONS ---

  const startGame = async () => {
    if (!db) { alert("Firebase nicht konfiguriert!"); return; }
    
    // Fetch questions from Airtable (or Mock)
    const questions = await fetchQuestions();

    const gameRef = doc(db, "games", ROOM_ID);
    
    // Reset scores for all existing players
    // We need to read current players first to map them cleanly
    const snap = await getDoc(gameRef);
    if(!snap.exists()) return;
    
    const currentPlayers = (snap.data().players as Player[]).map(p => ({
      ...p,
      score: 0,
      currentGuess: null,
      hasGuessed: false
    }));

    await updateDoc(gameRef, {
      phase: GamePhase.GUESSING,
      currentQuestionIndex: 0,
      timeRemaining: ROUND_DURATION,
      questions: questions,
      players: currentPlayers,
      winnerId: null
    });
  };

  const submitGuess = async (guess: number) => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    
    // Optimistic UI update could happen here, but we rely on Firestore sync
    
    // Update ONLY my player in the array. 
    // Firestore array update is tricky for specific items.
    // We read, modify, write.
    
    await runTransaction(db, async (transaction) => {
       const sfDoc = await transaction.get(gameRef);
       if (!sfDoc.exists()) return;
       
       const players = sfDoc.data().players as Player[];
       const updatedPlayers = players.map(p => {
         if (p.id === myPlayerId.current) {
           return { ...p, currentGuess: guess, hasGuessed: true };
         }
         return p;
       });

       transaction.update(gameRef, { players: updatedPlayers });
    });
  };

  const evaluateRound = async () => {
    // Only Host calculates results
    if (!db) return;
    
    const gameRef = doc(db, "games", ROOM_ID);
    
    await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(gameRef);
        if (!sfDoc.exists()) return;
        
        const data = sfDoc.data() as GameState;
        
        // Double check phase to prevent multi-trigger
        if (data.phase !== GamePhase.GUESSING) return;

        const currentQuestion = data.questions[data.currentQuestionIndex];
        const correctAnswer = currentQuestion.antwort;

        let bestDiff = Number.MAX_VALUE;
        let winners: string[] = [];

        // Logic matches original
        const playersWithDiff = data.players.map(p => {
             // Treat no guess as infinity diff
             const guess = p.currentGuess;
             if (guess === null) return { ...p, diff: Number.MAX_VALUE };
             return { ...p, diff: Math.abs(guess - correctAnswer) };
        });

        // Find min diff
        playersWithDiff.forEach(p => {
            if (p.diff < bestDiff) bestDiff = p.diff;
        });
        
        // Find winners
        if (bestDiff !== Number.MAX_VALUE) {
            winners = playersWithDiff.filter(p => p.diff === bestDiff).map(p => p.id);
        }

        const scoredPlayers = data.players.map(p => {
             if (winners.includes(p.id)) {
                 return { ...p, score: p.score + 10 };
             }
             return p;
        });

        transaction.update(gameRef, {
            players: scoredPlayers,
            phase: GamePhase.REVEAL,
            winnerId: winners.length === 1 ? winners[0] : (winners.length > 0 ? 'TIE' : null),
            timeRemaining: 0
        });
    });
  };

  const nextRound = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    
    const snap = await getDoc(gameRef);
    if (!snap.exists()) return;
    const data = snap.data() as GameState;

    if (data.currentQuestionIndex >= data.questions.length - 1) {
        await updateDoc(gameRef, { phase: GamePhase.GAME_OVER });
    } else {
        // Reset guesses for next round
        const resetPlayers = data.players.map(p => ({ ...p, currentGuess: null, hasGuessed: false }));
        
        await updateDoc(gameRef, {
            phase: GamePhase.GUESSING,
            currentQuestionIndex: data.currentQuestionIndex + 1,
            timeRemaining: ROUND_DURATION,
            winnerId: null,
            players: resetPlayers
        });
    }
  };

  const restartGame = async () => {
     // Re-uses startGame logic effectively
     await startGame();
  };

  return {
    state,
    myPlayerId: myPlayerId.current,
    startGame,
    submitGuess,
    nextRound,
    restartGame
  };
};