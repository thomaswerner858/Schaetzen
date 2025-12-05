import React, { useState, useEffect } from 'react';
import { useGameEngine } from './services/gameEngine';
import { GamePhase, Player } from './types';
import { Trophy, Clock, Users, ArrowRight, Play, RefreshCw, AlertCircle } from 'lucide-react';

// --- Subcomponents defined here for single-file XML structure simplicity ---

const PlayerList = ({ players, myId, winnerId }: { players: Player[], myId: string, winnerId: string | null }) => (
  <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full max-w-2xl">
    {players.map((player) => {
      const isMe = player.id === myId;
      const isWinner = winnerId === player.id || (winnerId === 'TIE' && false /* handled in logic logic */); 
      // Simplified winner check visual:
      
      return (
        <div 
          key={player.id} 
          className={`
            relative p-4 rounded-xl border-2 transition-all duration-300
            ${isMe ? 'border-indigo-400 bg-indigo-900/30' : 'border-slate-700 bg-slate-800/50'}
            ${isWinner ? 'ring-2 ring-green-400 border-green-500 bg-green-900/20' : ''}
          `}
        >
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
              ${isMe ? 'bg-indigo-500 text-white' : 'bg-slate-600 text-slate-200'}
            `}>
              {player.name.charAt(0)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-slate-200">
                {player.name} {isMe && '(Du)'}
              </p>
              <p className="text-xs text-slate-400">Punkte: {player.score}</p>
            </div>
          </div>
          {player.hasGuessed && winnerId === null && (
             <div className="absolute top-2 right-2 w-3 h-3 bg-green-500 rounded-full animate-pulse" title="Geschätzt"></div>
          )}
        </div>
      );
    })}
  </div>
);

const GameScreen = () => {
  const { state, myPlayerId, startGame, submitGuess, nextRound, restartGame } = useGameEngine();
  const [localGuess, setLocalGuess] = useState<string>('');
  
  // Auto-submit mechanism could be added here, but prompt implies simple last-valid-input logic.
  // We will submit on change or blur, but let's submit on a button press to be explicit.
  
  const currentQuestion = state.questions[state.currentQuestionIndex];
  const me = state.players.find(p => p.id === myPlayerId);

  // Handle local guess submission
  const handleGuessSubmit = () => {
    if (!localGuess) return;
    submitGuess(parseFloat(localGuess));
  };

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
        </div>
      </div>
    );
  }

  // --- VIEW: GAME OVER ---
  if (state.phase === GamePhase.GAME_OVER) {
    // Sort players by total score
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

        <button
          onClick={restartGame}
          className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-5 h-5" />
          Neues Spiel starten
        </button>
      </div>
    );
  }

  // --- VIEW: PLAYING & REVEAL (Shared Layout) ---
  const isReveal = state.phase === GamePhase.REVEAL;
  
  // Calculate differences for reveal sorting
  const playersWithDiff = [...state.players].map(p => ({
    ...p,
    diff: p.currentGuess !== null ? Math.abs(p.currentGuess - currentQuestion.antwort) : Infinity
  })).sort((a, b) => a.diff - b.diff);

  const roundWinnerId = state.winnerId;

  return (
    <div className="min-h-screen flex flex-col items-center p-4 md:p-8 bg-slate-900">
      {/* Header / Scoreboard */}
      <div className="w-full max-w-4xl flex justify-between items-start mb-8">
        <div>
          <h2 className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Frage {state.currentQuestionIndex + 1} / {state.questions.length}</h2>
          <div className="flex gap-1">
             {state.questions.map((_, i) => (
               <div key={i} className={`h-1 w-8 rounded-full ${i <= state.currentQuestionIndex ? 'bg-indigo-500' : 'bg-slate-700'}`} />
             ))}
          </div>
        </div>
        
        {/* Timer */}
        <div className="text-right">
           <div className={`text-3xl font-mono font-bold flex items-center justify-end gap-2 ${state.timeRemaining < 5 && !isReveal ? 'text-red-500 animate-pulse' : 'text-white'}`}>
             <Clock className="w-6 h-6" />
             {isReveal ? '00' : state.timeRemaining.toString().padStart(2, '0')}
           </div>
           <p className="text-xs text-slate-500">Sekunden</p>
        </div>
      </div>

      {/* Main Game Card */}
      <div className="w-full max-w-3xl bg-slate-800 rounded-3xl border border-slate-700 shadow-2xl overflow-hidden mb-8 relative">
        {/* Question Area */}
        <div className="p-8 md:p-12 text-center bg-gradient-to-b from-slate-800 to-slate-800/50">
           <h3 className="text-2xl md:text-3xl font-bold text-white leading-relaxed">
             {currentQuestion?.frage}
           </h3>
        </div>

        {/* Interaction / Answer Area */}
        <div className="p-8 bg-slate-900/50 border-t border-slate-700">
          
          {isReveal ? (
             <div className="text-center fade-in">
               <p className="text-slate-400 text-sm uppercase tracking-widest mb-2">Die richtige Antwort ist</p>
               <div className="text-5xl md:text-6xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-500 mb-2">
                 {currentQuestion.antwort.toLocaleString('de-DE')}
               </div>
               <p className="text-xl text-slate-300 font-medium">{currentQuestion.einheit}</p>
             </div>
          ) : (
            <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
              <div className="relative w-full">
                <input
                   type="number"
                   value={localGuess}
                   onChange={(e) => setLocalGuess(e.target.value)}
                   onKeyDown={(e) => e.key === 'Enter' && handleGuessSubmit()}
                   placeholder="0"
                   className="w-full bg-slate-700 text-white text-center text-3xl font-bold py-4 rounded-xl border-2 border-slate-600 focus:border-indigo-500 focus:ring-0 outline-none transition-all placeholder:text-slate-600"
                   disabled={me?.hasGuessed}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 font-medium pointer-events-none">
                  {currentQuestion.einheit}
                </span>
              </div>
              
              <button
                onClick={handleGuessSubmit}
                disabled={!localGuess || me?.hasGuessed}
                className={`
                   w-full py-3 rounded-lg font-bold text-lg transition-all
                   ${me?.hasGuessed 
                     ? 'bg-green-600 text-white cursor-default' 
                     : 'bg-indigo-600 hover:bg-indigo-500 text-white'}
                `}
              >
                {me?.hasGuessed ? 'Gesendet!' : 'Absenden'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Results List (Only visible during reveal) */}
      {isReveal && (
        <div className="w-full max-w-3xl mb-8 fade-in">
          <h4 className="text-slate-400 mb-4 font-bold uppercase text-sm">Schätzungen dieser Runde</h4>
          <div className="space-y-2">
            {playersWithDiff.map((p) => {
               const isRoundWinner = roundWinnerId === p.id || (roundWinnerId === 'TIE' && p.diff === playersWithDiff[0].diff);
               return (
                 <div key={p.id} className={`
                    flex items-center justify-between p-4 rounded-lg border
                    ${isRoundWinner ? 'bg-green-900/20 border-green-500/50' : 'bg-slate-800 border-slate-700'}
                 `}>
                    <div className="flex items-center gap-3">
                       <div className="font-bold text-slate-200">{p.name}</div>
                       {isRoundWinner && <Trophy className="w-4 h-4 text-yellow-400" />}
                    </div>
                    
                    <div className="flex flex-col items-end">
                       <div className="font-mono text-lg font-bold">
                         {p.currentGuess?.toLocaleString('de-DE') ?? '-'} <span className="text-xs font-sans text-slate-500">{currentQuestion.einheit}</span>
                       </div>
                       <div className="text-xs text-slate-400">
                         Diff: {p.diff.toLocaleString('de-DE')}
                       </div>
                    </div>
                 </div>
               );
            })}
          </div>
          
          <div className="mt-8 flex justify-center">
             <button 
               onClick={nextRound}
               className="bg-white text-slate-900 px-8 py-3 rounded-full font-bold hover:bg-slate-200 transition-colors flex items-center gap-2"
             >
               Nächste Runde <ArrowRight className="w-5 h-5" />
             </button>
          </div>
        </div>
      )}

      {/* Player Status Bar (Always visible but subtle) */}
      {!isReveal && (
         <div className="fixed bottom-0 left-0 right-0 bg-slate-900/90 backdrop-blur border-t border-slate-800 p-4">
            <div className="max-w-4xl mx-auto flex gap-4 overflow-x-auto pb-2">
               {state.players.map(p => (
                 <div key={p.id} className={`flex-shrink-0 flex items-center gap-2 px-3 py-1 rounded-full text-sm ${p.hasGuessed ? 'bg-green-900/30 text-green-400 border border-green-800' : 'bg-slate-800 text-slate-500 border border-slate-700'}`}>
                    <div className={`w-2 h-2 rounded-full ${p.hasGuessed ? 'bg-green-500' : 'bg-slate-500'}`} />
                    {p.name}: {p.score}
                 </div>
               ))}
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
