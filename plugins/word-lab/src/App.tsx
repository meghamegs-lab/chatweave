import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Inline SDK bridge (same pattern as chess plugin) ───────────────────────

let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// ─── Types ──────────────────────────────────────────────────────────────────

type GameMode = 'spelling' | 'vocabulary' | 'phonics' | 'word-building';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type MasteryLevel = 'new' | 'learning' | 'mastered';

interface WordEntry {
  word: string;
  definition: string;
  example: string;
  phonetics: string;
  emoji: string;
  category: string;
}

interface WordMastery {
  word: string;
  level: MasteryLevel;
  correctCount: number;
  attemptCount: number;
}

interface GameState {
  mode: GameMode;
  difficulty: Difficulty;
  words: WordEntry[];
  currentIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  totalCorrect: number;
  totalAttempts: number;
  mastery: Record<string, WordMastery>;
  startTime: number;
  hintsUsed: number;
}

interface VocabOption {
  text: string;
  correct: boolean;
}

// ─── Word Bank ──────────────────────────────────────────────────────────────

const WORD_BANK: Record<Difficulty, WordEntry[]> = {
  beginner: [
    { word: 'cat', definition: 'A small furry pet that purrs', example: 'The ___ sat on the mat.', phonetics: 'kat', emoji: '🐱', category: 'animals' },
    { word: 'dog', definition: 'A loyal pet that barks', example: 'My ___ loves to fetch the ball.', phonetics: 'dawg', emoji: '🐶', category: 'animals' },
    { word: 'sun', definition: 'The bright star in our sky', example: 'The ___ rises in the morning.', phonetics: 'suhn', emoji: '☀️', category: 'nature' },
    { word: 'run', definition: 'To move quickly on your feet', example: 'I like to ___ in the park.', phonetics: 'ruhn', emoji: '🏃', category: 'actions' },
    { word: 'big', definition: 'Very large in size', example: 'That is a ___ elephant!', phonetics: 'big', emoji: '🐘', category: 'adjectives' },
    { word: 'red', definition: 'The color of fire and roses', example: 'She wore a ___ dress.', phonetics: 'rehd', emoji: '🔴', category: 'colors' },
    { word: 'map', definition: 'A drawing that shows where places are', example: 'Use the ___ to find the way.', phonetics: 'map', emoji: '🗺️', category: 'objects' },
    { word: 'cup', definition: 'A small container to drink from', example: 'Pour water into the ___.', phonetics: 'kuhp', emoji: '☕', category: 'objects' },
    { word: 'hat', definition: 'Something you wear on your head', example: 'He put on a warm ___.', phonetics: 'hat', emoji: '🎩', category: 'clothing' },
    { word: 'pen', definition: 'A tool used for writing', example: 'Write your name with a ___.', phonetics: 'pehn', emoji: '🖊️', category: 'objects' },
    { word: 'fish', definition: 'An animal that lives in water', example: 'The ___ swims in the pond.', phonetics: 'fish', emoji: '🐟', category: 'animals' },
    { word: 'tree', definition: 'A tall plant with leaves and branches', example: 'Birds sit in the ___.', phonetics: 'tree', emoji: '🌳', category: 'nature' },
    { word: 'star', definition: 'A bright light in the night sky', example: 'I can see a ___ twinkling.', phonetics: 'star', emoji: '⭐', category: 'nature' },
    { word: 'moon', definition: 'The round object that shines at night', example: 'The ___ is full tonight.', phonetics: 'moon', emoji: '🌙', category: 'nature' },
    { word: 'book', definition: 'Pages with words you can read', example: 'I read a ___ before bed.', phonetics: 'book', emoji: '📖', category: 'objects' },
    { word: 'frog', definition: 'A green animal that jumps and says ribbit', example: 'The ___ jumped into the pond.', phonetics: 'frawg', emoji: '🐸', category: 'animals' },
    { word: 'bell', definition: 'A metal object that rings', example: 'The ___ rang at noon.', phonetics: 'behl', emoji: '🔔', category: 'objects' },
    { word: 'cake', definition: 'A sweet food for celebrations', example: 'We had ___ at the party.', phonetics: 'kayk', emoji: '🎂', category: 'food' },
  ],
  intermediate: [
    { word: 'adventure', definition: 'An exciting and unusual experience', example: 'They went on a great ___ in the forest.', phonetics: 'ad-VEN-chur', emoji: '🗺️', category: 'concepts' },
    { word: 'discover', definition: 'To find something for the first time', example: 'Scientists ___ new things every day.', phonetics: 'dis-KUH-ver', emoji: '🔍', category: 'actions' },
    { word: 'treasure', definition: 'Something very valuable and precious', example: 'The pirate hid the ___ on the island.', phonetics: 'TREZH-ur', emoji: '💎', category: 'objects' },
    { word: 'champion', definition: 'The winner of a competition', example: 'She became the spelling bee ___.', phonetics: 'CHAM-pee-un', emoji: '🏆', category: 'people' },
    { word: 'elephant', definition: 'The largest land animal with a trunk', example: 'The ___ sprayed water with its trunk.', phonetics: 'EL-eh-funt', emoji: '🐘', category: 'animals' },
    { word: 'butterfly', definition: 'A colorful insect with large wings', example: 'A beautiful ___ landed on the flower.', phonetics: 'BUH-ter-fly', emoji: '🦋', category: 'animals' },
    { word: 'telescope', definition: 'A device for seeing things far away', example: 'We used a ___ to look at the stars.', phonetics: 'TEL-eh-skohp', emoji: '🔭', category: 'objects' },
    { word: 'dinosaur', definition: 'A large reptile from millions of years ago', example: 'The ___ fossils are in the museum.', phonetics: 'DY-nuh-sor', emoji: '🦕', category: 'animals' },
    { word: 'mountain', definition: 'A very high and steep area of land', example: 'We climbed to the top of the ___.', phonetics: 'MOWN-tun', emoji: '⛰️', category: 'nature' },
    { word: 'umbrella', definition: 'Something that keeps you dry in rain', example: 'Bring an ___ because it might rain.', phonetics: 'um-BREL-uh', emoji: '☂️', category: 'objects' },
    { word: 'chocolate', definition: 'A sweet brown food made from cacao', example: 'I love eating ___ ice cream.', phonetics: 'CHAWK-lit', emoji: '🍫', category: 'food' },
    { word: 'fantastic', definition: 'Extremely good or wonderful', example: 'You did a ___ job on your test!', phonetics: 'fan-TAS-tik', emoji: '🌟', category: 'adjectives' },
    { word: 'mysterious', definition: 'Strange and hard to explain', example: 'There was a ___ sound in the attic.', phonetics: 'mis-TEER-ee-us', emoji: '🕵️', category: 'adjectives' },
    { word: 'beautiful', definition: 'Very pretty and pleasing to look at', example: 'The sunset was ___ tonight.', phonetics: 'BYOO-tih-ful', emoji: '🌅', category: 'adjectives' },
    { word: 'wonderful', definition: 'Causing happiness and amazement', example: 'What a ___ surprise party!', phonetics: 'WUN-der-ful', emoji: '🎉', category: 'adjectives' },
    { word: 'kangaroo', definition: 'An animal that hops and carries babies in a pouch', example: 'The ___ jumped across the field.', phonetics: 'kang-guh-ROO', emoji: '🦘', category: 'animals' },
    { word: 'invisible', definition: 'Cannot be seen', example: 'The superhero turned ___.', phonetics: 'in-VIZ-ih-bul', emoji: '👻', category: 'adjectives' },
  ],
  advanced: [
    { word: 'hypothesis', definition: 'An educated guess that can be tested', example: 'The scientist formed a ___ about the experiment.', phonetics: 'hy-POTH-eh-sis', emoji: '🧪', category: 'science' },
    { word: 'metamorphosis', definition: 'A complete change in form or structure', example: 'A caterpillar undergoes ___ to become a butterfly.', phonetics: 'met-uh-MOR-fuh-sis', emoji: '🦋', category: 'science' },
    { word: 'phenomenon', definition: 'A remarkable event or occurrence', example: 'The northern lights are a natural ___.', phonetics: 'feh-NOM-eh-non', emoji: '🌌', category: 'science' },
    { word: 'bibliography', definition: 'A list of books and sources used in research', example: 'Include a ___ at the end of your report.', phonetics: 'bib-lee-OG-ruh-fee', emoji: '📚', category: 'writing' },
    { word: 'architecture', definition: 'The art and science of designing buildings', example: 'The ___ of this ancient temple is stunning.', phonetics: 'AR-kih-tek-chur', emoji: '🏛️', category: 'arts' },
    { word: 'photosynthesis', definition: 'The process by which plants make food using sunlight', example: 'Green leaves perform ___ to produce energy.', phonetics: 'foh-toh-SIN-theh-sis', emoji: '🌿', category: 'science' },
    { word: 'constellation', definition: 'A group of stars forming a pattern in the sky', example: 'Orion is a famous ___ visible in winter.', phonetics: 'kon-steh-LAY-shun', emoji: '✨', category: 'science' },
    { word: 'encyclopedia', definition: 'A book or resource with information on many topics', example: 'Look it up in the ___ for more details.', phonetics: 'en-sy-kloh-PEE-dee-uh', emoji: '📖', category: 'objects' },
    { word: 'extraordinary', definition: 'Far beyond what is ordinary or usual', example: 'She has ___ talent in music.', phonetics: 'ek-STROR-dih-nair-ee', emoji: '🌠', category: 'adjectives' },
    { word: 'sophisticated', definition: 'Highly developed, complex, or refined', example: 'The robot uses ___ artificial intelligence.', phonetics: 'suh-FIS-tih-kay-tid', emoji: '🤖', category: 'adjectives' },
    { word: 'revolutionary', definition: 'Involving a great or complete change', example: 'The invention was ___ for the field of medicine.', phonetics: 'rev-uh-LOO-shun-air-ee', emoji: '💡', category: 'adjectives' },
    { word: 'contemporary', definition: 'Belonging to the present time; modern', example: '___ art uses many new materials and styles.', phonetics: 'kun-TEM-puh-rair-ee', emoji: '🎨', category: 'adjectives' },
    { word: 'infrastructure', definition: 'Basic systems and structures needed by a society', example: 'Roads and bridges are part of a city\'s ___.', phonetics: 'IN-fruh-struk-chur', emoji: '🌉', category: 'concepts' },
    { word: 'philosophical', definition: 'Relating to the study of fundamental truths', example: 'They had a deep ___ discussion about life.', phonetics: 'fil-uh-SOF-ih-kul', emoji: '🤔', category: 'concepts' },
    { word: 'entrepreneurial', definition: 'Having the spirit of starting new businesses', example: 'Her ___ skills helped her launch a company.', phonetics: 'on-truh-pruh-NUR-ee-ul', emoji: '🚀', category: 'concepts' },
    { word: 'archaeological', definition: 'Relating to the study of ancient civilizations', example: 'The ___ dig uncovered Roman pottery.', phonetics: 'ar-kee-uh-LOJ-ih-kul', emoji: '🏺', category: 'science' },
    { word: 'onomatopoeia', definition: 'A word that imitates the sound it describes', example: 'Buzz and hiss are examples of ___.', phonetics: 'on-uh-mat-uh-PEE-uh', emoji: '🔊', category: 'writing' },
  ],
};

