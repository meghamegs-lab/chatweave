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

type Topic = 'addition' | 'subtraction' | 'multiplication' | 'division' | 'fractions' | 'geometry';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface MathProblem {
  question: string;
  correctAnswer: number;
  choices: number[];
  hint: string;
  visualType: 'blocks' | 'fraction-pie' | 'geometry' | 'number-line' | 'none';
  visualData: any;
}

interface QuestState {
  topic: Topic;
  difficulty: Difficulty;
  score: number;
  streak: number;
  bestStreak: number;
  level: number;
  totalProblems: number;
  correctCount: number;
  currentProblem: MathProblem | null;
  problemsInLevel: number;
  stars: number;
  startTime: number;
}

type FeedbackType = 'correct' | 'wrong' | 'level-up' | null;

// ─── Problem Generation ─────────────────────────────────────────────────────

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDistractors(correct: number, count: number): number[] {
  const distractors = new Set<number>();
  // Generate plausible wrong answers near the correct answer
  const offsets = [1, -1, 2, -2, 3, -3, 5, -5, 10, -10];
  for (const off of shuffle(offsets)) {
    if (distractors.size >= count) break;
    const d = correct + off;
    if (d !== correct && d >= 0) {
      distractors.add(d);
    }
  }
  // Fill remaining with random nearby values
  while (distractors.size < count) {
    const d = correct + randInt(-15, 15);
    if (d !== correct && d >= 0) {
      distractors.add(d);
    }
  }
  return Array.from(distractors).slice(0, count);
}

function generateFractionDistractors(correctNum: number, correctDen: number, count: number): number[] {
  // For fractions, we display as decimal * 100 (to avoid floating point display issues)
  // Actually let's return raw decimal values rounded to 2 places
  const correct = Math.round((correctNum / correctDen) * 100) / 100;
  const distractors = new Set<number>();

  // Common fraction mistakes
  const candidates = [
    Math.round(((correctNum + 1) / correctDen) * 100) / 100,
    Math.round((correctNum / (correctDen + 1)) * 100) / 100,
    Math.round(((correctNum - 1) / correctDen) * 100) / 100,
    Math.round(((correctDen) / correctNum) * 100) / 100,
    Math.round(((correctNum + correctDen) / correctDen) * 100) / 100,
  ];

  for (const c of shuffle(candidates)) {
    if (distractors.size >= count) break;
    if (c !== correct && c > 0 && c < 10) {
      distractors.add(c);
    }
  }

  while (distractors.size < count) {
    const d = Math.round((correct + (Math.random() - 0.5) * 2) * 100) / 100;
    if (d !== correct && d > 0) {
      distractors.add(d);
    }
  }

  return Array.from(distractors).slice(0, count);
}

function getDifficultyRange(difficulty: Difficulty): { min: number; max: number } {
  switch (difficulty) {
    case 'beginner': return { min: 1, max: 10 };
    case 'intermediate': return { min: 5, max: 50 };
    case 'advanced': return { min: 10, max: 100 };
  }
}

