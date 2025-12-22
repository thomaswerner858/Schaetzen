
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
import { GameState, GamePhase, Player, Question, GameMode } from '../types';
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
  mode: GameMode.PREDEFINED,
  phase: GamePhase.LOBBY,
  players: [],
  currentQuestionIndex: 0,
  timeRemaining: ROUND_DURATION,
  questions: [],
  winnerId: null,
  activeQuestionerId: null,
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
      diff: null
    };

    try {
      await runTransaction(db, async (transaction) => {
        const sfDoc = await transaction.get(gameRef);
        if (!sfDoc.exists()) {
           transaction.set(gameRef, { ...initialState, players: [me] });
           return;
        }

        const currentPlayers = sfDoc.data().players as Player[];
        const playerIndex = currentPlayers.findIndex(p => p.id === me.id);

        if (playerIndex >= 0) {
           currentPlayers[playerIndex].name = playerName;
           transaction.update(gameRef, { players: currentPlayers });
        } else {
           transaction.update(gameRef, {
             players: arrayUnion(me)
           });
        }
      });
    } catch (e) {
      console.error("Error joining game:", e);
    }
  };

  const setGameMode = async (mode: GameMode) => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    await updateDoc(gameRef, { mode });
  };

  const startGame = async () => {
    if (!db) { alert("Firebase nicht konfiguriert!"); return; }
    
    const gameRef = doc(db, "games", ROOM_ID);
    const snap = await getDoc(gameRef);
    if(!snap.exists()) return;
    
    const data = snap.data() as GameState;

    // --- VALIDATION START ---
    if (data.mode === GameMode.CUSTOM && data.players.length < 3) {
        alert("Für den benutzerdefinierten Modus werden mindestens 3 Spieler benötigt!");
        return;
    }
    if (data.mode === GameMode.PREDEFINED && data.players.length < 2) {
        alert("Es werden mindestens 2 Spieler benötigt, um zu starten.");
        return;
    }
    // --- VALIDATION END ---
    
    const currentPlayers = data.players.map(p => ({
      ...p,
      score: 0,
      currentGuess: null,
      hasGuessed: false,
      diff: null
    }));

    if (data.mode === GameMode.PREDEFINED) {
      let questions = await fetchQuestions();
      questions = shuffleArray(questions);

      await updateDoc(gameRef, {
        phase: GamePhase.GUESSING,
        currentQuestionIndex: 0,
        timeRemaining: ROUND_DURATION,
        questions: questions,
        players: currentPlayers,
        winnerId: null,
        activeQuestionerId: null
      });
    } else {
      const hostId = currentPlayers[0].id;
      
      await updateDoc(gameRef, {
        phase: GamePhase.WRITING,
        currentQuestionIndex: 0,
        timeRemaining: ROUND_DURATION,
        questions: [],
        players: currentPlayers,
        winnerId: null,
        activeQuestionerId: hostId
      });
    }
  };

  const submitCustomQuestion = async (frage: string, antwort: number, einheit: string) => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);
    
    await runTransaction(db, async (transaction) => {
       const sfDoc = await transaction.get(gameRef);
       if (!sfDoc.exists()) return;
       
       const data = sfDoc.data() as GameState;
       
       const newQuestion: Question = {
         id: Date.now(),
         frage,
         antwort,
         einheit
       };

       const updatedQuestions = [...data.questions];
       if (updatedQuestions.length <= data.currentQuestionIndex) {
          updatedQuestions.push(newQuestion);
       } else {
          updatedQuestions[data.currentQuestionIndex] = newQuestion;
       }

       const updatedPlayers = data.players.map(p => ({
          ...p,
          currentGuess: null,
          hasGuessed: (data.mode === GameMode.CUSTOM && p.id === data.activeQuestionerId) ? true : false,
          diff: null
       }));

       transaction.update(gameRef, {
         questions: updatedQuestions,
         phase: GamePhase.GUESSING,
         timeRemaining: ROUND_DURATION,
         players: updatedPlayers
       });
    });
  };

  /**
   * Ends the current game session and shows the final leaderboard.
   * Anyone can trigger this.
   */
  const endGame = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);

    const snap = await getDoc(gameRef);
    if(!snap.exists()) return;

    const data = snap.data() as GameState;

    // Set phase to GAME_OVER to show final standings
    // We don't reset scores here, so the leaderboard is accurate.
    const cleanPlayers = data.players.map(p => ({
      ...p,
      currentGuess: null,
      hasGuessed: false,
      diff: null
    }));

    await updateDoc(gameRef, {
      phase: GamePhase.GAME_OVER,
      players: cleanPlayers,
      timeRemaining: 0,
      winnerId: null
    });
  };

  /**
   * Completely resets the game state and returns everyone to the lobby.
   */
  const backToLobby = async () => {
    if (!db) return;
    const gameRef = doc(db, "games", ROOM_ID);

    const snap = await getDoc(gameRef);
    if(!snap.exists()) return;

    const currentPlayers = (snap.data().players as Player[]).map(p => ({
      ...p,
      score: 0,
      currentGuess: null,
      hasGuessed: false,
      diff: null
    }));

    await updateDoc(gameRef, {
      phase: GamePhase.LOBBY,
      currentQuestionIndex: 0,
      timeRemaining: ROUND_DURATION,
      questions: [],
      winnerId: null,
      players: currentPlayers,
      activeQuestionerId: null
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
       
       const data = sfDoc.data() as GameState;
       const players = data.players;
       
       const updatedPlayers = players.map(p => {
         if (p.id === myPlayerId.current) {
           return { ...p, currentGuess: guess, hasGuessed: true };
         }
         return p;
       });

       const updateData: any = { players: updatedPlayers };

       const allGuessed = updatedPlayers.every(p => {
           if (data.mode === GameMode.CUSTOM && p.id === data.activeQuestionerId) {
               return true;
           }
           return p.hasGuessed;
       });
       
       if (allGuessed) {
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
        if (!currentQuestion) return;

        const correctAnswer = currentQuestion.antwort;

        let bestDiff = Number.MAX_VALUE;
        let winners: string[] = [];

        const playersToEvaluate = data.mode === GameMode.CUSTOM
            ? data.players.filter(p => p.id !== data.activeQuestionerId)
            : data.players;

        const evaluatedPlayers = playersToEvaluate.map(p => {
             const guess = p.currentGuess;
             if (guess === null) return { ...p, diff: Number.MAX_VALUE };
             return { ...p, diff: Math.abs(guess - correctAnswer) };
        });

        evaluatedPlayers.forEach(p => {
            if (p.diff < bestDiff) bestDiff = p.diff;
        });
        
        if (bestDiff !== Number.MAX_VALUE) {
            winners = evaluatedPlayers.filter(p => p.diff === bestDiff).map(p => p.id);
        }

        const scoredPlayers = data.players.map(p => {
             if (data.mode === GameMode.CUSTOM && p.id === data.activeQuestionerId) {
                 return { ...p, diff: null }; 
             }

             const evPlayer = evaluatedPlayers.find(ep => ep.id === p.id);
             if (evPlayer) {
                 const newScore = winners.includes(p.id) ? p.score + 10 : p.score;
                 return { ...p, score: newScore, diff: evPlayer.diff };
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

    if (data.mode === GameMode.PREDEFINED) {
        if (data.currentQuestionIndex >= data.questions.length - 1) {
            await updateDoc(gameRef, { phase: GamePhase.GAME_OVER });
        } else {
            const resetPlayers = data.players.map(p => ({ ...p, currentGuess: null, hasGuessed: false, diff: null }));
            await updateDoc(gameRef, {
                phase: GamePhase.GUESSING,
                currentQuestionIndex: data.currentQuestionIndex + 1,
                timeRemaining: ROUND_DURATION,
                winnerId: null,
                players: resetPlayers
            });
        }
    } else {
        const playersWhoPlayed = data.players.filter(p => p.id !== data.activeQuestionerId && p.currentGuess !== null);
        
        let nextQuestionerId = data.activeQuestionerId;
        
        if (playersWhoPlayed.length > 0) {
            playersWhoPlayed.sort((a, b) => (b.diff || 0) - (a.diff || 0));
            nextQuestionerId = playersWhoPlayed[0].id;
        } else {
             const otherPlayers = data.players.filter(p => p.id !== data.activeQuestionerId);
             if (otherPlayers.length > 0) nextQuestionerId = otherPlayers[0].id;
        }

        const resetPlayers = data.players.map(p => ({ ...p, currentGuess: null, hasGuessed: false, diff: null }));

        await updateDoc(gameRef, {
            phase: GamePhase.WRITING,
            currentQuestionIndex: data.currentQuestionIndex + 1,
            timeRemaining: ROUND_DURATION,
            winnerId: null,
            players: resetPlayers,
            activeQuestionerId: nextQuestionerId
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
    endGame,
    backToLobby,
    hardReset,
    submitGuess,
    nextRound,
    restartGame,
    setGameMode,
    submitCustomQuestion
  };
};