// Extra wrong definitions for vocabulary mode
const WRONG_DEFINITIONS: string[] = [
  'A type of musical instrument',
  'A small body of water',
  'A tool used for cooking',
  'Something you wear on your feet',
  'A kind of weather pattern',
  'A style of painting',
  'A mathematical formula',
  'A method of transportation',
  'A piece of furniture',
  'A type of dance',
  'Something found underground',
  'A game played with cards',
  'A feeling of great joy',
  'A way of building houses',
  'An ancient form of writing',
  'A device that measures time',
  'A flying machine',
  'A container for storing food',
  'The study of rocks and minerals',
  'A celebration held every year',
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getVocabOptions(correct: WordEntry, allWords: WordEntry[]): VocabOption[] {
  const options: VocabOption[] = [{ text: correct.definition, correct: true }];
  // pick 3 wrong definitions: prefer from other words, fall back to static list
  const otherDefs = allWords
    .filter(w => w.word !== correct.word)
    .map(w => w.definition);
  const wrongPool = shuffleArray([...otherDefs, ...WRONG_DEFINITIONS]);
  for (const d of wrongPool) {
    if (options.length >= 4) break;
    if (!options.some(o => o.text === d)) {
      options.push({ text: d, correct: false });
    }
  }
  return shuffleArray(options);
}

function getPhonicsOptions(correct: WordEntry, allWords: WordEntry[]): VocabOption[] {
  const options: VocabOption[] = [{ text: correct.phonetics, correct: true }];
  const others = shuffleArray(allWords.filter(w => w.word !== correct.word));
  for (const o of others) {
    if (options.length >= 4) break;
    if (!options.some(opt => opt.text === o.phonetics)) {
      options.push({ text: o.phonetics, correct: false });
    }
  }
  // if not enough, generate fake phonetics
  while (options.length < 4) {
    const fake = correct.word.split('').reverse().join('-').toUpperCase();
    if (!options.some(o => o.text === fake)) {
      options.push({ text: fake, correct: false });
    } else {
      break;
    }
  }
  return shuffleArray(options);
}

// ─── Animations (CSS keyframes injected once) ──────────────────────────────

const KEYFRAMES_ID = 'word-lab-keyframes';
function injectKeyframes() {
  if (document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes wl-bounce {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.15); }
    }
    @keyframes wl-shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-6px); }
      80% { transform: translateX(6px); }
    }
    @keyframes wl-pop {
      0% { transform: scale(0.3); opacity: 0; }
      60% { transform: scale(1.1); opacity: 1; }
      100% { transform: scale(1); }
    }
    @keyframes wl-float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-6px); }
    }
    @keyframes wl-glow-pulse {
      0%, 100% { box-shadow: 0 0 8px rgba(76, 175, 80, 0.3); }
      50% { box-shadow: 0 0 20px rgba(76, 175, 80, 0.6); }
    }
    @keyframes wl-tile-enter {
      0% { transform: scale(0) rotate(-10deg); opacity: 0; }
      100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

// ─── Color Palette ──────────────────────────────────────────────────────────

const COLORS = {
  light: {
    bg: '#f8f9ff',
    card: '#ffffff',
    primary: '#6C63FF',
    primaryLight: '#8B85FF',
    secondary: '#FF6584',
    success: '#4CAF50',
    successBg: '#E8F5E9',
    error: '#F44336',
    errorBg: '#FFEBEE',
    text: '#2D3436',
    textSecondary: '#636E72',
    tileBg: '#EDE7F6',
    tileBorder: '#B39DDB',
    tileSelected: '#6C63FF',
    progressBg: '#E8EAF6',
    progressFill: '#6C63FF',
    headerBg: 'linear-gradient(135deg, #6C63FF 0%, #FF6584 100%)',
    shadow: '0 2px 12px rgba(108, 99, 255, 0.12)',
    bubbleBg: '#F3F0FF',
  },
  dark: {
    bg: '#0f0e17',
    card: '#1a1a2e',
    primary: '#8B85FF',
    primaryLight: '#A5A0FF',
    secondary: '#FF6584',
    success: '#66BB6A',
    successBg: '#1B2E1B',
    error: '#EF5350',
    errorBg: '#2E1B1B',
    text: '#FFFFFE',
    textSecondary: '#A7A9BE',
    tileBg: '#2A2A4A',
    tileBorder: '#4A4A6A',
    tileSelected: '#8B85FF',
    progressBg: '#2A2A4A',
    progressFill: '#8B85FF',
    headerBg: 'linear-gradient(135deg, #4A45A2 0%, #CC5069 100%)',
    shadow: '0 2px 12px rgba(0, 0, 0, 0.4)',
    bubbleBg: '#1E1E3A',
  },
};

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [initialized, setInitialized] = useState(false);

  // Spelling/word-building mode state
  const [selectedLetters, setSelectedLetters] = useState<number[]>([]);
  const [availableLetters, setAvailableLetters] = useState<string[]>([]);

  // Vocabulary/phonics mode state
  const [vocabOptions, setVocabOptions] = useState<VocabOption[]>([]);
  const [chosenOption, setChosenOption] = useState<number | null>(null);

  // Feedback
  const [feedback, setFeedback] = useState<{ type: 'correct' | 'wrong'; message: string } | null>(null);
  const [feedbackAnim, setFeedbackAnim] = useState<'bounce' | 'shake' | null>(null);
  const [showNext, setShowNext] = useState(false);
  const [hintText, setHintText] = useState<string | null>(null);

  const gameRef = useRef<GameState | null>(null);

  useEffect(() => {
    injectKeyframes();
  }, []);

  useEffect(() => {
    gameRef.current = gameState;
  }, [gameState]);

  // ─── Set up a challenge round ──────────────────────────────────────────

  const setupRound = useCallback((gs: GameState) => {
    const word = gs.words[gs.currentIndex];
    if (!word) return;

    setFeedback(null);
    setFeedbackAnim(null);
    setShowNext(false);
    setChosenOption(null);
    setHintText(null);

    if (gs.mode === 'spelling' || gs.mode === 'word-building') {
      // create letter tiles: the word letters + some distractors, shuffled
      const wordLetters = word.word.toUpperCase().split('');
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
      const distractorCount = gs.difficulty === 'beginner' ? 2 : gs.difficulty === 'intermediate' ? 4 : 6;
      const distractors: string[] = [];
      while (distractors.length < distractorCount) {
        const l = alphabet[Math.floor(Math.random() * 26)];
        if (!wordLetters.includes(l) || Math.random() > 0.5) {
          distractors.push(l);
        }
      }
      setAvailableLetters(shuffleArray([...wordLetters, ...distractors]));
      setSelectedLetters([]);
    } else if (gs.mode === 'vocabulary') {
      setVocabOptions(getVocabOptions(word, gs.words));
    } else if (gs.mode === 'phonics') {
      setVocabOptions(getPhonicsOptions(word, gs.words));
    }
  }, []);

  // ─── Tool invocation handler ───────────────────────────────────────────

  const handleToolInvoke = useCallback((messageId: string, toolName: string, parameters: Record<string, any>) => {
    switch (toolName) {
      case 'start_word_challenge': {
        const mode: GameMode = parameters.mode || 'spelling';
        const difficulty: Difficulty = parameters.difficulty || 'beginner';
        const words = shuffleArray([...WORD_BANK[difficulty]]);

        const mastery: Record<string, WordMastery> = {};
        words.forEach(w => {
          mastery[w.word] = { word: w.word, level: 'new', correctCount: 0, attemptCount: 0 };
        });

        const newState: GameState = {
          mode,
          difficulty,
          words,
          currentIndex: 0,
          score: 0,
          streak: 0,
          bestStreak: 0,
          totalCorrect: 0,
          totalAttempts: 0,
          mastery,
          startTime: Date.now(),
          hintsUsed: 0,
        };

        setGameState(newState);
        gameRef.current = newState;
        setupRound(newState);

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              status: 'challenge_started',
              mode,
              difficulty,
              wordCount: words.length,
              message: `Word Lab challenge started! Mode: ${mode}, Difficulty: ${difficulty}. ${words.length} words to master.`,
            },
          },
        });

        sendToParent({
          type: 'STATE_UPDATE',
          messageId: generateMessageId(),
          payload: {
            state: { mode, difficulty, score: 0, wordIndex: 0, wordCount: words.length },
            summary: `New ${mode} challenge (${difficulty}) with ${words.length} words`,
          },
        });
        break;
      }

      case 'get_word_progress': {
        const gs = gameRef.current;
        if (!gs) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No active challenge. Start a challenge first.' },
          });
          return;
        }

        const masteredWords = Object.values(gs.mastery).filter(m => m.level === 'mastered').map(m => m.word);
        const learningWords = Object.values(gs.mastery).filter(m => m.level === 'learning').map(m => m.word);
        const newWords = Object.values(gs.mastery).filter(m => m.level === 'new').map(m => m.word);

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              score: gs.score,
              streak: gs.streak,
              bestStreak: gs.bestStreak,
              totalCorrect: gs.totalCorrect,
              totalAttempts: gs.totalAttempts,
              accuracy: gs.totalAttempts > 0 ? Math.round((gs.totalCorrect / gs.totalAttempts) * 100) : 0,
              mastered: masteredWords,
              learning: learningWords,
              new: newWords,
              hintsUsed: gs.hintsUsed,
              duration: Math.round((Date.now() - gs.startTime) / 1000),
            },
          },
        });
        break;
      }

      case 'get_word_hint': {
        const gs = gameRef.current;
        if (!gs) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No active challenge. Start a challenge first.' },
          });
          return;
        }

        const currentWord = gs.words[gs.currentIndex];
        if (!currentWord) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No current word.' },
          });
          return;
        }

        gs.hintsUsed += 1;
        const hint = buildHint(gs.mode, currentWord);
        setHintText(hint);
        setGameState({ ...gs });

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              hint,
              word_length: currentWord.word.length,
              category: currentWord.category,
              emoji: currentWord.emoji,
            },
          },
        });
        break;
      }

      default:
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: { result: null, error: `Unknown tool: ${toolName}` },
        });
    }
  }, [setupRound]);

  // ─── Message listener ─────────────────────────────────────────────────

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (!data || typeof data.type !== 'string') return;

      switch (data.type) {
        case 'PLUGIN_INIT':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          setInitialized(true);
          break;
        case 'TOOL_INVOKE':
          handleToolInvoke(data.messageId, data.payload.toolName, data.payload.parameters);
          break;
        case 'THEME_UPDATE':
          setTheme(data.payload?.theme || 'light');
          document.body.className = data.payload?.theme || 'light';
          break;
        case 'PLUGIN_DESTROY':
          setGameState(null);
          break;
      }
    };

    window.addEventListener('message', handler);

    sendToParent({
      type: 'PLUGIN_READY',
      messageId: generateMessageId(),
      payload: { version: '1.0.0' },
    });

    return () => window.removeEventListener('message', handler);
  }, [handleToolInvoke]);

  // ─── Hint builder ─────────────────────────────────────────────────────

  function buildHint(mode: GameMode, word: WordEntry): string {
    switch (mode) {
      case 'spelling':
        return `The word starts with "${word.word[0].toUpperCase()}" and has ${word.word.length} letters. Category: ${word.category}`;
      case 'vocabulary':
        return `This word is in the "${word.category}" category. It sounds like: ${word.phonetics}`;
      case 'phonics':
        return `The word "${word.word}" has ${word.phonetics.split('-').length} syllable(s). Think about how each part sounds.`;
      case 'word-building':
        return `The word has ${word.word.length} letters. First letter: ${word.word[0].toUpperCase()}, last letter: ${word.word[word.word.length - 1].toUpperCase()}`;
    }
  }

  // ─── Answer checking ──────────────────────────────────────────────────

  const checkSpellingAnswer = useCallback(() => {
    if (!gameState) return;
    const word = gameState.words[gameState.currentIndex];
    const built = selectedLetters.map(i => availableLetters[i]).join('').toLowerCase();
    const correct = built === word.word.toLowerCase();
    processAnswer(correct);
  }, [gameState, selectedLetters, availableLetters]);

  const checkVocabAnswer = useCallback((optionIndex: number) => {
    if (!gameState || chosenOption !== null) return;
    setChosenOption(optionIndex);
    const correct = vocabOptions[optionIndex].correct;
    processAnswer(correct);
  }, [gameState, vocabOptions, chosenOption]);

  const processAnswer = useCallback((correct: boolean) => {
    if (!gameState) return;
    const gs = { ...gameState };
    const word = gs.words[gs.currentIndex];

    gs.totalAttempts += 1;
    const mastery = gs.mastery[word.word];
    mastery.attemptCount += 1;

    if (correct) {
      gs.totalCorrect += 1;
      gs.streak += 1;
      if (gs.streak > gs.bestStreak) gs.bestStreak = gs.streak;

      // Points: base 10 + streak bonus + difficulty bonus
      const difficultyBonus = gs.difficulty === 'beginner' ? 0 : gs.difficulty === 'intermediate' ? 5 : 10;
      const streakBonus = Math.min(gs.streak * 2, 20);
      gs.score += 10 + difficultyBonus + streakBonus;

      mastery.correctCount += 1;
      if (mastery.correctCount >= 3) {
        mastery.level = 'mastered';
      } else if (mastery.correctCount >= 1) {
        mastery.level = 'learning';
      }

      setFeedback({ type: 'correct', message: getCorrectMessage() });
      setFeedbackAnim('bounce');

      // Emit word_mastered event if applicable
      if (mastery.level === 'mastered' && mastery.correctCount === 3) {
        sendToParent({
          type: 'PLUGIN_COMPLETE',
          messageId: generateMessageId(),
          payload: {
            event: 'word_mastered',
            data: { word: word.word, attempts: mastery.attemptCount },
            summary: `Mastered the word "${word.word}"!`,
          },
        });
      }
    } else {
      gs.streak = 0;
      setFeedback({ type: 'wrong', message: `Not quite! The answer is "${word.word}".` });
      setFeedbackAnim('shake');
    }

    setShowNext(true);
    setGameState(gs);
    gameRef.current = gs;

    sendToParent({
      type: 'STATE_UPDATE',
      messageId: generateMessageId(),
      payload: {
        state: {
          score: gs.score,
          streak: gs.streak,
          wordIndex: gs.currentIndex,
          word: word.word,
          correct,
          mastery: mastery.level,
        },
        summary: `${correct ? 'Correct' : 'Wrong'}: "${word.word}" (streak: ${gs.streak})`,
      },
    });
  }, [gameState]);

  function getCorrectMessage(): string {
    const msgs = [
      'Amazing!', 'Brilliant!', 'Fantastic!', 'You got it!', 'Wonderful!',
      'Superb!', 'Nailed it!', 'Excellent!', 'Great job!', 'Outstanding!',
    ];
    return msgs[Math.floor(Math.random() * msgs.length)];
  }

  const nextWord = useCallback(() => {
    if (!gameState) return;
    const gs = { ...gameState };
    gs.currentIndex += 1;

    if (gs.currentIndex >= gs.words.length) {
      // Challenge complete
      setGameState(gs);
      gameRef.current = gs;

      sendToParent({
        type: 'PLUGIN_COMPLETE',
        messageId: generateMessageId(),
        payload: {
          event: 'challenge_completed',
          data: {
            score: gs.score,
            totalCorrect: gs.totalCorrect,
            totalAttempts: gs.totalAttempts,
            accuracy: gs.totalAttempts > 0 ? Math.round((gs.totalCorrect / gs.totalAttempts) * 100) : 0,
            bestStreak: gs.bestStreak,
            mastered: Object.values(gs.mastery).filter(m => m.level === 'mastered').length,
            duration: Math.round((Date.now() - gs.startTime) / 1000),
          },
          summary: `Challenge complete! Score: ${gs.score}, Accuracy: ${Math.round((gs.totalCorrect / gs.totalAttempts) * 100)}%`,
        },
      });
      return;
    }

    setGameState(gs);
    gameRef.current = gs;
    setupRound(gs);
  }, [gameState, setupRound]);

  // ─── Letter tile handlers ─────────────────────────────────────────────

  const selectLetter = useCallback((index: number) => {
    if (selectedLetters.includes(index)) return;
    setSelectedLetters(prev => [...prev, index]);
  }, [selectedLetters]);

  const removeLetter = useCallback((posIndex: number) => {
    setSelectedLetters(prev => prev.filter((_, i) => i !== posIndex));
  }, []);

  const clearLetters = useCallback(() => {
    setSelectedLetters([]);
  }, []);

  // ─── Render ───────────────────────────────────────────────────────────

  const c = COLORS[theme];

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    maxWidth: '520px',
    margin: '0 auto',
    minHeight: '100vh',
    background: c.bg,
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  };

  // ─── Waiting screen ───────────────────────────────────────────────────

  if (!gameState) {
    return (
      <div style={containerStyle}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px 20px',
          gap: '16px',
          flex: 1,
        }}>
          <div style={{ fontSize: '48px', animation: 'wl-float 2s ease-in-out infinite' }}>
            🧪
          </div>
          <h2 style={{ color: c.primary, fontSize: '22px', fontWeight: 700, textAlign: 'center' }}>
            Spell & Learn Word Lab
          </h2>
          <p style={{ color: c.textSecondary, fontSize: '14px', textAlign: 'center', maxWidth: '300px', lineHeight: 1.5 }}>
            Waiting for the AI to start a word challenge...
          </p>
          <p style={{ color: c.textSecondary, fontSize: '13px', opacity: 0.7, textAlign: 'center' }}>
            Try asking: "Start a spelling challenge!" or "Let's practice vocabulary!"
          </p>
          <div style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
            flexWrap: 'wrap',
            justifyContent: 'center',
          }}>
            {['Spelling', 'Vocabulary', 'Phonics', 'Word Building'].map(m => (
              <span key={m} style={{
                padding: '6px 14px',
                borderRadius: '20px',
                background: c.bubbleBg,
                color: c.primary,
                fontSize: '12px',
                fontWeight: 600,
              }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ─── Challenge complete screen ────────────────────────────────────────

  if (gameState.currentIndex >= gameState.words.length) {
    const accuracy = gameState.totalAttempts > 0
      ? Math.round((gameState.totalCorrect / gameState.totalAttempts) * 100)
      : 0;
    const masteredCount = Object.values(gameState.mastery).filter(m => m.level === 'mastered').length;
    const duration = Math.round((Date.now() - gameState.startTime) / 1000);
    const minutes = Math.floor(duration / 60);
    const seconds = duration % 60;

    return (
      <div style={containerStyle}>
        <div style={{
          background: c.headerBg,
          padding: '24px 16px',
          textAlign: 'center',
          color: '#fff',
          borderRadius: '0 0 20px 20px',
        }}>
          <div style={{ fontSize: '40px', marginBottom: '8px', animation: 'wl-bounce 0.6s ease' }}>
            🎉
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, margin: 0 }}>Challenge Complete!</h2>
        </div>

        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '12px',
          }}>
            {[
              { label: 'Score', value: `${gameState.score}`, icon: '⭐' },
              { label: 'Accuracy', value: `${accuracy}%`, icon: '🎯' },
              { label: 'Best Streak', value: `${gameState.bestStreak}`, icon: '🔥' },
              { label: 'Words Mastered', value: `${masteredCount}/${gameState.words.length}`, icon: '🏆' },
              { label: 'Time', value: `${minutes}m ${seconds}s`, icon: '⏱️' },
              { label: 'Hints Used', value: `${gameState.hintsUsed}`, icon: '💡' },
            ].map(stat => (
              <div key={stat.label} style={{
                background: c.card,
                borderRadius: '12px',
                padding: '14px',
                textAlign: 'center',
                boxShadow: c.shadow,
              }}>
                <div style={{ fontSize: '20px' }}>{stat.icon}</div>
                <div style={{ fontSize: '18px', fontWeight: 700, color: c.primary, marginTop: '4px' }}>
                  {stat.value}
                </div>
                <div style={{ fontSize: '11px', color: c.textSecondary, marginTop: '2px' }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          <div style={{
            background: c.card,
            borderRadius: '12px',
            padding: '14px',
            boxShadow: c.shadow,
          }}>
            <h3 style={{ fontSize: '13px', color: c.textSecondary, marginBottom: '8px', fontWeight: 600 }}>
              Word Mastery
            </h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {Object.values(gameState.mastery).map(m => (
                <span key={m.word} style={{
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 600,
                  background: m.level === 'mastered' ? c.successBg : m.level === 'learning' ? '#FFF3E0' : c.progressBg,
                  color: m.level === 'mastered' ? c.success : m.level === 'learning' ? '#FF9800' : c.textSecondary,
                }}>
                  {m.level === 'mastered' ? '★' : m.level === 'learning' ? '◐' : '○'} {m.word}
                </span>
              ))}
            </div>
          </div>

          <p style={{ fontSize: '13px', color: c.textSecondary, textAlign: 'center', marginTop: '4px' }}>
            Ask the AI to start a new challenge!
          </p>
        </div>
      </div>
    );
  }

  // ─── Active game screen ───────────────────────────────────────────────

  const currentWord = gameState.words[gameState.currentIndex];
  const progress = ((gameState.currentIndex) / gameState.words.length) * 100;
  const builtWord = selectedLetters.map(i => availableLetters[i]).join('');
  const masteredSoFar = Object.values(gameState.mastery).filter(m => m.level === 'mastered').length;

  const modeLabel = gameState.mode === 'word-building' ? 'Word Building'
    : gameState.mode.charAt(0).toUpperCase() + gameState.mode.slice(1);

  return (
    <div style={containerStyle}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div style={{
        background: c.headerBg,
        padding: '14px 16px 18px',
        color: '#fff',
        borderRadius: '0 0 16px 16px',
        position: 'relative',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '18px' }}>🧪</span>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>Word Lab</span>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
              <span>⭐</span>
              <span style={{ fontWeight: 700 }}>{gameState.score}</span>
            </div>
            {gameState.streak > 0 && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '3px',
                fontSize: '13px',
                background: 'rgba(255,255,255,0.2)',
                padding: '2px 8px',
                borderRadius: '10px',
                animation: gameState.streak >= 3 ? 'wl-glow-pulse 1.5s infinite' : undefined,
              }}>
                <span>🔥</span>
                <span style={{ fontWeight: 700 }}>{gameState.streak}</span>
              </div>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div style={{
          height: '6px',
          background: 'rgba(255,255,255,0.25)',
          borderRadius: '3px',
          overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${progress}%`,
            background: '#fff',
            borderRadius: '3px',
            transition: 'width 0.4s ease',
          }} />
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '10px',
          marginTop: '4px',
          opacity: 0.8,
        }}>
          <span>{modeLabel} - {gameState.difficulty}</span>
          <span>{gameState.currentIndex + 1} / {gameState.words.length}</span>
        </div>
      </div>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px', flex: 1 }}>

        {/* ─── Clue Area ──────────────────────────────────────────── */}
        <div style={{
          background: c.card,
          borderRadius: '16px',
          padding: '18px',
          boxShadow: c.shadow,
          textAlign: 'center',
          animation: 'wl-pop 0.3s ease',
        }}>
          <div style={{ fontSize: '36px', marginBottom: '8px' }}>
            {currentWord.emoji}
          </div>

          {(gameState.mode === 'spelling' || gameState.mode === 'word-building') && (
            <>
              <p style={{ fontSize: '14px', color: c.text, fontWeight: 600, marginBottom: '6px' }}>
                {currentWord.definition}
              </p>
              <p style={{ fontSize: '13px', color: c.textSecondary, fontStyle: 'italic' }}>
                "{currentWord.example}"
              </p>
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '3px',
                marginTop: '10px',
              }}>
                {currentWord.word.split('').map((_, i) => (
                  <div key={i} style={{
                    width: '20px',
                    height: '3px',
                    borderRadius: '2px',
                    background: i < builtWord.length ? c.primary : c.progressBg,
                    transition: 'background 0.2s ease',
                  }} />
                ))}
              </div>
              <div style={{ fontSize: '11px', color: c.textSecondary, marginTop: '4px' }}>
                {currentWord.word.length} letters
              </div>
            </>
          )}

          {gameState.mode === 'vocabulary' && (
            <>
              <p style={{
                fontSize: '22px',
                fontWeight: 700,
                color: c.primary,
                letterSpacing: '1px',
                marginBottom: '4px',
              }}>
                {currentWord.word}
              </p>
              <p style={{ fontSize: '12px', color: c.textSecondary }}>
                Choose the correct definition:
              </p>
            </>
          )}

          {gameState.mode === 'phonics' && (
            <>
              <p style={{
                fontSize: '22px',
                fontWeight: 700,
                color: c.primary,
                letterSpacing: '1px',
                marginBottom: '4px',
              }}>
                {currentWord.word}
              </p>
              <p style={{ fontSize: '12px', color: c.textSecondary }}>
                Choose the correct pronunciation:
              </p>
            </>
          )}
        </div>

        {/* ─── Hint ───────────────────────────────────────────────── */}
        {hintText && (
          <div style={{
            background: '#FFF8E1',
            border: '1px solid #FFE082',
            borderRadius: '10px',
            padding: '10px 14px',
            fontSize: '12px',
            color: '#F57F17',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            animation: 'wl-pop 0.2s ease',
          }}>
            <span>💡</span> {hintText}
          </div>
        )}

        {/* ─── Spelling / Word Building ───────────────────────────── */}
        {(gameState.mode === 'spelling' || gameState.mode === 'word-building') && (
          <>
            {/* Built word display */}
            <div style={{
              minHeight: '52px',
              background: c.bubbleBg,
              borderRadius: '14px',
              padding: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              flexWrap: 'wrap',
              animation: feedbackAnim === 'bounce' ? 'wl-bounce 0.5s ease' : feedbackAnim === 'shake' ? 'wl-shake 0.5s ease' : undefined,
            }}>
              {selectedLetters.length === 0 ? (
                <span style={{ fontSize: '13px', color: c.textSecondary, opacity: 0.6 }}>
                  Tap letters below to spell the word
                </span>
              ) : (
                selectedLetters.map((letterIdx, posIdx) => (
                  <button
                    key={posIdx}
                    onClick={() => !showNext && removeLetter(posIdx)}
                    style={{
                      width: '38px',
                      height: '42px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '18px',
                      fontWeight: 700,
                      color: '#fff',
                      background: c.primary,
                      border: 'none',
                      borderRadius: '8px',
                      cursor: showNext ? 'default' : 'pointer',
                      animation: `wl-tile-enter 0.2s ease ${posIdx * 0.05}s both`,
                      transition: 'transform 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!showNext) (e.target as HTMLElement).style.transform = 'scale(1.08)'; }}
                    onMouseLeave={e => { (e.target as HTMLElement).style.transform = 'scale(1)'; }}
                  >
                    {availableLetters[letterIdx]}
                  </button>
                ))
              )}
            </div>

            {/* Available letter tiles */}
            {!showNext && (
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                justifyContent: 'center',
              }}>
                {availableLetters.map((letter, idx) => {
                  const isUsed = selectedLetters.includes(idx);
                  return (
                    <button
                      key={idx}
                      onClick={() => !isUsed && selectLetter(idx)}
                      disabled={isUsed}
                      style={{
                        width: '42px',
                        height: '46px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '18px',
                        fontWeight: 700,
                        color: isUsed ? c.textSecondary : c.primary,
                        background: isUsed ? 'transparent' : c.tileBg,
                        border: `2px solid ${isUsed ? 'transparent' : c.tileBorder}`,
                        borderRadius: '10px',
                        cursor: isUsed ? 'default' : 'pointer',
                        opacity: isUsed ? 0.3 : 1,
                        transition: 'all 0.15s ease',
                        animation: `wl-tile-enter 0.3s ease ${idx * 0.03}s both`,
                      }}
                      onMouseEnter={e => {
                        if (!isUsed) {
                          (e.target as HTMLElement).style.transform = 'scale(1.1)';
                          (e.target as HTMLElement).style.borderColor = c.tileSelected;
                        }
                      }}
                      onMouseLeave={e => {
                        (e.target as HTMLElement).style.transform = 'scale(1)';
                        (e.target as HTMLElement).style.borderColor = isUsed ? 'transparent' : c.tileBorder;
                      }}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Action buttons */}
            {!showNext && (
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                <button
                  onClick={clearLetters}
                  style={{
                    padding: '8px 20px',
                    borderRadius: '10px',
                    border: `2px solid ${c.tileBorder}`,
                    background: 'transparent',
                    color: c.textSecondary,
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.background = c.errorBg; }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.background = 'transparent'; }}
                >
                  Clear
                </button>
                <button
                  onClick={checkSpellingAnswer}
                  disabled={selectedLetters.length === 0}
                  style={{
                    padding: '8px 28px',
                    borderRadius: '10px',
                    border: 'none',
                    background: selectedLetters.length === 0 ? c.progressBg : c.primary,
                    color: selectedLetters.length === 0 ? c.textSecondary : '#fff',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: selectedLetters.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => {
                    if (selectedLetters.length > 0)
                      (e.target as HTMLElement).style.background = c.primaryLight;
                  }}
                  onMouseLeave={e => {
                    if (selectedLetters.length > 0)
                      (e.target as HTMLElement).style.background = c.primary;
                  }}
                >
                  Check
                </button>
              </div>
            )}
          </>
        )}

        {/* ─── Vocabulary / Phonics Choices ───────────────────────── */}
        {(gameState.mode === 'vocabulary' || gameState.mode === 'phonics') && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: feedbackAnim === 'bounce' ? 'wl-bounce 0.5s ease' : feedbackAnim === 'shake' ? 'wl-shake 0.5s ease' : undefined,
          }}>
            {vocabOptions.map((opt, idx) => {
              let bg = c.card;
              let border = `2px solid ${c.tileBorder}`;
              let textColor = c.text;

              if (chosenOption !== null) {
                if (opt.correct) {
                  bg = c.successBg;
                  border = `2px solid ${c.success}`;
                  textColor = c.success;
                } else if (idx === chosenOption && !opt.correct) {
                  bg = c.errorBg;
                  border = `2px solid ${c.error}`;
                  textColor = c.error;
                } else {
                  bg = c.card;
                  border = `2px solid transparent`;
                  textColor = c.textSecondary;
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => checkVocabAnswer(idx)}
                  disabled={chosenOption !== null}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    background: bg,
                    border,
                    color: textColor,
                    fontSize: '13px',
                    fontWeight: 500,
                    textAlign: 'left',
                    cursor: chosenOption !== null ? 'default' : 'pointer',
                    boxShadow: c.shadow,
                    transition: 'all 0.15s ease',
                    animation: `wl-tile-enter 0.3s ease ${idx * 0.06}s both`,
                    lineHeight: 1.4,
                  }}
                  onMouseEnter={e => {
                    if (chosenOption === null) {
                      (e.target as HTMLElement).style.borderColor = c.primary;
                      (e.target as HTMLElement).style.transform = 'scale(1.01)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (chosenOption === null) {
                      (e.target as HTMLElement).style.borderColor = c.tileBorder;
                      (e.target as HTMLElement).style.transform = 'scale(1)';
                    }
                  }}
                >
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    background: chosenOption !== null && opt.correct ? c.success : c.progressBg,
                    color: chosenOption !== null && opt.correct ? '#fff' : c.textSecondary,
                    fontSize: '11px',
                    fontWeight: 700,
                    marginRight: '10px',
                  }}>
                    {chosenOption !== null && opt.correct ? '✓' : String.fromCharCode(65 + idx)}
                  </span>
                  {opt.text}
                </button>
              );
            })}
          </div>
        )}

        {/* ─── Feedback ───────────────────────────────────────────── */}
        {feedback && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '12px',
            background: feedback.type === 'correct' ? c.successBg : c.errorBg,
            color: feedback.type === 'correct' ? c.success : c.error,
            fontSize: '14px',
            fontWeight: 600,
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            animation: 'wl-pop 0.3s ease',
          }}>
            <span style={{ fontSize: '20px' }}>
              {feedback.type === 'correct' ? '✅' : '❌'}
            </span>
            {feedback.message}
          </div>
        )}

        {/* ─── Next Button ────────────────────────────────────────── */}
        {showNext && (
          <button
            onClick={nextWord}
            style={{
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: c.primary,
              color: '#fff',
              fontSize: '14px',
              fontWeight: 700,
              cursor: 'pointer',
              animation: 'wl-pop 0.3s ease',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = c.primaryLight; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = c.primary; }}
          >
            {gameState.currentIndex + 1 >= gameState.words.length ? 'See Results' : 'Next Word'} →
          </button>
        )}

        {/* ─── Mastery Bar ────────────────────────────────────────── */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '8px',
          borderTop: `1px solid ${c.progressBg}`,
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '11px',
            color: c.textSecondary,
            marginBottom: '6px',
          }}>
            <span>Word Mastery</span>
            <span>{masteredSoFar} / {gameState.words.length} mastered</span>
          </div>
          <div style={{
            height: '8px',
            background: c.progressBg,
            borderRadius: '4px',
            overflow: 'hidden',
            display: 'flex',
          }}>
            <div style={{
              height: '100%',
              width: `${(masteredSoFar / gameState.words.length) * 100}%`,
              background: c.success,
              borderRadius: '4px 0 0 4px',
              transition: 'width 0.4s ease',
            }} />
            <div style={{
              height: '100%',
              width: `${(Object.values(gameState.mastery).filter(m => m.level === 'learning').length / gameState.words.length) * 100}%`,
              background: '#FFB74D',
              transition: 'width 0.4s ease',
            }} />
          </div>
          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '4px',
            fontSize: '10px',
            color: c.textSecondary,
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.success, display: 'inline-block' }} />
              Mastered
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#FFB74D', display: 'inline-block' }} />
              Learning
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.progressBg, display: 'inline-block' }} />
              New
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