function generateProblem(topic: Topic, difficulty: Difficulty): MathProblem {
  const range = getDifficultyRange(difficulty);

  switch (topic) {
    case 'addition': {
      const a = randInt(range.min, range.max);
      const b = randInt(range.min, range.max);
      const answer = a + b;
      const distractors = generateDistractors(answer, 3);
      return {
        question: `${a} + ${b} = ?`,
        correctAnswer: answer,
        choices: shuffle([answer, ...distractors]),
        hint: `Try counting ${a} blocks, then add ${b} more blocks.`,
        visualType: difficulty === 'beginner' ? 'blocks' : 'none',
        visualData: { a, b, operation: '+' },
      };
    }

    case 'subtraction': {
      const b = randInt(range.min, range.max);
      const a = b + randInt(range.min, range.max); // ensure positive result
      const answer = a - b;
      const distractors = generateDistractors(answer, 3);
      return {
        question: `${a} - ${b} = ?`,
        correctAnswer: answer,
        choices: shuffle([answer, ...distractors]),
        hint: `Start with ${a} blocks and take away ${b}. How many are left?`,
        visualType: difficulty === 'beginner' ? 'blocks' : 'none',
        visualData: { a, b, operation: '-' },
      };
    }

    case 'multiplication': {
      const maxMul = difficulty === 'beginner' ? 5 : difficulty === 'intermediate' ? 12 : 15;
      const a = randInt(2, maxMul);
      const b = randInt(2, maxMul);
      const answer = a * b;
      const distractors = generateDistractors(answer, 3);
      return {
        question: `${a} x ${b} = ?`,
        correctAnswer: answer,
        choices: shuffle([answer, ...distractors]),
        hint: `Think of ${a} groups with ${b} in each group.`,
        visualType: difficulty === 'beginner' ? 'blocks' : 'none',
        visualData: { a, b, operation: 'x' },
      };
    }

    case 'division': {
      const maxDiv = difficulty === 'beginner' ? 5 : difficulty === 'intermediate' ? 12 : 15;
      const b = randInt(2, maxDiv);
      const answer = randInt(2, maxDiv);
      const a = b * answer; // ensure clean division
      const distractors = generateDistractors(answer, 3);
      return {
        question: `${a} / ${b} = ?`,
        correctAnswer: answer,
        choices: shuffle([answer, ...distractors]),
        hint: `If you split ${a} items into ${b} equal groups, how many in each group?`,
        visualType: difficulty === 'beginner' ? 'blocks' : 'none',
        visualData: { a, b, operation: '/' },
      };
    }

    case 'fractions': {
      if (difficulty === 'beginner') {
        // Simple: what fraction is shaded?
        const den = randInt(2, 6);
        const num = randInt(1, den - 1);
        const answer = Math.round((num / den) * 100) / 100;
        const distractors = generateFractionDistractors(num, den, 3);
        return {
          question: `What is ${num}/${den} as a decimal?`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `Divide the numerator (${num}) by the denominator (${den}).`,
          visualType: 'fraction-pie',
          visualData: { numerator: num, denominator: den },
        };
      } else if (difficulty === 'intermediate') {
        // Add two fractions with same denominator
        const den = randInt(3, 8);
        const n1 = randInt(1, den - 1);
        const n2 = randInt(1, den - n1);
        const answerNum = n1 + n2;
        const answer = Math.round((answerNum / den) * 100) / 100;
        const distractors = generateFractionDistractors(answerNum, den, 3);
        return {
          question: `${n1}/${den} + ${n2}/${den} = ? (decimal)`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `When denominators are the same, just add the numerators: ${n1} + ${n2} = ${answerNum}, then divide by ${den}.`,
          visualType: 'fraction-pie',
          visualData: { numerator: answerNum, denominator: den },
        };
      } else {
        // Multiply fractions
        const n1 = randInt(1, 5);
        const d1 = randInt(2, 6);
        const n2 = randInt(1, 5);
        const d2 = randInt(2, 6);
        const answerNum = n1 * n2;
        const answerDen = d1 * d2;
        const answer = Math.round((answerNum / answerDen) * 100) / 100;
        const distractors = generateFractionDistractors(answerNum, answerDen, 3);
        return {
          question: `${n1}/${d1} x ${n2}/${d2} = ? (decimal)`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `Multiply numerators: ${n1} x ${n2} = ${answerNum}. Multiply denominators: ${d1} x ${d2} = ${answerDen}. Then divide.`,
          visualType: 'fraction-pie',
          visualData: { numerator: answerNum, denominator: answerDen },
        };
      }
    }

    case 'geometry': {
      if (difficulty === 'beginner') {
        // Perimeter of rectangle
        const w = randInt(2, 10);
        const h = randInt(2, 10);
        const answer = 2 * (w + h);
        const distractors = generateDistractors(answer, 3);
        return {
          question: `Perimeter of a rectangle: width=${w}, height=${h}`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `Perimeter = 2 x (width + height) = 2 x (${w} + ${h})`,
          visualType: 'geometry',
          visualData: { shape: 'rectangle', width: w, height: h },
        };
      } else if (difficulty === 'intermediate') {
        // Area of rectangle
        const w = randInt(3, 15);
        const h = randInt(3, 15);
        const answer = w * h;
        const distractors = generateDistractors(answer, 3);
        return {
          question: `Area of a rectangle: width=${w}, height=${h}`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `Area = width x height = ${w} x ${h}`,
          visualType: 'geometry',
          visualData: { shape: 'rectangle', width: w, height: h },
        };
      } else {
        // Area of triangle
        const base = randInt(4, 20);
        const height = randInt(4, 20);
        const answer = Math.round((base * height) / 2 * 100) / 100;
        const distractors = generateDistractors(Math.round(answer), 3).map(d => d);
        return {
          question: `Area of a triangle: base=${base}, height=${height}`,
          correctAnswer: answer,
          choices: shuffle([answer, ...distractors]),
          hint: `Area = (base x height) / 2 = (${base} x ${height}) / 2`,
          visualType: 'geometry',
          visualData: { shape: 'triangle', base, height },
        };
      }
    }
  }
}

