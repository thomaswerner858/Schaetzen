import React, { useState, useEffect } from 'react';
import { useGameEngine } from './services/gameEngine';
import { GamePhase, GameMode } from './types';
import { Trophy, Clock, Users, ArrowRight, Play, RefreshCw, AlertCircle, XCircle, LogIn, Trash2, PenTool, CheckCircle, BrainCircuit, Globe } from 'lucide-react';

const GameScreen = () => {
  const { state, myPlayerId, joinGame, startGame, cancelGame, hardReset, submitGuess, nextRound, restartGame, setGameMode, submitCustomQuestion } = useGameEngine();
  const [localGuess, setLocalGuess] = useState<string>('');
  const [playerName, setPlayerName] = useState('');
  const [hasJoined, setHasJoined] = useState(false);
  
  // Custom Question Form State
  const [customQ, setCustomQ] = useState('');
  const [customA, setCustomA] = useState('');
  const [customU, setCustomU] = useState('');

  const currentQuestion = state.questions[state.currentQuestionIndex];
  const me = state.players.find(p => p.id === myPlayerId);
  const isHost = state.players.length > 0 && state.players[0].id === myPlayerId;
  const isActiveQuestioner = state.mode === GameMode.CUSTOM && state.activeQuestionerId === myPlayerId;

  // Check if player is already in the game (e.g. after refresh)
  useEffect(() => {
    if (state.players.some(p => p.id === myPlayerId)) {
      setHasJoined(true);
    }
  }, [state.players, myPlayerId]);

  // Reset local guess when question changes
  useEffect(() => {
    setLocalGuess('');
    setCustomQ('');
    setCustomA('');
    setCustomU('');
  }, [state.currentQuestionIndex]);

  const handleJoin = () => {
    if (!playerName.trim()) return;
    joinGame(playerName);
    setHasJoined(true);
  };

  const handleGuessSubmit = () => {
    if (!localGuess) return;
    submitGuess(parseFloat(localGuess));
  };

  const handleCustomQuestionSubmit = () => {
      if (!customQ || !customA || !customU) return;
      submitCustomQuestion(customQ, parseFloat(customA), customU);
  };

  // --- VIEW: NAME ENTRY (START SCREEN) ---
  if (!hasJoined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
         <div className="mb-10 text-center animate-float">
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 tracking-tight">
            Das Schätzduell
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Wer liegt am nächsten dran?</p>
        </div>

        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-2xl p-8 border border-slate-700 shadow-2xl relative">
           <h2 className="text-xl font-bold text-white mb-6 text-center">Profil erstellen</h2>
           
           <div className="space-y-4">
             <div>
               <label className="block text-sm font-medium text-slate-400 mb-1">Dein Name</label>
               <input 
                 type="text" 
                 value={playerName}
                 onChange={(e) => setPlayerName(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                 placeholder="z.B. QuizMaster 3000"
                 className="w-full bg-slate-700 text-white p-4 rounded-xl border border-slate-600 focus:border-indigo-500 outline-none transition-colors"
                 maxLength={15}
               />
             </div>
             
             <button
               onClick={handleJoin}
               disabled={!playerName.trim()}
               className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300
                 ${playerName.trim() 
                   ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg' 
                   : 'bg-slate-700 text-slate-500 cursor-not-allowed'}
               `}
             >
               <LogIn className="w-5 h-5" /> Beitreten
             </button>
           </div>

           <div className="mt-8 pt-4 border-t border-slate-700 flex justify-center">
             <button 
               onClick={hardReset}
               className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
               title="Löscht alle Spieler und setzt das Spiel zurück"
             >
               <Trash2 className="w-3 h-3" /> Lobby komplett zurücksetzen (Dev Reset)
             </button>
           </div>
        </div>
      </div>
    );
  }

  // --- VIEW: LOBBY ---
  if (state.phase === GamePhase.LOBBY) {
    const canStart = state.players.length >= 2;
    
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950">
        <div className="mb-10 text-center animate-float">
          <h1 className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-300 tracking-tight">
            Das Schätzduell
          </h1>
          <p className="text-slate-400 mt-2 text-lg">Wer liegt am nächsten dran?</p>
        </div>

        <div className="w-full max-w-md bg-slate-800/80 backdrop-blur-md rounded-2xl p-8 border border-slate-700 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-indigo-400" />
              Lobby
            </h2>
            <span className="text-xs font-mono bg-slate-900 px-2 py-1 rounded text-slate-400">
              {state.players.length} Spieler bereit
            </span>
          </div>
          
          <div className="flex flex-col gap-2 mb-8 max-h-60 overflow-y-auto pr-2">
            {state.players.map(p => (
              <div key={p.id} className={`p-3 rounded-lg flex items-center justify-between ${p.id === myPlayerId ? 'bg-indigo-600/20 border border-indigo-500/50' : 'bg-slate-700/30'}`}>
                <span className="font-medium text-slate-200">{p.name} {p.id === myPlayerId && '(Du)'}</span>
                <span className="text-xs text-slate-500">{p.id.slice(0, 4)}...</span>
              </div>
            ))}
          </div>

          {/* GAME MODE SELECTION */}
          {isHost ? (
              <div className="mb-6 bg-slate-700/50 p-4 rounded-xl">
                 <h3 className="text-xs font-bold text-slate-400 uppercase mb-3 tracking-wider">Spielmodus wählen</h3>
                 <div className="flex gap-2">
                     <button 
                       onClick={() => setGameMode(GameMode.PREDEFINED)}
                       className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${state.mode === GameMode.PREDEFINED ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                     >
                       <Globe className="w-5 h-5" />
                       Vordefiniert
                     </button>
                     <button 
                       onClick={() => setGameMode(GameMode.CUSTOM)}
                       className={`flex-1 py-3 px-2 rounded-lg text-sm font-bold flex flex-col items-center gap-1 transition-all ${state.mode === GameMode.CUSTOM ? 'bg-indigo-600 text-white ring-2 ring-indigo-400' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                     >
                       <PenTool className="w-5 h-5" />
                       Benutzerdefiniert
                     </button>
                 </div>
                 <p className="text-xs text-slate-400 mt-3 text-center min-h-[2.5em]">
                    {state.mode === GameMode.PREDEFINED 
                     ? "Fragen aus dem Katalog (Airtable)." 
                     : "Spieler stellen sich abwechselnd Fragen. Der Verlierer stellt die nächste Frage."}
                 </p>
              </div>
          ) : (
             <div className="mb-6 text-center">
                 <div className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 rounded-full text-sm text-slate-300">
                    {state.mode === GameMode.PREDEFINED ? <Globe className="w-4 h-4"/> : <PenTool className="w-4 h-4"/>}
                    Modus: <span className="font-bold text-white">{state.mode === GameMode.PREDEFINED ? 'Vordefiniert' : 'Benutzerdefiniert'}</span>
                 </div>
             </div>
          )}

          <button
            onClick={startGame}
            disabled={!canStart}
            className={`
              w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all duration-300
              ${canStart 
                ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg shadow-indigo-500/25 transform hover:-translate-y-1' 
                : 'bg-slate-700 text-slate-400 cursor-not-allowed grayscale'}
            `}
          >
            {canStart ? <Play className="w-5 h-5 fill-current" /> : <Clock className="w-5 h-5" />}
            {canStart ? 'Spiel starten' : 'Warte auf Mitspieler (min. 2)...'}
          </button>
          
          {!canStart && (
            <p className="mt-4 text-xs text-center text-slate-500 flex items-center justify-center gap-1">
              <AlertCircle className="w-3 h-3" /> Öffnen Sie einen weiteren Tab, um zu testen.
            </p>
          )}

           <div className="mt-6 pt-4 border-t border-slate-700 flex justify-center">
             <button 
               onClick={hardReset}
               className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1 opacity-60 hover:opacity-100 transition-opacity"
             >
               <Trash2 className="w-3 h-3" /> Lobby leeren (Alle kicken)
             </button>
           </div>
        </div>
      </div>
    );
  }

  // --- VIEW: GAME OVER ---
  if (state.phase === GamePhase.GAME_OVER) {
    const sortedPlayers = [...state.players].sort((a, b) => b.score - a.score);
    const winner = sortedPlayers[0];
    const isWinner = winner.id === myPlayerId;

    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-900">
        <div className="text-center mb-10 fade-in">
          <Trophy className={`w-24 h-24 mx-auto mb-4 ${isWinner ? 'text-yellow-400' : 'text-slate-600'}`} />
          <h1 className="text-4xl font-bold text-white mb-2">Spiel beendet!</h1>
          <p className="text-xl text-slate-400">
            Gewinner: <span className="text-indigo-400 font-bold">{winner.name}</span>
          </p>
        </div>

        <div className="w-full max-w-2xl space-y-3 mb-10">
          {sortedPlayers.map((p, idx) => (
            <div key={p.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-xl border border-slate-700">
              <div className="flex items-center gap-4">
                <div className={`w-8 h-8 flex items-center justify-center rounded-full font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700 text-slate-300'}`}>
                  {idx + 1}
                </div>
                <span className="font-semibold">{p.name} {p.id === myPlayerId && '(Du)'}</span>
              </div>
              <span className="text-2xl font-mono font-bold text-indigo-400">{p.score} <span className="text-sm font-sans text-slate-500">Pkt</span></span>
            </div>
          ))}
        </div>

        <div className="flex gap-4">
          <button
            onClick={restartGame}
            className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-5 h-5" />
            Neues Spiel starten
          </button>
          
          {isHost && (
            <button 
              onClick={cancelGame}
              className="px-8 py-3 bg-slate-800 text-slate-300 border border-slate-700 rounded-full font-bold hover:bg-slate-700 hover:text-white transition-colors"
            >
              Zurück zur Lobby
            </button>
          )}
        </div>
      </div>
    );
  }

  // --- VIEW: WRITING PHASE (CUSTOM MODE ONLY) ---
  if (state.phase === GamePhase.WRITING) {
     const questioner = state.players.find(p => p.id === state.activeQuestionerId);
     
     if (isActiveQuestioner) {
        return (
          <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900">
             <div className="w-full max-w-lg bg-slate-800 p-8 rounded-3xl border border-indigo-500 shadow-2xl animate-float">
                <div className="flex items-center justify-center mb-6 text-indigo-400">
                   <PenTool className="w-12 h-12" />
                </div>
                <h2 className="text-2xl font-bold text-white text-center mb-2">Du bist dran!</h2>
                <p className="text-slate-400 text-center mb-6">Stelle eine Frage an deine Mitspieler.</p>
                
                <div className="space-y-4">
                   <div>
                      <label className="text-xs font-bold text-slate-500 uppercase">Frage</label>
                      <input 
                         type="text" 
                         className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white focus:border-indigo-500 outline-none mt-1"
                         placeholder="z.B. Wie viele Eiffeltürme wiegt ein Blauwal?"
                         value={customQ}
                         onChange={e => setCustomQ(e.target.value)}
                      />
                   </div>
                   <div className="flex gap-4">
                      <div className="flex-1">
                          <label className="text-xs font-bold text-slate-500 uppercase">Antwort (Zahl)</label>
                          <input 
                             type="number" 
                             className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white focus:border-indigo-500 outline-none mt-1"
                             placeholder="150"
                             value={customA}
                             onChange={e => setCustomA(e.target.value)}
                          />
                      </div>
                      <div className="w-1/3">
                          <label className="text-xs font-bold text-slate-500 uppercase">Einheit</label>
                          <input 
                             type="text" 
                             className="w-full bg-slate-700 border-slate-600 rounded-lg p-3 text-white focus:border-indigo-500 outline-none mt-1"
                             placeholder="Tonnen"
                             value={customU}
                             onChange={e => setCustomU(e.target.value)}
                          />
                      </div>
                   </div>
                   
                   <button 
                      onClick={handleCustomQuestionSubmit}
                      disabled={!customQ || !customA || !customU}
                      className={`w-full py-4 mt-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all
                        ${(!customQ || !customA || !customU) ? 'bg-slate-700 text-slate-500' : 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-lg'}
                      `}
                   >
                      <CheckCircle className="w-5 h-5" /> Frage stellen
                   </button>
                </div>
             </div>
          </div>
        )
     }

     return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-900">
           <div className="text-center">
              <div className="relative inline-block">
                  <div className="w-24 h-24 bg-slate-800 rounded-full flex items-center justify-center mb-6 mx-auto animate-pulse">
                      <BrainCircuit className="w-10 h-10 text-indigo-400" />
                  </div>
                  <div className="absolute -top-2 -right-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                     Denkt nach...
                  </div>
              </div>
              <h2 className="text-3xl font-bold text-white mb-2">{questioner?.name} schreibt...</h2>
              <p className="text-slate-400">Bereite dich vor, die Frage kommt gleich!</p>
           </div>
        </div>
     );
  }

  // --- VIEW: PLAYING & REVEAL (Shared Layout) ---
  const isReveal = state.phase === GamePhase.REVEAL;
  
  const playersWithDiff = [...state.players].map(p => ({
    ...p,
    diff: p.currentGuess !== null ? Math.abs(p.currentGuess - currentQuestion.antwort) : Infinity
  })).sort((a, b) => a.diff - b.diff);

  const roundWinnerId = state.winnerId;

  // Determine Timer Color
  const timerIsCritical = state.timeRemaining < 6;
  const timerColor = isReveal ? 'text-slate-500' : (timerIsCritical ? 'text-red-500' : 'text-indigo-400');
  const timerBorder = isReveal ? 'border-slate-700' : (timerIsCritical ? 'border-red-500/50 animate-pulse' : 'border-indigo-500/50');
  const timerBg = isReveal ? 'bg-slate-800' : (timerIsCritical ? 'bg-red-950/30' : 'bg-indigo-950/30');

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-slate-900 relative">
      
      {/* HOST CONTROLS */}
      {isHost && (
        <button 
          onClick={cancelGame}
          className="absolute top-4 right-4 md:top-8 md:right-8 flex items-center gap-2 px-4 py-2 bg-red-900/20 text-red-400 border border-red-900/50 rounded-lg hover:bg-red-900/40 hover:text-red-300 transition-colors text-sm font-semibold z-10"
          title="Spiel für alle abbrechen und zur Lobby zurückkehren"
        >
          <XCircle className="w-4 h-4" />
          <span className="hidden md:inline">Spiel abbrechen</span>
        </button>
      )}

      {/* Header Info */}
      <div className="w-full max-w-4xl flex justify-center mt-8 md:mt-4 mb-6">
        <div className="bg-slate-800/80 px-6 py-2 rounded-full border border-slate-700 backdrop-blur-sm">
          <h2 className="text-slate-300 text-sm font-bold uppercase tracking-wider flex items-center gap-2">
            {state.mode === GameMode.PREDEFINED 
              ? `Frage ${state.currentQuestionIndex + 1} von ${state.questions.length}`
              : `Runde ${state.currentQuestionIndex + 1}`
            }
          </h2>
        </div>
      </div>

      {/* BIG TIMER DISPLAY (DESKTOP ONLY) */}
      <div className={`
        relative mb-8 rounded-full w-32 h-32 hidden md:flex items-center justify-center border-4
        ${timerBg} ${timerBorder} transition-all duration-300
      `}>
          <div className="text-center">
            <div className={`text-6xl font-mono font-bold ${timerColor}`}>
              {isReveal ? '00' : state.timeRemaining.toString().padStart(2, '0')}
            </div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mt-[-5px]">Sekunden</div>
          </div>
          
          {!isReveal && (
             <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
               <circle cx="50" cy="50" r="46" stroke="currentColor" strokeWidth="2" fill="none" className="text-slate-800" />
               <circle 
                 cx="50" cy="50" r="46" 
                 stroke="currentColor" strokeWidth="2" fill="none" 
                 className={`${timerIsCritical ? 'text-red-500' : 'text-indigo-500'} transition-all duration-1000`}
                 strokeDasharray="289"
                 strokeDashoffset={289 - (289 * state.timeRemaining) / 15}
                 strokeLinecap="round"
               />
             </svg>
          )}
      </div>

      {/* Main Game Card */}
      <div className="w-full max-w-3xl bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden mb-8 relative">
        {/* Question Area */}
        <div className="p-8 md:p-12 text-center bg-gradient-to-b from-slate-800 to-slate-800/50">
           {state.mode === GameMode.CUSTOM && (
             <div className="text-xs text-indigo-400 font-bold uppercase mb-2 tracking-widest">
                Frage von {state.players.find(p => p.id === state.activeQuestionerId)?.name}
             </div>
           )}
           <h3 className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
             {currentQuestion?.frage || "Lade Frage..."}
           </h3>
        </div>

        {/* Interaction / Answer Area */}
        <div className="p-8 bg-slate-900/50 border-t border-slate-700">
          
          {isReveal ? (
             <div className="text-center fade-in">
               <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Die richtige Antwort ist</p>
               <div className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
                 {currentQuestion?.antwort?.toLocaleString('de-DE')}
               </div>
               <p className="text-xl text-slate-300 font-medium">{currentQuestion?.einheit}</p>
             </div>
          ) : isActiveQuestioner ? (
             <div className="text-center py-8">
                 <p className="text-slate-400 mb-2">Du hast diese Frage gestellt.</p>
                 <p className="text-white font-bold text-lg animate-pulse">Warte auf die Schätzungen deiner Freunde...</p>
             </div>
          ) : (
            <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
              
              <div className="flex items-center gap-3 w-full">
                {/* MOBILE TIMER (VISIBLE ONLY ON MOBILE) */}
                <div className={`
                  md:hidden flex-shrink-0 w-16 h-16 rounded-full flex items-center justify-center border-4 shadow-lg
                  ${timerBg} ${timerBorder}
                `}>
                   <span className={`text-xl font-bold font-mono ${timerColor}`}>
                     {state.timeRemaining}
                   </span>
                </div>

                {/* Input Field Wrapper */}
                <div className="relative flex-1">
                  <input
                    type="number"
                    value={localGuess}
                    onChange={(e) => setLocalGuess(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleGuessSubmit()}
                    placeholder="0"
                    className="w-full bg-slate-700 text-white text-center text-3xl font-bold py-4 rounded-xl border-2 border-slate-600 focus:border-indigo-500 focus:ring-0 outline-none transition-all placeholder:text-slate-600"
                    disabled={me?.hasGuessed}
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none hidden sm:inline">
                    {currentQuestion?.einheit}
                  </span>
                </div>
              </div>
              
              {/* Mobile Unit Display (Below input if screen is very small) */}
              <div className="sm:hidden text-slate-400 font-medium text-sm -mt-2">
                {currentQuestion?.einheit}
              </div>
              
              <button
                onClick={handleGuessSubmit}
                disabled={!localGuess || me?.hasGuessed}
                className={`
                   w-full py-3 rounded-lg font-bold text-lg transition-all
                   ${me?.hasGuessed 
                     ? 'bg-green-600 text-white cursor-default shadow-lg shadow-green-900/20' 
                     : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'}
                `}
              >
                {me?.hasGuessed ? 'Warten auf andere...' : 'Absenden'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results List (Only visible during reveal) */}
      {isReveal && (
        <div className="w-full max-w-3xl mb-24 fade-in">
          <h4 className="text-slate-400 mb-4 font-bold uppercase text-sm">Schätzungen dieser Runde</h4>
          <div className="space-y-2">
            {playersWithDiff.map((p) => {
               // Skip rendering the questioner in the guess list for Custom Mode
               if (state.mode === GameMode.CUSTOM && p.id === state.activeQuestionerId) return null;

               const isRoundWinner = roundWinnerId === p.id || (roundWinnerId === 'TIE' && p.diff === playersWithDiff.filter(pl => pl.id !== state.activeQuestionerId)[0].diff);
               
               // Determine loser for next round indicator (only relevant in custom mode)
               // Sort again to be safe to find the actual last place visually
               // But usually the list is already sorted by diff asc. Last one is loser.
               const isLoser = state.mode === GameMode.CUSTOM && p.diff === playersWithDiff[playersWithDiff.length-1].diff;

               return (
                 <div key={p.id} className={`
                    flex items-center justify-between p-4 rounded-lg border transition-all
                    ${isRoundWinner ? 'bg-green-900/20 border-green-500/50 scale-[1.02] shadow-lg' : 'bg-slate-800 border-slate-700'}
                 `}>
                    <div className="flex items-center gap-3">
                       <div className="font-bold text-slate-200">{p.name}</div>
                       {isRoundWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
                       {isLoser && state.mode === GameMode.CUSTOM && <span className="text-xs bg-red-900 text-red-200 px-2 py-0.5 rounded border border-red-700">Nächster Fragesteller</span>}
                    </div>
                    
                    <div className="flex flex-col items-end">
                       <div className="font-mono text-lg font-bold">
                         {p.currentGuess?.toLocaleString('de-DE') ?? '-'} <span className="text-xs font-sans text-slate-500">{currentQuestion?.einheit}</span>
                       </div>
                       <div className="text-xs text-slate-400">
                         Diff: {p.diff?.toLocaleString('de-DE')}
                       </div>
                    </div>
                 </div>
               );
            })}
          </div>
          
          {isHost && (
            <div className="mt-8 flex justify-center">
               <button 
                 onClick={nextRound}
                 className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2 shadow-xl"
               >
                 Nächste Runde <ArrowRight className="w-5 h-5" />
               </button>
            </div>
          )}
          {!isHost && (
            <div className="mt-8 text-center text-slate-500 animate-pulse">
               Warte auf Spielleiter für nächste Runde...
            </div>
          )}
        </div>
      )}

      {/* Player Status Bar */}
      {!isReveal && (
         <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4 z-20">
            <div className="max-w-4xl mx-auto flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
               {state.players.map(p => {
                 // In Custom mode, visually distinguish the questioner
                 if (state.mode === GameMode.CUSTOM && p.id === state.activeQuestionerId) {
                    return (
                        <div key={p.id} className="flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/30">
                            <PenTool className="w-3 h-3" />
                            <span>{p.name} (Stellt Frage)</span>
                        </div>
                    )
                 }
                 
                 return (
                 <div key={p.id} className={`
                    flex-shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
                    ${p.hasGuessed ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-slate-800 text-slate-400 border border-slate-700'}
                 `}>
                    <div className={`w-2 h-2 rounded-full ${p.hasGuessed ? 'bg-green-500' : 'bg-slate-600'}`} />
                    <span>{p.name}</span>
                    <span className="bg-slate-950/50 px-1.5 rounded text-xs ml-1">{p.score}</span>
                 </div>
               )})}
            </div>
         </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <GameScreen />
  );
}