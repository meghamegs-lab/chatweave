import { useState, useEffect, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Inline SDK bridge (same pattern as chess plugin)
// ---------------------------------------------------------------------------
let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type Activity = 'counting' | 'making-change' | 'budgeting' | 'shopping' | 'saving';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface MoneyItem {
  type: 'coin' | 'bill';
  label: string;
  value: number; // in cents
  color: string;
  size: number; // radius for coins, width for bills
}

interface CountingChallenge {
  items: MoneyItem[];
  correctTotal: number; // cents
}

interface ChangeChallenge {
  itemName: string;
  itemPrice: number; // cents
  amountPaid: number; // cents
  correctChange: number; // cents
}

interface BudgetCategory {
  name: string;
  emoji: string;
  amount: number;
}

interface ShopItem {
  name: string;
  price: number; // cents
  emoji: string;
  value: number; // 1-5 stars
}

interface SavingGoal {
  name: string;
  emoji: string;
  target: number; // cents
  saved: number;
  week: number;
  weeklyAllowance: number;
  decisions: { week: number; saved: number; spent: number }[];
}

interface Achievement {
  id: string;
  name: string;
  emoji: string;
  unlocked: boolean;
}

interface GameProgress {
  totalScore: number;
  streak: number;
  lessonsCompleted: number;
  achievements: Achievement[];
  activitiesCompleted: Record<Activity, number>;
}

interface LessonState {
  activity: Activity;
  difficulty: Difficulty;
  startTime: number;
  // Activity-specific state
  counting?: CountingChallenge & { selected: number[]; userTotal: number };
  change?: ChangeChallenge & { userAnswer: string };
  budget?: { allowance: number; categories: BudgetCategory[]; remaining: number };
  shopping?: { budget: number; items: ShopItem[]; cart: number[]; total: number };
  saving?: SavingGoal;
  // Common
  feedback: string | null;
  feedbackType: 'success' | 'error' | 'info' | null;
  completed: boolean;
  score: number;
}

// ---------------------------------------------------------------------------
// Money definitions
// ---------------------------------------------------------------------------
const COINS: MoneyItem[] = [
  { type: 'coin', label: '1\u00a2', value: 1, color: '#b87333', size: 14 },
  { type: 'coin', label: '5\u00a2', value: 5, color: '#a8a9ad', size: 16 },
  { type: 'coin', label: '10\u00a2', value: 10, color: '#c0c0c0', size: 13 },
  { type: 'coin', label: '25\u00a2', value: 25, color: '#c0c0c0', size: 18 },
];

const BILLS: MoneyItem[] = [
  { type: 'bill', label: '$1', value: 100, color: '#85bb65', size: 60 },
  { type: 'bill', label: '$5', value: 500, color: '#85bb65', size: 60 },
  { type: 'bill', label: '$10', value: 1000, color: '#85bb65', size: 60 },
  { type: 'bill', label: '$20', value: 2000, color: '#85bb65', size: 60 },
];

const SHOP_ITEMS_POOL: Omit<ShopItem, 'price'>[] = [
  { name: 'Apple', emoji: '\ud83c\udf4e', value: 2 },
  { name: 'Banana', emoji: '\ud83c\udf4c', value: 2 },
  { name: 'Juice Box', emoji: '\ud83e\uddc3', value: 3 },
  { name: 'Sandwich', emoji: '\ud83e\udd6a', value: 4 },
  { name: 'Cookie', emoji: '\ud83c\udf6a', value: 2 },
  { name: 'Pencil', emoji: '\u270f\ufe0f', value: 3 },
  { name: 'Notebook', emoji: '\ud83d\udcd3', value: 3 },
  { name: 'Stickers', emoji: '\u2b50', value: 4 },
  { name: 'Toy Car', emoji: '\ud83d\ude97', value: 5 },
  { name: 'Book', emoji: '\ud83d\udcd6', value: 5 },
  { name: 'Ball', emoji: '\u26bd', value: 4 },
  { name: 'Crayons', emoji: '\ud83d\udd8d\ufe0f', value: 3 },
  { name: 'Puzzle', emoji: '\ud83e\udde9', value: 4 },
  { name: 'Candy', emoji: '\ud83c\udf6c', value: 1 },
  { name: 'Water Bottle', emoji: '\ud83d\udca7', value: 3 },
];

const SAVING_GOALS = [
  { name: 'Video Game', emoji: '\ud83c\udfae', target: 6000 },
  { name: 'Bicycle', emoji: '\ud83d\udeb2', target: 12000 },
  { name: 'Skateboard', emoji: '\ud83d\udef9', target: 4500 },
  { name: 'Art Set', emoji: '\ud83c\udfa8', target: 3500 },
  { name: 'Headphones', emoji: '\ud83c\udfa7', target: 8000 },
];

const MONEY_TIPS: Record<Activity, string[]> = {
  counting: [
    'Start by grouping the same coins together before counting!',
    'Count quarters first (25\u00a2 each) -- they add up fastest!',
    'Try counting by 5s for nickels and 10s for dimes.',
    'Remember: 4 quarters = $1.00!',
  ],
  'making-change': [
    'Subtract the price from what was paid to find the change.',
    'Start with the largest bill or coin and work down.',
    'Count up from the price to the amount paid.',
    'Double-check by adding the change back to the price!',
  ],
  budgeting: [
    'A good rule: Save at least 20% of your money!',
    'Think about what you need vs. what you want.',
    'Sharing money helps your community and feels great!',
    'Track every dollar -- small amounts add up!',
  ],
  shopping: [
    'Make a list before you shop to avoid impulse buys.',
    'Compare prices -- the cheapest option is not always the best value.',
    'Stars show quality -- sometimes paying more is worth it!',
    'Keep a running total so you do not overspend!',
  ],
  saving: [
    'Even saving a little each week adds up over time!',
    'Set a clear goal so you know what you are saving for.',
    'It is okay to spend some -- just keep saving toward your goal.',
    'The longer you save, the faster it feels near the end!',
  ],
};

const DEFAULT_ACHIEVEMENTS: Achievement[] = [
  { id: 'first_dollar', name: 'First Dollar', emoji: '\ud83d\udcb5', unlocked: false },
  { id: 'budget_master', name: 'Budget Master', emoji: '\ud83d\udcca', unlocked: false },
  { id: 'change_champion', name: 'Change Champion', emoji: '\ud83c\udfc6', unlocked: false },
  { id: 'smart_shopper', name: 'Smart Shopper', emoji: '\ud83d\uded2', unlocked: false },
  { id: 'super_saver', name: 'Super Saver', emoji: '\ud83d\udcb0', unlocked: false },
  { id: 'streak_3', name: '3 in a Row!', emoji: '\ud83d\udd25', unlocked: false },
  { id: 'streak_5', name: '5 Streak!', emoji: '\u26a1', unlocked: false },
  { id: 'ten_lessons', name: 'Ten Lessons', emoji: '\ud83c\udf93', unlocked: false },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function formatCents(cents: number): string {
  if (cents < 100) return `${cents}\u00a2`;
  const dollars = Math.floor(cents / 100);
  const remainder = cents % 100;
  return remainder === 0 ? `$${dollars}.00` : `$${dollars}.${String(remainder).padStart(2, '0')}`;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------------------------------------------------------------------------
// Challenge generators
// ---------------------------------------------------------------------------
function generateCountingChallenge(difficulty: Difficulty): CountingChallenge {
  const items: MoneyItem[] = [];
  if (difficulty === 'beginner') {
    // Coins only, 3-6 items, total < $5
    const count = randInt(3, 6);
    for (let i = 0; i < count; i++) {
      items.push({ ...COINS[randInt(0, COINS.length - 1)] });
    }
  } else if (difficulty === 'intermediate') {
    // Coins + small bills, 4-8 items
    const pool = [...COINS, BILLS[0], BILLS[1]];
    const count = randInt(4, 8);
    for (let i = 0; i < count; i++) {
      items.push({ ...pool[randInt(0, pool.length - 1)] });
    }
  } else {
    // All denominations, 5-10 items
    const pool = [...COINS, ...BILLS];
    const count = randInt(5, 10);
    for (let i = 0; i < count; i++) {
      items.push({ ...pool[randInt(0, pool.length - 1)] });
    }
  }
  const correctTotal = items.reduce((s, it) => s + it.value, 0);
  return { items: shuffle(items), correctTotal };
}

function generateChangeChallenge(difficulty: Difficulty): ChangeChallenge {
  const itemNames = ['Lollipop', 'Eraser', 'Sticker Pack', 'Juice', 'Granola Bar', 'Marker', 'Yo-Yo', 'Comic Book', 'Bracelet', 'Keychain'];
  const itemName = itemNames[randInt(0, itemNames.length - 1)];
  let itemPrice: number, amountPaid: number;

  if (difficulty === 'beginner') {
    itemPrice = randInt(10, 90); // 10c-90c
    amountPaid = 100; // $1
  } else if (difficulty === 'intermediate') {
    itemPrice = randInt(100, 900); // $1-$9
    amountPaid = 1000; // $10
  } else {
    itemPrice = randInt(200, 1800); // $2-$18
    amountPaid = 2000; // $20
    // Add sales tax for advanced
    itemPrice = Math.round(itemPrice * 1.08); // 8% tax
    if (itemPrice > amountPaid) itemPrice = amountPaid - randInt(50, 200);
  }

  return { itemName, itemPrice, amountPaid, correctChange: amountPaid - itemPrice };
}

function generateBudgetSetup(difficulty: Difficulty): { allowance: number; categories: BudgetCategory[] } {
  let allowance: number;
  if (difficulty === 'beginner') allowance = 2000; // $20
  else if (difficulty === 'intermediate') allowance = 5000; // $50
  else allowance = 10000; // $100

  return {
    allowance,
    categories: [
      { name: 'Save', emoji: '\ud83c\udfe6', amount: 0 },
      { name: 'Spend', emoji: '\ud83d\udecd\ufe0f', amount: 0 },
      { name: 'Share', emoji: '\ud83e\udd1d', amount: 0 },
    ],
  };
}

function generateShopItems(difficulty: Difficulty): { budget: number; items: ShopItem[] } {
  let budget: number;
  let priceRange: [number, number];

  if (difficulty === 'beginner') {
    budget = 500; // $5
    priceRange = [50, 200];
  } else if (difficulty === 'intermediate') {
    budget = 2000; // $20
    priceRange = [150, 800];
  } else {
    budget = 5000; // $50
    priceRange = [300, 1500];
  }

  const selected = shuffle(SHOP_ITEMS_POOL).slice(0, 8);
  const items: ShopItem[] = selected.map((it) => ({
    ...it,
    price: Math.round(randInt(priceRange[0], priceRange[1]) / 5) * 5, // round to 5c
  }));

  return { budget, items };
}

function generateSavingGoal(difficulty: Difficulty): SavingGoal {
  const goal = SAVING_GOALS[randInt(0, SAVING_GOALS.length - 1)];
  let weeklyAllowance: number;
  let target = goal.target;

  if (difficulty === 'beginner') {
    weeklyAllowance = 1000; // $10/week
    target = Math.min(target, 4000);
  } else if (difficulty === 'intermediate') {
    weeklyAllowance = 1500;
  } else {
    weeklyAllowance = 2000;
    target = Math.round(target * 1.5);
  }

  return { ...goal, target, saved: 0, week: 1, weeklyAllowance, decisions: [] };
}

// ---------------------------------------------------------------------------
// SVG Components
// ---------------------------------------------------------------------------
function CoinSVG({
  item,
  index,
  selected,
  onClick,
  isDark,
}: {
  item: MoneyItem;
  index: number;
  selected: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  const r = item.size;
  return (
    <svg
      width={r * 2 + 6}
      height={r * 2 + 6}
      style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: selected ? 'scale(1.15)' : 'scale(1)' }}
      onClick={onClick}
    >
      {/* shadow */}
      <circle cx={r + 3} cy={r + 4} r={r} fill="rgba(0,0,0,0.15)" />
      {/* coin body */}
      <circle cx={r + 3} cy={r + 3} r={r} fill={item.color} stroke={selected ? '#ffd700' : (isDark ? '#555' : '#888')} strokeWidth={selected ? 2.5 : 1} />
      {/* inner ring */}
      <circle cx={r + 3} cy={r + 3} r={r - 3} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={0.8} />
      {/* denomination */}
      <text
        x={r + 3}
        y={r + 3}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={r > 15 ? 10 : 8}
        fontWeight="bold"
        fill={item.value === 1 ? '#fff' : '#333'}
      >
        {item.label}
      </text>
    </svg>
  );
}

function BillSVG({
  item,
  index,
  selected,
  onClick,
  isDark,
}: {
  item: MoneyItem;
  index: number;
  selected: boolean;
  onClick: () => void;
  isDark: boolean;
}) {
  const w = item.size;
  const h = 30;
  return (
    <svg
      width={w + 6}
      height={h + 6}
      style={{ cursor: 'pointer', transition: 'transform 0.2s', transform: selected ? 'scale(1.1)' : 'scale(1)' }}
      onClick={onClick}
    >
      {/* shadow */}
      <rect x={3} y={4} width={w} height={h} rx={3} fill="rgba(0,0,0,0.12)" />
      {/* bill body */}
      <rect x={2} y={2} width={w} height={h} rx={3} fill={item.color} stroke={selected ? '#ffd700' : (isDark ? '#555' : '#6a9f4d')} strokeWidth={selected ? 2.5 : 1} />
      {/* border pattern */}
      <rect x={6} y={6} width={w - 8} height={h - 8} rx={1} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={0.8} strokeDasharray="3 2" />
      {/* $ symbol */}
      <text x={w / 2 + 2} y={h / 2 + 3} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight="bold" fill="#2d5016">
        {item.label}
      </text>
    </svg>
  );
}

function ProgressBar({ value, max, color, isDark }: { value: number; max: number; color: string; isDark: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ width: '100%', height: 14, background: isDark ? '#333' : '#e8e8e8', borderRadius: 7, overflow: 'hidden', position: 'relative' }}>
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: color,
          borderRadius: 7,
          transition: 'width 0.5s ease',
        }}
      />
      <span
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: 9,
          fontWeight: 700,
          lineHeight: '14px',
          color: pct > 40 ? '#fff' : (isDark ? '#ccc' : '#555'),
        }}
      >
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function PieChart({ slices, size, isDark }: { slices: { label: string; value: number; color: string }[]; size: number; isDark: boolean }) {
  const total = slices.reduce((s, sl) => s + sl.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size}>
        <circle cx={size / 2} cy={size / 2} r={size / 2 - 4} fill={isDark ? '#333' : '#e0e0e0'} stroke={isDark ? '#555' : '#ccc'} strokeWidth={1} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central" fontSize={11} fill={isDark ? '#aaa' : '#999'}>
          Empty
        </text>
      </svg>
    );
  }

  let cumulative = 0;
  const paths = slices
    .filter((s) => s.value > 0)
    .map((slice) => {
      const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
      cumulative += slice.value;
      const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
      const r = size / 2 - 4;
      const cx = size / 2;
      const cy = size / 2;
      const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const d = `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z`;
      return <path key={slice.label} d={d} fill={slice.color} stroke={isDark ? '#1a1a2e' : '#fff'} strokeWidth={1.5} />;
    });

  return (
    <svg width={size} height={size}>
      {paths}
    </svg>
  );
}