// ─── Visual Components (SVG-based) ─────────────────────────────────────────

function BlocksVisual({ data, isDark }: { data: any; isDark: boolean }) {
  const { a, b, operation } = data;
  const maxBlocks = 20;
  const showA = Math.min(a, maxBlocks);
  const showB = Math.min(b, maxBlocks);
  const blockSize = 18;
  const gap = 3;
  const cols = 10;

  const renderBlocks = (count: number, color: string, startX: number) => {
    const blocks = [];
    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      blocks.push(
        <rect
          key={i}
          x={startX + col * (blockSize + gap)}
          y={row * (blockSize + gap)}
          width={blockSize}
          height={blockSize}
          rx={3}
          fill={color}
          opacity={0.85}
        />
      );
    }
    return blocks;
  };

  const totalWidth = cols * (blockSize + gap);
  const rowsA = Math.ceil(showA / cols);
  const rowsB = Math.ceil(showB / cols);
  const maxRows = Math.max(rowsA, rowsB);
  const svgHeight = maxRows * (blockSize + gap) + 10;

  return (
    <svg width={totalWidth * 2 + 40} height={svgHeight} style={{ display: 'block', margin: '0 auto' }}>
      {renderBlocks(showA, '#6C5CE7', 0)}
      <text
        x={totalWidth + 10}
        y={svgHeight / 2 + 6}
        textAnchor="middle"
        fontSize="20"
        fontWeight="bold"
        fill={isDark ? '#eee' : '#333'}
      >
        {operation}
      </text>
      {renderBlocks(showB, '#00B894', totalWidth + 25)}
      {a > maxBlocks && (
        <text x={totalWidth / 2} y={svgHeight - 2} textAnchor="middle" fontSize="10" fill={isDark ? '#aaa' : '#888'}>
          (showing {maxBlocks} of {a})
        </text>
      )}
    </svg>
  );
}

