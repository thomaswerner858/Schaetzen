import { Question } from './types';

export const ROUND_DURATION = 15; // Seconds

// ==========================================
// KONFIGURATION (Bitte hier Werte eintragen)
// ==========================================

// 1. Firebase Konfiguration (Aus der Firebase Console -> Project Settings)
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBGzUyEMW8twQJDTPHNDOhPtCu89nNUylc",
  authDomain: "schaetzen-678a2.firebaseapp.com",
  projectId: "schaetzen-678a2",
  storageBucket: "schaetzen-678a2.firebasestorage.app",
  messagingSenderId: "157273136982",
  appId: "1:157273136982:web:e5c75b90eb9f4c312440f7"
};

// 2. Airtable Konfiguration
export const AIRTABLE_CONFIG = {
  apiKey: "patDvOvrHo0t3XpzD.5994cc51752310a6fdd00e96e0c140f0b230d63c5b9bcbee72012690a7005811",
  baseId: "appBLXIlEYVFwXVhp",
  tableName: "Fragen"
};

// ==========================================

export const MOCK_QUESTIONS: Question[] = [
  {
    "id": 1,
    "frage": "Wie hoch ist der Mount Everest (in Metern)?",
    "antwort": 8848,
    "einheit": "Meter"
  },
  {
    "id": 2,
    "frage": "Wie viele Kilometer beträgt die ungefähre Entfernung zwischen Berlin und Moskau?",
    "antwort": 1610,
    "einheit": "Kilometer"
  },
  {
    "id": 3,
    "frage": "Was war das Erscheinungsjahr des ersten Harry-Potter-Bandes?",
    "antwort": 1997,
    "einheit": "Jahr"
  },
  {
    "id": 4,
    "frage": "Wie viele Sekunden hat ein normaler Tag?",
    "antwort": 86400,
    "einheit": "Sekunden"
  }
];

export const fetchQuestions = async (): Promise<Question[]> => {
  // Wenn keine Airtable Keys konfiguriert sind, Mock-Daten nutzen
  if (!AIRTABLE_CONFIG.apiKey || !AIRTABLE_CONFIG.baseId) {
    console.warn("Airtable nicht konfiguriert. Nutze Mock-Daten.");
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve([...MOCK_QUESTIONS]);
      }, 500);
    });
  }

  try {
    const url = `https://api.airtable.com/v0/${AIRTABLE_CONFIG.baseId}/${encodeURIComponent(AIRTABLE_CONFIG.tableName)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${AIRTABLE_CONFIG.apiKey}`
      }
    });

    if (!response.ok) {
      // Detaillierte Fehlerbehandlung
      const errorData = await response.json().catch(() => ({}));
      console.error("Airtable API Error:", errorData);
      throw new Error(`Airtable Error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Mapping der Airtable Struktur auf unsere App-Struktur
    const mappedQuestions: Question[] = data.records.map((record: any, index: number) => ({
      id: index + 1, // Wir nutzen einen numerischen Index für die interne Logik
      frage: record.fields.frage || "Frage fehlt",
      antwort: parseFloat(record.fields.antwort) || 0, // Sicherstellen, dass es eine Zahl ist
      einheit: record.fields.einheit || ""
    })).filter((q: Question) => q.frage !== "Frage fehlt" && !isNaN(q.antwort));

    if (mappedQuestions.length === 0) throw new Error("Keine gültigen Fragen in der Tabelle gefunden (Spaltennamen 'frage', 'antwort', 'einheit' prüfen).");
    
    return mappedQuestions;

  } catch (error) {
    console.error("Fehler beim Laden von Airtable:", error);
    alert("Fehler beim Laden der Fragen von Airtable! Prüfen Sie die Konsole. Fallback auf Mock-Daten.");
    return [...MOCK_QUESTIONS];
  }
};