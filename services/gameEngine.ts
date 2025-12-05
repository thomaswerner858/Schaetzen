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

function gameReducer(state: GameState, action: any): GameState {
  switch (action.type) {
    case 'SYNC_STATE':
      return { ...action.payload };
    default:
      return state;
  }
}

// Fisher-Yates Shuffle Algorithm
const shuffleArray = (array: any[]) => {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
};

export const useGameEngine = () => {
  const [state, dispatch] = useReducer(gameReducer, initialState);
  const myPlayerId = useRef<string>(localStorage.getItem('schatzduell_pid') || `player-${Math.random().toString(36).substr(2, 9)}`);
  
  // Persist ID to survive reloads
  useEffect(() => {
    localStorage.setItem('schatzduell_pid', myPlayerId.current);
  }, []);

  const isHost = useRef<boolean>(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  
  // Keep a ref to the latest state so intervals can read it without adding state to dependencies
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // --- FIREBASE SYNC LOGIC (Passive) ---
  useEffect(() => {
    if (!db) {
      console.warn("Firebase not configured. Check constants.ts");
      return;
    }

    const gameRef = doc(db, "games", ROOM_ID);

    // Listen to real-time updates
    const unsubscribe = onSnapshot(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as GameState;
        
        // Simple logic to determine if I am the host (first player in list)
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

    return () => {
      unsubscribe();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);


  // --- HOST TIMER LOGIC ---
  useEffect(() => {
    if (!db) return;

    if (isHost.current && state.phase === GamePhase.GUESSING) {
      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(async () => {
        const currentRef = stateRef.current; 
        
        if (currentRef.phase !== GamePhase.GUESSING) {
            if (timerRef.current) clearInterval(timerRef.current);
            return;
        }

        // If time is remaining, count down
        if (currentRef.timeRemaining > 0) {
           await updateDoc(doc(db, "games", ROOM_ID), {
             timeRemaining: currentRef.timeRemaining - 1
           });
        } else {
           // Time is up (or was set to 0 by submitGuess), evaluate round
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
  }, [state.phase]); 


  // --- ACTIONS ---

  // Manuell beitreten statt Auto-Join
  const joinGame = async (playerName: string) => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);

    const me: Player = {
      id: myPlayerId.current,
      name: playerName,
      score: 0,
      currentGuess: null,
      hasGuessed: false,
      isHost: false, 
    };

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(gameRef);
        if (!sfDoc.exists()) {
           // Should ideally not happen as listener creates it, but fallback:
           transaction.set(gameRef, { ...initialState, players: [me] });
           return;
        }

        const currentPlayers = sfDoc.data().players as Player[];
        const playerIndex = currentPlayers.findIndex(p => p.id === me.id);

        if (playerIndex >= 0) {
           // Player exists, just update name if needed
           currentPlayers[playerIndex].name = playerName;
           transaction.update(gameRef, { players: currentPlayers });
        } else {
           // New player
           transaction.update(gameRef, {
             players: arrayUnion(me)
           });
        }
      });
    } catch (e) {
      console.error("Error joining game:", e);
    }
  };

  const startGame = async () => {
    if (!db) { alert("Firebase nicht konfiguriert!"); return; }
    
    let questions = await fetchQuestions();
    
    // Shuffle questions so the order is random each game
    questions = shuffleArray(questions);

    const gameRef = doc(db, "games", ROOM_ID);
    
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

  const cancelGame = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);

    const snap = await getDoc(gameRef);
    if(!snap.exists()) return;

    const currentPlayers = (snap.data().players as Player[]).map(p => ({
      ...p,
      score: 0,
      currentGuess: null,
      hasGuessed: false
    }));

    await updateDoc(gameRef, {
      phase: GamePhase.LOBBY,
      currentQuestionIndex: 0,
      timeRemaining: ROUND_DURATION,
      questions: [],
      winnerId: null,
      players: currentPlayers
    });
  };

  const hardReset = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    if (window.confirm("Bist du sicher? Dies wirft ALLE Spieler raus und setzt alles zurück.")) {
        await setDoc(gameRef, initialState);
        window.location.reload();
    }
  };

  const submitGuess = async (guess: number) => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    
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

       const updateData: any = { players: updatedPlayers };

       // Check if ALL players have guessed
       const allGuessed = updatedPlayers.every(p => p.hasGuessed);
       if (allGuessed) {
         // Force timer to 0, which triggers the Host to evaluate the round immediately
         updateData.timeRemaining = 0;
       }

       transaction.update(gameRef, updateData);
    });
  };

  const evaluateRound = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    
    await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(gameRef);
        if (!sfDoc.exists()) return;
        
        const data = sfDoc.data() as GameState;
        if (data.phase !== GamePhase.GUESSING) return;

        const currentQuestion = data.questions[data.currentQuestionIndex];
        const correctAnswer = currentQuestion.antwort;

        let bestDiff = Number.MAX_VALUE;
        let winners: string[] = [];

        const playersWithDiff = data.players.map(p => {
             const guess = p.currentGuess;
             if (guess === null) return { ...p, diff: Number.MAX_VALUE };
             return { ...p, diff: Math.abs(guess - correctAnswer) };
        });

        playersWithDiff.forEach(p => {
            if (p.diff < bestDiff) bestDiff = p.diff;
        });
        
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
     await startGame();
  };

  return {
    state,
    myPlayerId: myPlayerId.current,
    joinGame,
    startGame,
    cancelGame,
    hardReset,
    submitGuess,
    nextRound,
    restartGame
  };
};