function FractionPieVisual({ data, isDark }: { data: any; isDark: boolean }) {
  const { numerator, denominator } = data;
  const size = 100;
  const cx = size;
  const cy = size;
  const r = 80;

  const slices = [];
  for (let i = 0; i < denominator; i++) {
    const startAngle = (i / denominator) * 2 * Math.PI - Math.PI / 2;
    const endAngle = ((i + 1) / denominator) * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
    const filled = i < numerator;

    slices.push(
      <path
        key={i}
        d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`}
        fill={filled ? '#6C5CE7' : (isDark ? '#2d2d4e' : '#e8e8f0')}
        stroke={isDark ? '#555' : '#ccc'}
        strokeWidth={2}
      />
    );
  }

  return (
    <svg width={size * 2} height={size * 2} style={{ display: 'block', margin: '0 auto' }}>
      {slices}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="18" fontWeight="bold" fill={isDark ? '#eee' : '#333'}>
        {numerator}/{denominator}
      </text>
    </svg>
  );
}

function GeometryVisual({ data, isDark }: { data: any; isDark: boolean }) {
  const { shape, width, height, base } = data;
  const svgW = 220;
  const svgH = 140;
  const pad = 20;

  if (shape === 'rectangle') {
    const scaleX = (svgW - pad * 2) / Math.max(width, 1);
    const scaleY = (svgH - pad * 2) / Math.max(height, 1);
    const scale = Math.min(scaleX, scaleY, 12);
    const rw = width * scale;
    const rh = height * scale;
    const rx = (svgW - rw) / 2;
    const ry = (svgH - rh) / 2;

    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
        <rect x={rx} y={ry} width={rw} height={rh} fill="#6C5CE7" opacity={0.2} stroke="#6C5CE7" strokeWidth={2} rx={4} />
        <text x={rx + rw / 2} y={ry + rh + 16} textAnchor="middle" fontSize="12" fill={isDark ? '#ccc' : '#555'}>{width}</text>
        <text x={rx - 14} y={ry + rh / 2 + 4} textAnchor="middle" fontSize="12" fill={isDark ? '#ccc' : '#555'}>{height}</text>
      </svg>
    );
  }

  if (shape === 'triangle') {
    const scaleX = (svgW - pad * 2) / Math.max(base, 1);
    const scaleY = (svgH - pad * 2) / Math.max(height, 1);
    const scale = Math.min(scaleX, scaleY, 10);
    const tw = base * scale;
    const th = height * scale;
    const startX = (svgW - tw) / 2;
    const startY = svgH - pad;

    const points = `${startX},${startY} ${startX + tw},${startY} ${startX + tw / 2},${startY - th}`;

    return (
      <svg width={svgW} height={svgH} style={{ display: 'block', margin: '0 auto' }}>
        <polygon points={points} fill="#00B894" opacity={0.2} stroke="#00B894" strokeWidth={2} />
        <text x={startX + tw / 2} y={startY + 16} textAnchor="middle" fontSize="12" fill={isDark ? '#ccc' : '#555'}>base={base}</text>
        <line x1={startX + tw / 2} y1={startY} x2={startX + tw / 2} y2={startY - th} stroke={isDark ? '#aaa' : '#888'} strokeWidth={1} strokeDasharray="4" />
        <text x={startX + tw / 2 + 18} y={startY - th / 2 + 4} fontSize="12" fill={isDark ? '#ccc' : '#555'}>h={height}</text>
      </svg>
    );
  }

  return null;
}

// ─── Stars Display ──────────────────────────────────────────────────────────

function StarsDisplay({ count }: { count: number }) {
  const stars = [];
  for (let i = 0; i < Math.min(count, 20); i++) {
    stars.push(
      <span key={i} style={{ fontSize: '20px', marginRight: '2px', filter: 'drop-shadow(0 0 2px gold)' }}>
        {'★'}
      </span>
    );
  }
  return <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center' }}>{stars}</div>;
}

// ─── Topic Icons ────────────────────────────────────────────────────────────

function getTopicEmoji(topic: Topic): string {
  switch (topic) {
    case 'addition': return '+';
    case 'subtraction': return '-';
    case 'multiplication': return 'x';
    case 'division': return '/';
    case 'fractions': return 'pie';
    case 'geometry': return 'shape';
  }
}

function getTopicColor(topic: Topic): string {
  switch (topic) {
    case 'addition': return '#6C5CE7';
    case 'subtraction': return '#E17055';
    case 'multiplication': return '#00B894';
    case 'division': return '#0984E3';
    case 'fractions': return '#E84393';
    case 'geometry': return '#FDCB6E';
  }
}

// ─── Main App ───────────────────────────────────────────────────────────────

export default function App() {
  const [quest, setQuest] = useState<QuestState | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [feedback, setFeedback] = useState<FeedbackType>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [timer, setTimer] = useState(0);
  const [celebrationVisible, setCelebrationVisible] = useState(false);
  const [shakeWrong, setShakeWrong] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const questRef = useRef<QuestState | null>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    questRef.current = quest;
  }, [quest]);

  // Timer
  useEffect(() => {
    if (quest && quest.currentProblem && !feedback) {
      timerRef.current = window.setInterval(() => {
        setTimer(t => t + 1);
      }, 1000);
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }, [quest?.currentProblem, feedback]);

  // Generate next problem
  const nextProblem = useCallback((state: QuestState) => {
    const problem = generateProblem(state.topic, state.difficulty);
    state.currentProblem = problem;
    state.totalProblems++;
    setTimer(0);
    setShowHint(false);
    setSelectedAnswer(null);
    setFeedback(null);
    setQuest({ ...state });
  }, []);

  // Handle answer selection
  const handleAnswer = useCallback((answer: number) => {
    if (!quest || !quest.currentProblem || feedback) return;

    setSelectedAnswer(answer);
    const isCorrect = answer === quest.currentProblem.correctAnswer;

    if (isCorrect) {
      setFeedback('correct');
      quest.score += 10 + Math.max(0, 30 - timer); // Bonus for speed
      quest.streak++;
      quest.correctCount++;
      if (quest.streak > quest.bestStreak) quest.bestStreak = quest.streak;
      quest.problemsInLevel++;

      // Stars: earn a star every 3 correct
      if (quest.correctCount % 3 === 0) {
        quest.stars++;
      }

      // Level up every 5 correct in a level
      if (quest.problemsInLevel >= 5) {
        quest.level++;
        quest.problemsInLevel = 0;

        // Send level up event
        sendToParent({
          type: 'PLUGIN_COMPLETE',
          messageId: generateMessageId(),
          payload: {
            event: 'level_up',
            data: { level: quest.level, score: quest.score, stars: quest.stars },
            summary: `Level up! Now at level ${quest.level} with ${quest.stars} stars.`,
          },
        });

        setTimeout(() => {
          setFeedback('level-up');
          setCelebrationVisible(true);
          setTimeout(() => {
            setCelebrationVisible(false);
            setFeedback(null);
            nextProblem(quest);
          }, 2500);
        }, 800);

        setQuest({ ...quest });
        return;
      }

      // Auto-advance after short delay
      setTimeout(() => {
        nextProblem(quest);
      }, 1200);
    } else {
      setFeedback('wrong');
      setShakeWrong(true);
      quest.streak = 0;

      setTimeout(() => {
        setShakeWrong(false);
      }, 500);

      // Allow retry after short delay
      setTimeout(() => {
        setFeedback(null);
        setSelectedAnswer(null);
      }, 1500);
    }

    setQuest({ ...quest });

    // Send state update
    sendToParent({
      type: 'STATE_UPDATE',
      messageId: generateMessageId(),
      payload: {
        state: {
          score: quest.score,
          streak: quest.streak,
          level: quest.level,
          correctCount: quest.correctCount,
          totalProblems: quest.totalProblems,
        },
        summary: isCorrect
          ? `Correct! Score: ${quest.score}, Streak: ${quest.streak}`
          : `Incorrect. The answer was ${quest.currentProblem.correctAnswer}. Streak reset.`,
      },
    });
  }, [quest, feedback, timer, nextProblem]);

  // Handle tool invocations
  const handleToolInvoke = useCallback((messageId: string, toolName: string, parameters: Record<string, any>) => {
    switch (toolName) {
      case 'start_math_quest': {
        const topic: Topic = parameters.topic || 'addition';
        const difficulty: Difficulty = parameters.difficulty || 'beginner';
        const newQuest: QuestState = {
          topic,
          difficulty,
          score: 0,
          streak: 0,
          bestStreak: 0,
          level: 1,
          totalProblems: 0,
          correctCount: 0,
          currentProblem: null,
          problemsInLevel: 0,
          stars: 0,
          startTime: Date.now(),
        };

        const problem = generateProblem(topic, difficulty);
        newQuest.currentProblem = problem;
        newQuest.totalProblems = 1;
        setQuest(newQuest);
        questRef.current = newQuest;
        setTimer(0);
        setShowHint(false);
        setFeedback(null);
        setSelectedAnswer(null);

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              status: 'quest_started',
              topic,
              difficulty,
              level: 1,
              message: `Math Quest started! Topic: ${topic}, Difficulty: ${difficulty}. Level 1 - solve 5 problems to level up!`,
            },
          },
        });

        sendToParent({
          type: 'STATE_UPDATE',
          messageId: generateMessageId(),
          payload: {
            state: { topic, difficulty, level: 1, score: 0 },
            summary: `New math quest: ${topic} at ${difficulty} difficulty`,
          },
        });
        break;
      }

      case 'get_quest_progress': {
        const qs = questRef.current;
        if (!qs) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No active quest. Start a quest first.' },
          });
          return;
        }
        const accuracy = qs.totalProblems > 0
          ? Math.round((qs.correctCount / qs.totalProblems) * 100)
          : 0;
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              topic: qs.topic,
              difficulty: qs.difficulty,
              score: qs.score,
              level: qs.level,
              streak: qs.streak,
              bestStreak: qs.bestStreak,
              totalProblems: qs.totalProblems,
              correctCount: qs.correctCount,
              accuracy: `${accuracy}%`,
              stars: qs.stars,
              duration: Math.round((Date.now() - qs.startTime) / 1000),
            },
          },
        });
        break;
      }

      case 'get_hint': {
        const qs = questRef.current;
        if (!qs || !qs.currentProblem) {
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: 'No current problem to get a hint for.' },
          });
          return;
        }
        setShowHint(true);
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              hint: qs.currentProblem.hint,
              problem: qs.currentProblem.question,
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
  }, []);

  // Listen for messages from the platform
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
          setQuest(null);
          break;
      }
    };

    window.addEventListener('message', handler);

    // Send PLUGIN_READY
    sendToParent({
      type: 'PLUGIN_READY',
      messageId: generateMessageId(),
      payload: { version: '1.0.0' },
    });

    return () => window.removeEventListener('message', handler);
  }, [handleToolInvoke]);

  const isDark = theme === 'dark';

  // ─── Styles ─────────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '16px',
    gap: '10px',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    position: 'relative',
    overflow: 'hidden',
  };

  const headerStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    padding: '8px 12px',
    borderRadius: '12px',
    background: isDark ? '#2d2d4e' : '#f0f0ff',
  };

  const statBoxStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    fontSize: '11px',
    color: isDark ? '#aaa' : '#777',
  };

  const statValueStyle: React.CSSProperties = {
    fontSize: '18px',
    fontWeight: 700,
    color: isDark ? '#eee' : '#333',
  };

  const progressBarOuter: React.CSSProperties = {
    width: '100%',
    height: '10px',
    background: isDark ? '#333' : '#e0e0e0',
    borderRadius: '5px',
    overflow: 'hidden',
  };

  const questionStyle: React.CSSProperties = {
    fontSize: '28px',
    fontWeight: 700,
    textAlign: 'center',
    padding: '12px 0',
    color: isDark ? '#fff' : '#222',
    animation: shakeWrong ? 'shake 0.5s ease-in-out' : 'none',
  };

  const choiceGridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '10px',
    width: '100%',
    maxWidth: '360px',
  };

  const getChoiceStyle = (choice: number): React.CSSProperties => {
    let bg = isDark ? '#2d2d4e' : '#f5f5ff';
    let border = isDark ? '#444' : '#ddd';
    let color = isDark ? '#eee' : '#333';

    if (selectedAnswer !== null && quest?.currentProblem) {
      if (choice === quest.currentProblem.correctAnswer && feedback === 'correct') {
        bg = '#00B894';
        border = '#00B894';
        color = '#fff';
      } else if (choice === selectedAnswer && feedback === 'wrong') {
        bg = '#E17055';
        border = '#E17055';
        color = '#fff';
      }
    }

    return {
      padding: '16px',
      fontSize: '20px',
      fontWeight: 600,
      borderRadius: '14px',
      border: `2px solid ${border}`,
      background: bg,
      color,
      cursor: feedback ? 'default' : 'pointer',
      transition: 'all 0.2s ease',
      textAlign: 'center',
      userSelect: 'none',
    };
  };

  const hintStyle: React.CSSProperties = {
    padding: '10px 16px',
    borderRadius: '10px',
    background: isDark ? '#2a2a44' : '#fff8e1',
    border: `1px solid ${isDark ? '#444' : '#ffe082'}`,
    fontSize: '13px',
    color: isDark ? '#ffd54f' : '#f57f17',
    textAlign: 'center',
    width: '100%',
    maxWidth: '360px',
  };

  const timerStyle: React.CSSProperties = {
    fontSize: '12px',
    color: timer > 20 ? '#E17055' : (isDark ? '#888' : '#aaa'),
    fontWeight: timer > 20 ? 600 : 400,
  };

  // ─── Celebration Overlay ────────────────────────────────────────────────

  const celebrationOverlay: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(108, 92, 231, 0.95)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: '16px',
    zIndex: 100,
    animation: 'fadeIn 0.3s ease',
  };

  // ─── Waiting state ──────────────────────────────────────────────────────

  if (!quest) {
    return (
      <div style={containerStyle}>
        <div style={{
          marginTop: '60px',
          textAlign: 'center',
        }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={{ margin: '0 auto 16px', display: 'block' }}>
            <circle cx="40" cy="40" r="36" fill="#6C5CE7" opacity={0.15} />
            <text x="40" y="48" textAnchor="middle" fontSize="32" fontWeight="bold" fill="#6C5CE7">
              {"?"}
            </text>
            <text x="18" y="26" fontSize="16" fill="#E17055">+</text>
            <text x="58" y="22" fontSize="14" fill="#00B894">x</text>
            <text x="14" y="58" fontSize="14" fill="#0984E3">/</text>
            <text x="60" y="62" fontSize="16" fill="#FDCB6E">-</text>
          </svg>
          <p style={{
            fontSize: '18px',
            fontWeight: 600,
            color: isDark ? '#ccc' : '#555',
            marginBottom: '8px',
          }}>
            Ready for a Math Quest!
          </p>
          <p style={{
            fontSize: '13px',
            color: isDark ? '#888' : '#999',
            lineHeight: 1.5,
          }}>
            Ask the chatbot: "Start a math quest!" or{' '}
            "Let's practice multiplication!"
          </p>
        </div>
      </div>
    );
  }

  const topicColor = getTopicColor(quest.topic);
  const progressPercent = (quest.problemsInLevel / 5) * 100;
  const accuracy = quest.totalProblems > 0
    ? Math.round((quest.correctCount / quest.totalProblems) * 100)
    : 0;

  return (
    <div style={containerStyle}>
      {/* Inject keyframes */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-6px); }
          80% { transform: translateX(6px); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes popIn {
          0% { transform: scale(0); }
          60% { transform: scale(1.2); }
          100% { transform: scale(1); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes confetti {
          0% { transform: translateY(0) rotate(0deg); opacity: 1; }
          100% { transform: translateY(100px) rotate(720deg); opacity: 0; }
        }
      `}</style>

      {/* Header Stats */}
      <div style={headerStyle}>
        <div style={statBoxStyle}>
          <span style={statValueStyle}>{quest.score}</span>
          <span>Score</span>
        </div>
        <div style={statBoxStyle}>
          <span style={{ ...statValueStyle, color: quest.streak >= 3 ? '#FDCB6E' : statValueStyle.color }}>
            {quest.streak}{quest.streak >= 3 ? ' fire' : ''}
          </span>
          <span>Streak</span>
        </div>
        <div style={statBoxStyle}>
          <span style={{ ...statValueStyle, color: topicColor }}>{quest.level}</span>
          <span>Level</span>
        </div>
        <div style={statBoxStyle}>
          <span style={statValueStyle}>{accuracy}%</span>
          <span>Accuracy</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div style={{ width: '100%' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: isDark ? '#888' : '#aaa', marginBottom: '4px' }}>
          <span>Level {quest.level} Progress</span>
          <span>{quest.problemsInLevel}/5 to next level</span>
        </div>
        <div style={progressBarOuter}>
          <div style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: `linear-gradient(90deg, ${topicColor}, ${topicColor}dd)`,
            borderRadius: '5px',
            transition: 'width 0.5s ease',
          }} />
        </div>
      </div>

      {/* Stars */}
      {quest.stars > 0 && <StarsDisplay count={quest.stars} />}

      {/* Timer */}
      <div style={timerStyle}>
        Time: {timer}s
      </div>

      {/* Topic Badge */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 12px',
        borderRadius: '20px',
        background: topicColor + '22',
        color: topicColor,
        fontSize: '12px',
        fontWeight: 600,
        textTransform: 'capitalize',
      }}>
        {getTopicEmoji(quest.topic)} {quest.topic} - {quest.difficulty}
      </div>

      {/* Visual Area */}
      {quest.currentProblem && quest.currentProblem.visualType !== 'none' && (
        <div style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'center',
          padding: '4px 0',
        }}>
          {quest.currentProblem.visualType === 'blocks' && (
            <BlocksVisual data={quest.currentProblem.visualData} isDark={isDark} />
          )}
          {quest.currentProblem.visualType === 'fraction-pie' && (
            <FractionPieVisual data={quest.currentProblem.visualData} isDark={isDark} />
          )}
          {quest.currentProblem.visualType === 'geometry' && (
            <GeometryVisual data={quest.currentProblem.visualData} isDark={isDark} />
          )}
        </div>
      )}

      {/* Question */}
      {quest.currentProblem && (
        <div style={questionStyle}>
          {quest.currentProblem.question}
        </div>
      )}

      {/* Feedback Icon */}
      {feedback === 'correct' && (
        <div style={{
          fontSize: '36px',
          color: '#00B894',
          fontWeight: 900,
          animation: 'popIn 0.4s ease',
          lineHeight: 1,
        }}>
          Correct!
        </div>
      )}
      {feedback === 'wrong' && (
        <div style={{
          fontSize: '24px',
          color: '#E17055',
          fontWeight: 700,
          animation: 'popIn 0.3s ease',
          lineHeight: 1,
        }}>
          Try again!
        </div>
      )}

      {/* Answer Choices */}
      {quest.currentProblem && (
        <div style={choiceGridStyle}>
          {quest.currentProblem.choices.map((choice, i) => (
            <button
              key={`${quest.totalProblems}-${i}`}
              style={getChoiceStyle(choice)}
              onClick={() => handleAnswer(choice)}
              onMouseEnter={(e) => {
                if (!feedback) {
                  (e.target as HTMLElement).style.transform = 'scale(1.05)';
                  (e.target as HTMLElement).style.boxShadow = `0 4px 12px ${topicColor}44`;
                }
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.transform = 'scale(1)';
                (e.target as HTMLElement).style.boxShadow = 'none';
              }}
              disabled={feedback === 'correct'}
            >
              {choice}
            </button>
          ))}
        </div>
      )}

      {/* Hint */}
      {showHint && quest.currentProblem && (
        <div style={hintStyle}>
          Hint: {quest.currentProblem.hint}
        </div>
      )}

      {/* Footer info */}
      <div style={{ fontSize: '11px', color: isDark ? '#666' : '#bbb', marginTop: '4px' }}>
        Problem #{quest.totalProblems} | Best streak: {quest.bestStreak}
      </div>

      {/* Level Up Celebration Overlay */}
      {celebrationVisible && (
        <div style={celebrationOverlay}>
          {/* Confetti particles */}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '20%',
                left: `${15 + (i * 6)}%`,
                width: '8px',
                height: '8px',
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                background: ['#FDCB6E', '#E17055', '#00B894', '#0984E3', '#E84393', '#6C5CE7'][i % 6],
                animation: `confetti ${1 + Math.random()}s ease-out ${Math.random() * 0.5}s forwards`,
              }}
            />
          ))}
          <div style={{
            fontSize: '48px',
            animation: 'float 1s ease-in-out infinite',
            marginBottom: '12px',
          }}>
            {'★'}
          </div>
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            color: '#fff',
            marginBottom: '8px',
            animation: 'popIn 0.5s ease',
          }}>
            Level Up!
          </div>
          <div style={{
            fontSize: '18px',
            color: '#ffffffcc',
            fontWeight: 500,
          }}>
            You reached Level {quest.level}!
          </div>
          <div style={{
            fontSize: '14px',
            color: '#ffffffaa',
            marginTop: '8px',
          }}>
            Score: {quest.score} | Stars: {quest.stars}
          </div>
        </div>
      )}
    </div>
  );
}