function StarRating({ stars }: { stars: number }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: -1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ color: i < stars ? '#ffc107' : '#ddd' }}>
          {'\u2605'}
        </span>
      ))}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function App() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [initialized, setInitialized] = useState(false);
  const [lesson, setLesson] = useState<LessonState | null>(null);
  const [progress, setProgress] = useState<GameProgress>({
    totalScore: 0,
    streak: 0,
    lessonsCompleted: 0,
    achievements: DEFAULT_ACHIEVEMENTS.map((a) => ({ ...a })),
    activitiesCompleted: { counting: 0, 'making-change': 0, budgeting: 0, shopping: 0, saving: 0 },
  });
  const [animatingCoin, setAnimatingCoin] = useState(false);

  const lessonRef = useRef<LessonState | null>(null);
  const progressRef = useRef<GameProgress>(progress);

  useEffect(() => {
    lessonRef.current = lesson;
  }, [lesson]);
  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  const isDark = theme === 'dark';

  // ---------------------------------------------------------------------------
  // Achievement checker
  // ---------------------------------------------------------------------------
  const checkAchievements = useCallback((prog: GameProgress, activity: Activity) => {
    const updated = { ...prog, achievements: prog.achievements.map((a) => ({ ...a })) };
    let newUnlock: Achievement | null = null;

    const tryUnlock = (id: string) => {
      const a = updated.achievements.find((x) => x.id === id);
      if (a && !a.unlocked) {
        a.unlocked = true;
        newUnlock = a;
      }
    };

    if (prog.lessonsCompleted >= 1) tryUnlock('first_dollar');
    if (prog.activitiesCompleted.budgeting >= 1) tryUnlock('budget_master');
    if (prog.activitiesCompleted['making-change'] >= 2) tryUnlock('change_champion');
    if (prog.activitiesCompleted.shopping >= 2) tryUnlock('smart_shopper');
    if (prog.activitiesCompleted.saving >= 1) tryUnlock('super_saver');
    if (prog.streak >= 3) tryUnlock('streak_3');
    if (prog.streak >= 5) tryUnlock('streak_5');
    if (prog.lessonsCompleted >= 10) tryUnlock('ten_lessons');

    if (newUnlock) {
      sendToParent({
        type: 'PLUGIN_COMPLETE',
        messageId: generateMessageId(),
        payload: {
          event: 'achievement_unlocked',
          data: { achievement: newUnlock.name, emoji: newUnlock.emoji },
          summary: `Achievement unlocked: ${newUnlock.emoji} ${newUnlock.name}`,
        },
      });
    }

    return updated;
  }, []);

  // ---------------------------------------------------------------------------
  // Tool handler
  // ---------------------------------------------------------------------------
  const handleToolInvoke = useCallback(
    (messageId: string, toolName: string, parameters: Record<string, any>) => {
      switch (toolName) {
        case 'start_money_lesson': {
          const activity: Activity = parameters.activity || 'counting';
          const difficulty: Difficulty = parameters.difficulty || 'beginner';

          const newLesson: LessonState = {
            activity,
            difficulty,
            startTime: Date.now(),
            feedback: null,
            feedbackType: null,
            completed: false,
            score: 0,
          };

          // Set up activity-specific state
          if (activity === 'counting') {
            const ch = generateCountingChallenge(difficulty);
            newLesson.counting = { ...ch, selected: [], userTotal: 0 };
          } else if (activity === 'making-change') {
            const ch = generateChangeChallenge(difficulty);
            newLesson.change = { ...ch, userAnswer: '' };
          } else if (activity === 'budgeting') {
            const setup = generateBudgetSetup(difficulty);
            newLesson.budget = { ...setup, remaining: setup.allowance };
          } else if (activity === 'shopping') {
            const setup = generateShopItems(difficulty);
            newLesson.shopping = { ...setup, cart: [], total: 0 };
          } else if (activity === 'saving') {
            newLesson.saving = generateSavingGoal(difficulty);
          }

          setLesson(newLesson);

          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: {
                status: 'lesson_started',
                activity,
                difficulty,
                message: `Money Sense lesson started: ${activity} (${difficulty}). ${
                  activity === 'counting'
                    ? 'Click coins and bills to count the total!'
                    : activity === 'making-change'
                    ? 'Calculate the correct change!'
                    : activity === 'budgeting'
                    ? 'Allocate your allowance wisely!'
                    : activity === 'shopping'
                    ? 'Shop smart within your budget!'
                    : 'Save up for your goal!'
                }`,
              },
            },
          });

          sendToParent({
            type: 'STATE_UPDATE',
            messageId: generateMessageId(),
            payload: {
              state: { activity, difficulty, score: 0, lessonsCompleted: progressRef.current.lessonsCompleted },
              summary: `Started ${activity} lesson (${difficulty})`,
            },
          });
          break;
        }

        case 'get_money_progress': {
          const p = progressRef.current;
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: {
              result: {
                totalScore: p.totalScore,
                streak: p.streak,
                lessonsCompleted: p.lessonsCompleted,
                achievements: p.achievements.filter((a) => a.unlocked).map((a) => `${a.emoji} ${a.name}`),
                activitiesCompleted: p.activitiesCompleted,
              },
            },
          });
          break;
        }

        case 'get_money_tip': {
          const l = lessonRef.current;
          const activity = l?.activity || 'counting';
          const tips = MONEY_TIPS[activity];
          const tip = tips[randInt(0, tips.length - 1)];

          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: { tip, activity } },
          });

          if (l && !l.completed) {
            setLesson({ ...l, feedback: `Tip: ${tip}`, feedbackType: 'info' });
          }
          break;
        }

        default:
          sendToParent({
            type: 'TOOL_RESULT',
            messageId,
            payload: { result: null, error: `Unknown tool: ${toolName}` },
          });
      }
    },
    [checkAchievements]
  );

  // ---------------------------------------------------------------------------
  // Message listener
  // ---------------------------------------------------------------------------
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
          setLesson(null);
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

  // ---------------------------------------------------------------------------
  // Lesson completion helper
  // ---------------------------------------------------------------------------
  const completeLesson = useCallback(
    (lessonState: LessonState, bonusScore: number) => {
      const score = 10 + bonusScore;
      const updated: LessonState = { ...lessonState, completed: true, score, feedback: `Great job! +${score} points!`, feedbackType: 'success' };
      setLesson(updated);

      setAnimatingCoin(true);
      setTimeout(() => setAnimatingCoin(false), 800);

      setProgress((prev) => {
        const next: GameProgress = {
          ...prev,
          totalScore: prev.totalScore + score,
          streak: prev.streak + 1,
          lessonsCompleted: prev.lessonsCompleted + 1,
          achievements: prev.achievements.map((a) => ({ ...a })),
          activitiesCompleted: { ...prev.activitiesCompleted, [lessonState.activity]: prev.activitiesCompleted[lessonState.activity] + 1 },
        };
        const withAch = checkAchievements(next, lessonState.activity);

        sendToParent({
          type: 'PLUGIN_COMPLETE',
          messageId: generateMessageId(),
          payload: {
            event: 'lesson_completed',
            data: {
              activity: lessonState.activity,
              difficulty: lessonState.difficulty,
              score,
              totalScore: withAch.totalScore,
              streak: withAch.streak,
              duration: Math.round((Date.now() - lessonState.startTime) / 1000),
            },
            summary: `Completed ${lessonState.activity} lesson! Score: ${score} (Total: ${withAch.totalScore})`,
          },
        });

        return withAch;
      });
    },
    [checkAchievements]
  );

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------
  const colors = {
    primary: '#2e7d32',
    primaryLight: '#4caf50',
    gold: '#ffc107',
    bg: isDark ? '#1a1a2e' : '#ffffff',
    cardBg: isDark ? '#252540' : '#f5f9f5',
    text: isDark ? '#e0e0e0' : '#333333',
    textSecondary: isDark ? '#aaa' : '#666',
    border: isDark ? '#3a3a5a' : '#dde8dd',
    success: '#4caf50',
    error: '#e74c3c',
    info: '#2196f3',
  };

  const containerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '12px 16px',
    gap: '10px',
    width: '100%',
    maxWidth: '480px',
    margin: '0 auto',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    color: colors.text,
  };

  const cardStyle: React.CSSProperties = {
    width: '100%',
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 12,
    padding: '14px',
  };

  const btnStyle = (variant: 'primary' | 'secondary' | 'gold' = 'primary'): React.CSSProperties => ({
    padding: '8px 18px',
    border: 'none',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.2s',
    background: variant === 'primary' ? colors.primary : variant === 'gold' ? colors.gold : (isDark ? '#3a3a5a' : '#e0e0e0'),
    color: variant === 'primary' ? '#fff' : variant === 'gold' ? '#333' : colors.text,
  });

  // ---------------------------------------------------------------------------
  // Header
  // ---------------------------------------------------------------------------
  const renderHeader = () => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 22 }}>{'\ud83d\udcb0'}</span>
        <span style={{ fontWeight: 700, fontSize: 16, color: colors.primary }}>Money Sense</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
        <span title="Score" style={{ color: colors.gold, fontWeight: 700 }}>{'\u2b50'} {progress.totalScore}</span>
        <span title="Streak" style={{ color: colors.primaryLight, fontWeight: 600 }}>{'\ud83d\udd25'} {progress.streak}</span>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Coin flip animation overlay
  // ---------------------------------------------------------------------------
  const renderCoinAnimation = () => {
    if (!animatingCoin) return null;
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 999,
        }}
      >
        <div
          style={{
            fontSize: 48,
            animation: 'none',
            transform: 'translateY(-40px)',
            opacity: 0.9,
          }}
        >
          {'\ud83e\ude99'}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Feedback banner
  // ---------------------------------------------------------------------------
  const renderFeedback = () => {
    if (!lesson?.feedback) return null;
    const bgMap = { success: colors.success, error: colors.error, info: colors.info };
    return (
      <div
        style={{
          width: '100%',
          padding: '8px 14px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
          background: bgMap[lesson.feedbackType || 'info'],
          textAlign: 'center',
          transition: 'all 0.3s',
        }}
      >
        {lesson.feedback}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // COUNTING activity
  // ---------------------------------------------------------------------------
  const renderCounting = () => {
    if (!lesson?.counting) return null;
    const c = lesson.counting;

    const toggleItem = (idx: number) => {
      if (lesson.completed) return;
      const sel = c.selected.includes(idx) ? c.selected.filter((i) => i !== idx) : [...c.selected, idx];
      const total = sel.reduce((s, i) => s + c.items[i].value, 0);
      setLesson({
        ...lesson,
        counting: { ...c, selected: sel, userTotal: total },
        feedback: null,
        feedbackType: null,
      });
    };

    const checkAnswer = () => {
      if (c.selected.length === 0) {
        setLesson({ ...lesson, feedback: 'Click on coins and bills to select them first!', feedbackType: 'info' });
        return;
      }
      if (c.userTotal === c.correctTotal && c.selected.length === c.items.length) {
        completeLesson(lesson, c.items.length);
      } else if (c.userTotal === c.correctTotal) {
        setLesson({ ...lesson, feedback: 'That amount is correct, but make sure to select ALL the items!', feedbackType: 'info' });
      } else {
        setLesson({
          ...lesson,
          feedback: `Not quite! You counted ${formatCents(c.userTotal)} but the total is different. Try again!`,
          feedbackType: 'error',
        });
      }
    };

    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Count the Money!</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>Click each coin and bill, then check your total</div>
        </div>

        {/* Money items */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center', padding: '10px 0', minHeight: 80 }}>
          {c.items.map((item, idx) =>
            item.type === 'coin' ? (
              <CoinSVG key={idx} item={item} index={idx} selected={c.selected.includes(idx)} onClick={() => toggleItem(idx)} isDark={isDark} />
            ) : (
              <BillSVG key={idx} item={item} index={idx} selected={c.selected.includes(idx)} onClick={() => toggleItem(idx)} isDark={isDark} />
            )
          )}
        </div>

        {/* Running total */}
        <div style={{ textAlign: 'center', margin: '8px 0' }}>
          <span style={{ fontSize: 11, color: colors.textSecondary }}>Your count: </span>
          <span style={{ fontSize: 20, fontWeight: 700, color: colors.primary }}>{formatCents(c.userTotal)}</span>
          <span style={{ fontSize: 11, color: colors.textSecondary, marginLeft: 8 }}>({c.selected.length}/{c.items.length} selected)</span>
        </div>

        {!lesson.completed && (
          <div style={{ textAlign: 'center' }}>
            <button style={btnStyle('primary')} onClick={checkAnswer}>
              Check Answer
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // MAKING CHANGE activity
  // ---------------------------------------------------------------------------
  const renderMakingChange = () => {
    if (!lesson?.change) return null;
    const ch = lesson.change;

    const handleSubmit = () => {
      const raw = ch.userAnswer.replace(/[$,\s]/g, '');
      let userCents: number;
      if (raw.includes('.')) {
        userCents = Math.round(parseFloat(raw) * 100);
      } else {
        userCents = parseInt(raw, 10);
        // If they typed a number > 100 without a dot, assume cents
        // If <= 100, could be dollars -- but we'll check against correctChange
        if (isNaN(userCents)) {
          setLesson({ ...lesson, feedback: 'Please enter a number!', feedbackType: 'error' });
          return;
        }
      }

      if (isNaN(userCents) || userCents < 0) {
        setLesson({ ...lesson, feedback: 'Please enter a valid amount!', feedbackType: 'error' });
        return;
      }

      // Accept if they entered in dollars or cents (check both interpretations)
      if (userCents === ch.correctChange || userCents * 100 === ch.correctChange) {
        completeLesson(lesson, 15);
      } else {
        setLesson({
          ...lesson,
          feedback: `Not quite! The correct change is ${formatCents(ch.correctChange)}. The item costs ${formatCents(ch.itemPrice)} and the customer paid ${formatCents(ch.amountPaid)}.`,
          feedbackType: 'error',
        });
      }
    };

    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>Make the Change!</div>
          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10 }}>
            A customer buys a <strong>{ch.itemName}</strong>
          </div>
        </div>

        {/* Visual transaction */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'center',
            padding: '12px',
            background: isDark ? '#1e1e36' : '#edf7ed',
            borderRadius: 10,
            marginBottom: 12,
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>Item Price</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.error }}>{formatCents(ch.itemPrice)}</div>
            {lesson.difficulty === 'advanced' && <div style={{ fontSize: 9, color: colors.textSecondary }}>(tax included)</div>}
          </div>
          <div style={{ fontSize: 20 }}>{'\u2192'}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>Paid With</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.primary }}>{formatCents(ch.amountPaid)}</div>
          </div>
          <div style={{ fontSize: 20 }}>{'\u2192'}</div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 2 }}>Change Due</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: colors.gold }}>?</div>
          </div>
        </div>

        {!lesson.completed && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: 16, fontWeight: 700 }}>$</span>
            <input
              type="text"
              value={ch.userAnswer}
              onChange={(e) =>
                setLesson({ ...lesson, change: { ...ch, userAnswer: e.target.value }, feedback: null, feedbackType: null })
              }
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="0.00"
              style={{
                width: 100,
                padding: '8px 12px',
                fontSize: 16,
                fontWeight: 600,
                textAlign: 'center',
                border: `2px solid ${colors.border}`,
                borderRadius: 8,
                background: isDark ? '#1e1e36' : '#fff',
                color: colors.text,
                outline: 'none',
              }}
            />
            <button style={btnStyle('primary')} onClick={handleSubmit}>
              Check
            </button>
          </div>
        )}
        {lesson.completed && (
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: colors.success }}>
            {formatCents(ch.correctChange)} -- Correct!
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // BUDGETING activity
  // ---------------------------------------------------------------------------
  const renderBudgeting = () => {
    if (!lesson?.budget) return null;
    const b = lesson.budget;

    const adjustCategory = (idx: number, delta: number) => {
      if (lesson.completed) return;
      const step = lesson.difficulty === 'beginner' ? 100 : lesson.difficulty === 'intermediate' ? 250 : 500;
      const amount = delta * step;
      const cat = b.categories[idx];
      const newAmt = Math.max(0, cat.amount + amount);
      if (newAmt - cat.amount > b.remaining) return; // not enough remaining

      const newCats = b.categories.map((c, i) => (i === idx ? { ...c, amount: newAmt } : { ...c }));
      const totalAllocated = newCats.reduce((s, c) => s + c.amount, 0);
      setLesson({
        ...lesson,
        budget: { ...b, categories: newCats, remaining: b.allowance - totalAllocated },
        feedback: null,
        feedbackType: null,
      });
    };

    const submitBudget = () => {
      if (b.remaining > 0) {
        setLesson({ ...lesson, feedback: `You still have ${formatCents(b.remaining)} to allocate!`, feedbackType: 'info' });
        return;
      }
      const saveAmt = b.categories.find((c) => c.name === 'Save')?.amount || 0;
      const savePct = (saveAmt / b.allowance) * 100;
      const bonus = savePct >= 20 ? 20 : savePct >= 10 ? 10 : 5;
      completeLesson(lesson, bonus);
    };

    const pieSlices = b.categories.map((cat) => ({
      label: cat.name,
      value: cat.amount,
      color: cat.name === 'Save' ? '#4caf50' : cat.name === 'Spend' ? '#ff9800' : '#2196f3',
    }));

    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Budget Your Allowance!</div>
          <div style={{ fontSize: 13, color: colors.primary, fontWeight: 700 }}>
            Weekly Allowance: {formatCents(b.allowance)}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', justifyContent: 'center' }}>
          {/* Pie chart */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <PieChart slices={pieSlices} size={100} isDark={isDark} />
            <div style={{ fontSize: 10, color: colors.textSecondary }}>
              Remaining: <strong>{formatCents(b.remaining)}</strong>
            </div>
          </div>

          {/* Sliders */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
            {b.categories.map((cat, idx) => (
              <div key={cat.name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>
                    {cat.emoji} {cat.name}
                  </span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: colors.primary }}>{formatCents(cat.amount)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <button
                    style={{
                      ...btnStyle('secondary'),
                      padding: '2px 10px',
                      fontSize: 16,
                      lineHeight: '18px',
                      borderRadius: 6,
                    }}
                    onClick={() => adjustCategory(idx, -1)}
                    disabled={cat.amount === 0 || lesson.completed}
                  >
                    -
                  </button>
                  <div style={{ flex: 1 }}>
                    <ProgressBar value={cat.amount} max={b.allowance} color={pieSlices[idx].color} isDark={isDark} />
                  </div>
                  <button
                    style={{
                      ...btnStyle('secondary'),
                      padding: '2px 10px',
                      fontSize: 16,
                      lineHeight: '18px',
                      borderRadius: 6,
                    }}
                    onClick={() => adjustCategory(idx, 1)}
                    disabled={b.remaining === 0 || lesson.completed}
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {!lesson.completed && (
          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button style={btnStyle('gold')} onClick={submitBudget}>
              Submit Budget
            </button>
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // SHOPPING activity
  // ---------------------------------------------------------------------------
  const renderShopping = () => {
    if (!lesson?.shopping) return null;
    const sh = lesson.shopping;

    const toggleCartItem = (idx: number) => {
      if (lesson.completed) return;
      let newCart: number[];
      if (sh.cart.includes(idx)) {
        newCart = sh.cart.filter((i) => i !== idx);
      } else {
        newCart = [...sh.cart, idx];
      }
      const total = newCart.reduce((s, i) => s + sh.items[i].price, 0);
      if (total > sh.budget && !sh.cart.includes(idx)) {
        setLesson({ ...lesson, feedback: 'That would go over your budget!', feedbackType: 'error' });
        return;
      }
      setLesson({
        ...lesson,
        shopping: { ...sh, cart: newCart, total },
        feedback: null,
        feedbackType: null,
      });
    };

    const checkout = () => {
      if (sh.cart.length === 0) {
        setLesson({ ...lesson, feedback: 'Add some items to your cart first!', feedbackType: 'info' });
        return;
      }
      const totalValue = sh.cart.reduce((s, i) => s + sh.items[i].value, 0);
      const efficiencyBonus = Math.min(20, totalValue * 2);
      completeLesson(lesson, efficiencyBonus);
    };

    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{'\ud83d\uded2'} Smart Shopping!</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>Pick the best items within your budget</div>
        </div>

        {/* Budget bar */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
            <span>
              Budget: <strong style={{ color: colors.primary }}>{formatCents(sh.budget)}</strong>
            </span>
            <span>
              Spent: <strong style={{ color: sh.total > sh.budget * 0.8 ? colors.error : colors.text }}>{formatCents(sh.total)}</strong>
            </span>
            <span>
              Left: <strong style={{ color: colors.success }}>{formatCents(sh.budget - sh.total)}</strong>
            </span>
          </div>
          <ProgressBar value={sh.total} max={sh.budget} color={sh.total > sh.budget * 0.8 ? colors.error : colors.primary} isDark={isDark} />
        </div>

        {/* Items grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
          {sh.items.map((item, idx) => {
            const inCart = sh.cart.includes(idx);
            return (
              <div
                key={idx}
                onClick={() => toggleCartItem(idx)}
                style={{
                  padding: '8px 4px',
                  borderRadius: 8,
                  border: `2px solid ${inCart ? colors.primary : colors.border}`,
                  background: inCart ? (isDark ? '#1a3a1a' : '#e8f5e9') : 'transparent',
                  cursor: lesson.completed ? 'default' : 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                }}
              >
                <div style={{ fontSize: 20 }}>{item.emoji}</div>
                <div style={{ fontSize: 10, fontWeight: 600, marginTop: 2 }}>{item.name}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: colors.primary }}>{formatCents(item.price)}</div>
                <StarRating stars={item.value} />
              </div>
            );
          })}
        </div>

        {/* Cart summary */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            {sh.cart.length} items in cart
          </span>
          {!lesson.completed && (
            <button style={btnStyle('gold')} onClick={checkout}>
              {'\ud83d\uded2'} Checkout
            </button>
          )}
        </div>
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // SAVING activity
  // ---------------------------------------------------------------------------
  const renderSaving = () => {
    if (!lesson?.saving) return null;
    const sv = lesson.saving;

    const maxWeeks = Math.ceil((sv.target / sv.weeklyAllowance) * 2.5); // generous max
    const goalReached = sv.saved >= sv.target;
    const outOfWeeks = sv.week > maxWeeks;

    const makeSaveDecision = (savePercent: number) => {
      if (lesson.completed || goalReached) return;
      const saveAmount = Math.round(sv.weeklyAllowance * savePercent);
      const spentAmount = sv.weeklyAllowance - saveAmount;
      const newSaved = sv.saved + saveAmount;
      const newDecisions = [...sv.decisions, { week: sv.week, saved: saveAmount, spent: spentAmount }];
      const newSaving: SavingGoal = {
        ...sv,
        saved: newSaved,
        week: sv.week + 1,
        decisions: newDecisions,
      };

      if (newSaved >= sv.target) {
        setLesson({ ...lesson, saving: newSaving });
        setTimeout(() => {
          const weeksUsed = newDecisions.length;
          const optimalWeeks = Math.ceil(sv.target / sv.weeklyAllowance);
          const bonus = weeksUsed <= optimalWeeks + 2 ? 25 : weeksUsed <= optimalWeeks + 5 ? 15 : 5;
          completeLesson({ ...lesson, saving: newSaving }, bonus);
        }, 300);
      } else if (sv.week + 1 > maxWeeks) {
        setLesson({
          ...lesson,
          saving: newSaving,
          feedback: `Oh no! You ran out of weeks. You saved ${formatCents(newSaved)} of ${formatCents(sv.target)}. Try saving more each week!`,
          feedbackType: 'error',
          completed: true,
        });
      } else {
        setLesson({ ...lesson, saving: newSaving, feedback: null, feedbackType: null });
      }
    };

    return (
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{sv.emoji} Saving for: {sv.name}</div>
          <div style={{ fontSize: 12, color: colors.textSecondary }}>
            Goal: {formatCents(sv.target)} | Allowance: {formatCents(sv.weeklyAllowance)}/week
          </div>
        </div>

        {/* Progress toward goal */}
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
            <span>Saved: <strong style={{ color: colors.success }}>{formatCents(sv.saved)}</strong></span>
            <span>Goal: <strong>{formatCents(sv.target)}</strong></span>
          </div>
          <ProgressBar value={sv.saved} max={sv.target} color={colors.gold} isDark={isDark} />
        </div>

        {/* Weekly decision history (compact) */}
        {sv.decisions.length > 0 && (
          <div style={{ marginBottom: 10, maxHeight: 80, overflowY: 'auto' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: colors.textSecondary, marginBottom: 4 }}>History:</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {sv.decisions.map((d, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: 9,
                    padding: '2px 6px',
                    borderRadius: 4,
                    background: d.saved > d.spent ? (isDark ? '#1a3a1a' : '#e8f5e9') : (isDark ? '#3a1a1a' : '#fbe9e7'),
                    border: `1px solid ${d.saved > d.spent ? '#4caf50' : '#ff9800'}`,
                  }}
                >
                  Wk{d.week}: +{formatCents(d.saved)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Decision buttons */}
        {!lesson.completed && !goalReached && !outOfWeeks && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textAlign: 'center', marginBottom: 6 }}>
              Week {sv.week}: How much do you save?
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
              {[
                { label: 'Save All', pct: 1.0, desc: formatCents(sv.weeklyAllowance) },
                { label: 'Save 75%', pct: 0.75, desc: formatCents(Math.round(sv.weeklyAllowance * 0.75)) },
                { label: 'Save Half', pct: 0.5, desc: formatCents(Math.round(sv.weeklyAllowance * 0.5)) },
                { label: 'Save 25%', pct: 0.25, desc: formatCents(Math.round(sv.weeklyAllowance * 0.25)) },
                { label: 'Spend All', pct: 0, desc: '$0' },
              ].map((opt) => (
                <button
                  key={opt.label}
                  onClick={() => makeSaveDecision(opt.pct)}
                  style={{
                    ...btnStyle(opt.pct >= 0.5 ? 'primary' : 'secondary'),
                    padding: '6px 10px',
                    fontSize: 11,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 1,
                    minWidth: 70,
                  }}
                >
                  <span>{opt.label}</span>
                  <span style={{ fontSize: 9, opacity: 0.8 }}>{opt.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {goalReached && lesson.completed && (
          <div style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, color: colors.success }}>
            {'\ud83c\udf89'} Goal Reached in {sv.decisions.length} weeks!
          </div>
        )}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Achievements display
  // ---------------------------------------------------------------------------
  const renderAchievements = () => {
    const unlocked = progress.achievements.filter((a) => a.unlocked);
    if (unlocked.length === 0) return null;
    return (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
        {unlocked.map((a) => (
          <div
            key={a.id}
            title={a.name}
            style={{
              padding: '3px 8px',
              borderRadius: 12,
              background: isDark ? '#3a3a2a' : '#fff8e1',
              border: `1px solid ${colors.gold}`,
              fontSize: 10,
              fontWeight: 600,
            }}
          >
            {a.emoji} {a.name}
          </div>
        ))}
      </div>
    );
  };

  // ---------------------------------------------------------------------------
  // Waiting screen
  // ---------------------------------------------------------------------------
  if (!lesson) {
    return (
      <div style={containerStyle}>
        {renderHeader()}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{'\ud83d\udcb0'}</div>
          <p style={{ fontSize: 16, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
            Ready to learn about money!
          </p>
          <p style={{ fontSize: 13, color: colors.textSecondary }}>
            Ask the chatbot: "Let's learn about money!"
          </p>
          <p style={{ fontSize: 11, color: colors.textSecondary, marginTop: 16 }}>
            Activities: Counting {'\u00b7'} Making Change {'\u00b7'} Budgeting {'\u00b7'} Shopping {'\u00b7'} Saving
          </p>
        </div>
        {renderAchievements()}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Lesson active
  // ---------------------------------------------------------------------------
  return (
    <div style={containerStyle}>
      {renderHeader()}
      {renderCoinAnimation()}
      {renderFeedback()}

      {lesson.activity === 'counting' && renderCounting()}
      {lesson.activity === 'making-change' && renderMakingChange()}
      {lesson.activity === 'budgeting' && renderBudgeting()}
      {lesson.activity === 'shopping' && renderShopping()}
      {lesson.activity === 'saving' && renderSaving()}

      {renderAchievements()}

      {/* Footer info */}
      <div style={{ fontSize: 11, color: colors.textSecondary, textAlign: 'center' }}>
        {lesson.activity.replace('-', ' ')} {'\u00b7'} {lesson.difficulty} {'\u00b7'}{' '}
        {lesson.completed ? `Score: ${lesson.score}` : 'In progress...'}
        {' \u00b7 '}{progress.lessonsCompleted} lessons completed
      </div>
    </div>
  );
}
