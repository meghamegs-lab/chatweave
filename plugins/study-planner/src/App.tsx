import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Inline SDK bridge ─────────────────────────────────────────────────────

let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────

interface StudySession {
  id: string;
  topic: string;
  duration: string;
  completed: boolean;
}

interface WeekPlan {
  week: number;
  theme: string;
  sessions: StudySession[];
  milestone: string;
}

interface StudyPlan {
  subject: string;
  goal: string;
  durationWeeks: number;
  weeks: WeekPlan[];
  createdAt: number;
}

type Theme = 'light' | 'dark';

// ─── Study Plan Generator ──────────────────────────────────────────────────

const SUBJECT_TOPICS: Record<string, string[][]> = {
  Math: [
    ['Number sense & place value', 'Addition strategies', 'Subtraction strategies', 'Mental math techniques'],
    ['Multiplication basics', 'Division basics', 'Factors & multiples', 'Word problems'],
    ['Fractions introduction', 'Comparing fractions', 'Adding fractions', 'Mixed numbers'],
    ['Decimals & percentages', 'Ratio & proportion', 'Geometry basics', 'Measurement & units'],
    ['Algebraic thinking', 'Patterns & sequences', 'Data & statistics', 'Problem solving strategies'],
    ['Equations & inequalities', 'Coordinate geometry', 'Area & perimeter', 'Volume & surface area'],
  ],
  Science: [
    ['Scientific method', 'Observation skills', 'Hypothesis formation', 'Experiment design'],
    ['States of matter', 'Properties of materials', 'Chemical changes', 'Mixtures & solutions'],
    ['Forces & motion', 'Energy types', 'Simple machines', 'Gravity & friction'],
    ['Plant biology', 'Animal adaptations', 'Ecosystems', 'Food chains & webs'],
    ['Solar system', 'Stars & constellations', 'Earth structure', 'Weather & climate'],
    ['Electricity & magnetism', 'Sound & light', 'Heat transfer', 'Renewable energy'],
  ],
  History: [
    ['Ancient civilizations overview', 'Mesopotamia', 'Ancient Egypt', 'Timeline skills'],
    ['Ancient Greece', 'Ancient Rome', 'Classical art & culture', 'Primary sources'],
    ['Medieval period', 'Feudalism', 'The Crusades', 'Trade routes'],
    ['Renaissance', 'Age of exploration', 'Scientific revolution', 'Map reading'],
    ['American Revolution', 'French Revolution', 'Industrial Revolution', 'Document analysis'],
    ['World Wars overview', 'Civil rights movements', 'Modern history', 'Historical thinking'],
  ],
  English: [
    ['Parts of speech', 'Sentence structure', 'Punctuation review', 'Reading comprehension'],
    ['Paragraph writing', 'Topic sentences', 'Supporting details', 'Transitions'],
    ['Narrative writing', 'Character development', 'Plot structure', 'Descriptive language'],
    ['Poetry basics', 'Figurative language', 'Rhyme & meter', 'Poetry analysis'],
    ['Persuasive writing', 'Argumentative essays', 'Evidence & reasoning', 'Counterarguments'],
    ['Research skills', 'Note-taking', 'Citations', 'Presentation skills'],
  ],
};

const MILESTONES: Record<string, string[]> = {
  Math: ['Number Novice', 'Calculation Cadet', 'Fraction Fighter', 'Decimal Defender', 'Algebra Ace', 'Math Master'],
  Science: ['Curious Observer', 'Matter Expert', 'Force Finder', 'Life Explorer', 'Space Voyager', 'Energy Engineer'],
  History: ['Time Traveler', 'Classical Scholar', 'Medieval Knight', 'Renaissance Mind', 'Revolution Expert', 'History Hero'],
  English: ['Grammar Guardian', 'Paragraph Pro', 'Story Spinner', 'Poetry Pioneer', 'Persuasion Pro', 'Language Legend'],
};

function generateStudyPlan(subject: string, goal: string, durationWeeks: number): StudyPlan {
  const normalizedSubject = Object.keys(SUBJECT_TOPICS).find(
    k => k.toLowerCase() === subject.toLowerCase()
  ) || 'Math';

  const allTopics = SUBJECT_TOPICS[normalizedSubject];
  const milestones = MILESTONES[normalizedSubject] || MILESTONES['Math'];
  const weeks: WeekPlan[] = [];

  for (let w = 0; w < durationWeeks; w++) {
    const topicSet = allTopics[w % allTopics.length];
    const sessions: StudySession[] = topicSet.map((topic, i) => ({
      id: `w${w + 1}_s${i + 1}`,
      topic,
      duration: `${25 + Math.floor(Math.random() * 20)}min`,
      completed: false,
    }));

    weeks.push({
      week: w + 1,
      theme: `${normalizedSubject} - ${topicSet[0].split(' ')[0]} Focus`,
      sessions,
      milestone: milestones[w % milestones.length],
    });
  }

  return { subject: normalizedSubject, goal, durationWeeks, weeks, createdAt: Date.now() };
}

// ─── Styles ────────────────────────────────────────────────────────────────

function getStyles(theme: Theme) {
  const isDark = theme === 'dark';

  return {
    container: {
      width: '100%',
      minHeight: '100vh',
      background: isDark
        ? 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)'
        : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 50%, #ddd6fe 100%)',
      padding: '20px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: isDark ? '#e2e8f0' : '#1e1b4b',
    } as React.CSSProperties,

    // Phase 1: OAuth
    oauthContainer: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '460px',
      textAlign: 'center' as const,
      gap: '24px',
    } as React.CSSProperties,
    oauthIcon: {
      width: '80px',
      height: '80px',
      borderRadius: '20px',
      background: isDark
        ? 'linear-gradient(135deg, #7c3aed, #4f46e5)'
        : 'linear-gradient(135deg, #8b5cf6, #6366f1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '36px',
      boxShadow: '0 8px 32px rgba(124, 58, 237, 0.3)',
    } as React.CSSProperties,
    oauthTitle: {
      fontSize: '24px',
      fontWeight: 700,
      color: isDark ? '#f1f5f9' : '#1e1b4b',
    } as React.CSSProperties,
    oauthSubtitle: {
      fontSize: '14px',
      color: isDark ? '#94a3b8' : '#64748b',
      maxWidth: '360px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    googleButton: {
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      padding: '12px 24px',
      background: isDark ? '#ffffff' : '#ffffff',
      color: '#3c4043',
      border: `1px solid ${isDark ? '#5f6368' : '#dadce0'}`,
      borderRadius: '8px',
      fontSize: '15px',
      fontWeight: 500,
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
      fontFamily: "'Google Sans', Roboto, Arial, sans-serif",
    } as React.CSSProperties,
    googleButtonHover: {
      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
      background: '#f8f9fa',
    } as React.CSSProperties,
    benefitsList: {
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '12px',
      textAlign: 'left' as const,
    } as React.CSSProperties,
    benefitItem: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      fontSize: '13px',
      color: isDark ? '#cbd5e1' : '#475569',
    } as React.CSSProperties,
    benefitIcon: {
      width: '28px',
      height: '28px',
      borderRadius: '8px',
      background: isDark ? 'rgba(124, 58, 237, 0.2)' : 'rgba(124, 58, 237, 0.1)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      flexShrink: 0,
    } as React.CSSProperties,
    connectingSpinner: {
      width: '24px',
      height: '24px',
      border: '3px solid #e2e8f0',
      borderTopColor: '#7c3aed',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
    } as React.CSSProperties,

    // Phase 2: Connected
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '20px',
      padding: '12px 16px',
      background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.7)',
      borderRadius: '12px',
      backdropFilter: 'blur(10px)',
    } as React.CSSProperties,
    headerLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    } as React.CSSProperties,
    avatar: {
      width: '32px',
      height: '32px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '14px',
      color: '#fff',
      fontWeight: 600,
    } as React.CSSProperties,
    connectedLabel: {
      fontSize: '13px',
      color: isDark ? '#a5b4fc' : '#6366f1',
      fontWeight: 500,
    } as React.CSSProperties,
    connectedDot: {
      width: '8px',
      height: '8px',
      borderRadius: '50%',
      background: '#22c55e',
      display: 'inline-block',
      marginRight: '6px',
    } as React.CSSProperties,

    // Plan header
    planHeader: {
      textAlign: 'center' as const,
      marginBottom: '20px',
    } as React.CSSProperties,
    planSubject: {
      fontSize: '22px',
      fontWeight: 700,
      color: isDark ? '#c4b5fd' : '#4c1d95',
      marginBottom: '4px',
    } as React.CSSProperties,
    planGoal: {
      fontSize: '14px',
      color: isDark ? '#94a3b8' : '#64748b',
    } as React.CSSProperties,

    // Overall progress
    overallProgress: {
      padding: '16px',
      background: isDark ? 'rgba(124, 58, 237, 0.15)' : 'rgba(124, 58, 237, 0.08)',
      borderRadius: '12px',
      marginBottom: '20px',
    } as React.CSSProperties,
    overallProgressLabel: {
      display: 'flex',
      justifyContent: 'space-between',
      fontSize: '13px',
      fontWeight: 600,
      marginBottom: '8px',
      color: isDark ? '#c4b5fd' : '#5b21b6',
    } as React.CSSProperties,
    progressBarOuter: {
      height: '10px',
      background: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
      borderRadius: '5px',
      overflow: 'hidden',
    } as React.CSSProperties,
    progressBarInner: (pct: number) => ({
      height: '100%',
      width: `${pct}%`,
      background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
      borderRadius: '5px',
      transition: 'width 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
    } as React.CSSProperties),

    // Week card
    weekCard: (isExpanded: boolean) => ({
      background: isDark ? 'rgba(255,255,255,0.05)' : '#ffffff',
      borderRadius: '12px',
      marginBottom: '12px',
      overflow: 'hidden',
      border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      boxShadow: isExpanded
        ? '0 4px 16px rgba(124, 58, 237, 0.15)'
        : '0 1px 3px rgba(0,0,0,0.05)',
      transition: 'box-shadow 0.3s ease',
    } as React.CSSProperties),
    weekHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '14px 16px',
      cursor: 'pointer',
      userSelect: 'none' as const,
    } as React.CSSProperties,
    weekHeaderLeft: {
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
    } as React.CSSProperties,
    weekNumber: {
      width: '32px',
      height: '32px',
      borderRadius: '8px',
      background: 'linear-gradient(135deg, #7c3aed, #6366f1)',
      color: '#fff',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '13px',
      fontWeight: 700,
    } as React.CSSProperties,
    weekTitle: {
      fontSize: '14px',
      fontWeight: 600,
      color: isDark ? '#e2e8f0' : '#1e1b4b',
    } as React.CSSProperties,
    weekProgressMini: {
      fontSize: '12px',
      color: isDark ? '#94a3b8' : '#64748b',
    } as React.CSSProperties,
    weekBody: {
      padding: '0 16px 14px',
    } as React.CSSProperties,
    sessionItem: (completed: boolean) => ({
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '10px 12px',
      marginBottom: '6px',
      borderRadius: '8px',
      background: completed
        ? isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.06)'
        : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
      cursor: 'pointer',
      transition: 'all 0.2s ease',
      opacity: completed ? 0.7 : 1,
    } as React.CSSProperties),
    checkbox: (completed: boolean) => ({
      width: '22px',
      height: '22px',
      borderRadius: '6px',
      border: `2px solid ${completed ? '#22c55e' : isDark ? '#4a5568' : '#cbd5e1'}`,
      background: completed ? '#22c55e' : 'transparent',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
      transition: 'all 0.2s ease',
      color: '#fff',
      fontSize: '12px',
      fontWeight: 700,
    } as React.CSSProperties),
    sessionTopic: (completed: boolean) => ({
      fontSize: '13px',
      fontWeight: 500,
      color: completed
        ? isDark ? '#6ee7b7' : '#16a34a'
        : isDark ? '#e2e8f0' : '#334155',
      textDecoration: completed ? 'line-through' : 'none',
      flex: 1,
    } as React.CSSProperties),
    sessionDuration: {
      fontSize: '11px',
      color: isDark ? '#64748b' : '#94a3b8',
      fontWeight: 500,
    } as React.CSSProperties,

    // Milestone badge
    milestoneBadge: (earned: boolean) => ({
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '12px',
      fontWeight: 600,
      background: earned
        ? 'linear-gradient(135deg, #f59e0b, #eab308)'
        : isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
      color: earned
        ? '#78350f'
        : isDark ? '#64748b' : '#94a3b8',
      border: `1px solid ${earned ? '#f59e0b' : isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
      transition: 'all 0.3s ease',
    } as React.CSSProperties),

    // Week progress bar
    weekProgressBar: {
      height: '4px',
      background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderRadius: '2px',
      overflow: 'hidden',
      marginTop: '10px',
      marginBottom: '6px',
    } as React.CSSProperties,

    // Empty state
    emptyState: {
      textAlign: 'center' as const,
      padding: '40px 20px',
    } as React.CSSProperties,
    emptyIcon: {
      fontSize: '48px',
      marginBottom: '16px',
    } as React.CSSProperties,
    emptyTitle: {
      fontSize: '18px',
      fontWeight: 600,
      marginBottom: '8px',
      color: isDark ? '#c4b5fd' : '#4c1d95',
    } as React.CSSProperties,
    emptySubtitle: {
      fontSize: '13px',
      color: isDark ? '#94a3b8' : '#64748b',
      lineHeight: 1.5,
    } as React.CSSProperties,

    // Chevron
    chevron: (expanded: boolean) => ({
      fontSize: '14px',
      transition: 'transform 0.2s ease',
      transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
      color: isDark ? '#64748b' : '#94a3b8',
    } as React.CSSProperties),
  };
}

// ─── Google SVG Logo ───────────────────────────────────────────────────────

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

// ─── App Component ─────────────────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [userRole, setUserRole] = useState<string>('Student');
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);
  const [googleBtnHover, setGoogleBtnHover] = useState(false);
  const pendingMessagesRef = useRef<Map<string, (result: any) => void>>(new Map());

  // ── Send PLUGIN_READY on mount ──
  useEffect(() => {
    sendToParent({ type: 'PLUGIN_READY', pluginId: 'study-planner' });
  }, []);

  // ── Listen for parent messages ──
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      const data = event.data;
      if (!data || !data.type) return;

      switch (data.type) {
        case 'PLUGIN_INIT': {
          const user = data.payload?.user;
          if (user?.role) {
            setUserRole(user.role.charAt(0).toUpperCase() + user.role.slice(1));
          }
          break;
        }
        case 'THEME_UPDATE': {
          const newTheme = data.theme === 'dark' ? 'dark' : 'light';
          setTheme(newTheme);
          document.body.className = newTheme;
          break;
        }
        case 'AUTH_RESULT': {
          if (data.pluginId === 'study-planner' && data.success) {
            setConnecting(false);
            setConnected(true);
          }
          break;
        }
        case 'TOOL_INVOKE': {
          // Normalize: parent sends { messageId, payload: { toolName, parameters } }
          const toolData = {
            messageId: data.messageId,
            tool: data.payload?.toolName || data.tool,
            parameters: data.payload?.parameters || data.parameters,
          };
          handleToolInvoke(toolData);
          break;
        }
      }
    }
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [plan]);

  // ── Tool invocation handler ──
  const handleToolInvoke = useCallback((data: any) => {
    const { messageId, tool, parameters } = data;

    if (tool === 'create_study_plan') {
      const subject = parameters?.subject || 'Math';
      const goal = parameters?.goal || 'Master the subject';
      const durationWeeks = Math.min(12, Math.max(1, parameters?.duration_weeks || 4));

      const newPlan = generateStudyPlan(subject, goal, durationWeeks);
      setPlan(newPlan);
      setExpandedWeek(1);

      sendToParent({
        type: 'TOOL_RESULT',
        messageId,
        payload: {
          result: {
            success: true,
            plan: {
              subject: newPlan.subject,
              goal: newPlan.goal,
              durationWeeks: newPlan.durationWeeks,
              totalSessions: newPlan.weeks.reduce((sum, w) => sum + w.sessions.length, 0),
              weeks: newPlan.weeks.map(w => ({
                week: w.week,
                theme: w.theme,
                milestone: w.milestone,
                sessionCount: w.sessions.length,
                sessions: w.sessions.map(s => s.topic),
              })),
            },
            message: `Created a ${durationWeeks}-week study plan for ${subject}: "${goal}"`,
          },
        },
      });

      sendToParent({
        type: 'PLUGIN_COMPLETE',
        pluginId: 'study-planner',
        event: 'plan_created',
        data: { subject, goal, durationWeeks },
        summary: `Study plan created: ${durationWeeks} weeks of ${subject} to "${goal}"`,
      });
    }

    if (tool === 'get_study_progress') {
      if (!plan) {
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              success: true,
              hasActivePlan: false,
              message: 'No active study plan. Create one first with create_study_plan.',
            },
          },
        });
        return;
      }

      const totalSessions = plan.weeks.reduce((sum, w) => sum + w.sessions.length, 0);
      const completedSessions = plan.weeks.reduce(
        (sum, w) => sum + w.sessions.filter(s => s.completed).length, 0
      );
      const progressPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

      const weekProgress = plan.weeks.map(w => {
        const done = w.sessions.filter(s => s.completed).length;
        return {
          week: w.week,
          theme: w.theme,
          milestone: w.milestone,
          milestoneEarned: done === w.sessions.length,
          completed: done,
          total: w.sessions.length,
          remaining: w.sessions.filter(s => !s.completed).map(s => s.topic),
        };
      });

      sendToParent({
        type: 'TOOL_RESULT',
        messageId,
        payload: {
          result: {
            success: true,
            hasActivePlan: true,
            subject: plan.subject,
            goal: plan.goal,
            overallProgress: `${progressPct}%`,
            completedSessions,
            totalSessions,
            weeks: weekProgress,
            message: `Study plan progress: ${progressPct}% complete (${completedSessions}/${totalSessions} sessions)`,
          },
        },
      });
    }
  }, [plan]);

  // ── Handle Google connect ──
  const handleConnect = () => {
    setConnecting(true);

    sendToParent({
      type: 'AUTH_REQUEST',
      pluginId: 'study-planner',
      provider: 'google',
    });

    // Connection completes when parent sends AUTH_RESULT after OAuth popup finishes
  };

  // ── Toggle session completion ──
  const toggleSession = (weekIndex: number, sessionId: string) => {
    if (!plan) return;

    const updatedWeeks = plan.weeks.map((week, wi) => {
      if (wi !== weekIndex) return week;
      return {
        ...week,
        sessions: week.sessions.map(s =>
          s.id === sessionId ? { ...s, completed: !s.completed } : s
        ),
      };
    });

    const updatedPlan = { ...plan, weeks: updatedWeeks };
    setPlan(updatedPlan);

    const totalSessions = updatedWeeks.reduce((sum, w) => sum + w.sessions.length, 0);
    const completedSessions = updatedWeeks.reduce(
      (sum, w) => sum + w.sessions.filter(s => s.completed).length, 0
    );

    sendToParent({
      type: 'STATE_UPDATE',
      pluginId: 'study-planner',
      state: {
        completedSessions,
        totalSessions,
        progressPct: Math.round((completedSessions / totalSessions) * 100),
      },
      summary: `Study progress: ${completedSessions}/${totalSessions} sessions completed`,
    });

    // Check if all sessions in the week are now completed
    const updatedWeek = updatedWeeks[weekIndex];
    const allDone = updatedWeek.sessions.every(s => s.completed);
    if (allDone) {
      sendToParent({
        type: 'PLUGIN_COMPLETE',
        pluginId: 'study-planner',
        event: 'session_completed',
        data: {
          week: updatedWeek.week,
          theme: updatedWeek.theme,
          milestone: updatedWeek.milestone,
        },
        summary: `Week ${updatedWeek.week} completed! Milestone earned: ${updatedWeek.milestone}`,
      });
    }
  };

  const s = getStyles(theme);

  // ── Compute progress ──
  const totalSessions = plan?.weeks.reduce((sum, w) => sum + w.sessions.length, 0) ?? 0;
  const completedSessions = plan?.weeks.reduce(
    (sum, w) => sum + w.sessions.filter(s => s.completed).length, 0
  ) ?? 0;
  const overallPct = totalSessions > 0 ? Math.round((completedSessions / totalSessions) * 100) : 0;

  // ════════════════════════════════════════════════════════════════════════
  // Phase 1: Not Connected
  // ════════════════════════════════════════════════════════════════════════

  if (!connected) {
    return (
      <div style={s.container}>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <div style={s.oauthContainer}>
          <div style={s.oauthIcon}>
            <span role="img" aria-label="study">&#128218;</span>
          </div>

          <div>
            <div style={s.oauthTitle}>Study Planner</div>
            <p style={{ ...s.oauthSubtitle, marginTop: '8px' }}>
              Connect your Google account to unlock personalized study planning,
              progress tracking, and smart scheduling.
            </p>
          </div>

          {connecting ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <div style={s.connectingSpinner} />
              <span style={{ fontSize: '13px', color: theme === 'dark' ? '#94a3b8' : '#64748b' }}>
                Connecting to Google...
              </span>
            </div>
          ) : (
            <button
              style={{
                ...s.googleButton,
                ...(googleBtnHover ? s.googleButtonHover : {}),
              }}
              onClick={handleConnect}
              onMouseEnter={() => setGoogleBtnHover(true)}
              onMouseLeave={() => setGoogleBtnHover(false)}
            >
              <GoogleLogo />
              Connect with Google
            </button>
          )}

          <div style={s.benefitsList}>
            {[
              { icon: '\uD83D\uDCC5', text: 'Sync study schedules with Google Calendar' },
              { icon: '\uD83D\uDCC8', text: 'Track progress across all your devices' },
              { icon: '\uD83C\uDFAF', text: 'Set personalized learning goals and milestones' },
            ].map((benefit, i) => (
              <div key={i} style={s.benefitItem}>
                <div style={s.benefitIcon}>{benefit.icon}</div>
                <span>{benefit.text}</span>
              </div>
            ))}
          </div>

          <p style={{ fontSize: '11px', color: theme === 'dark' ? '#475569' : '#94a3b8', maxWidth: '300px' }}>
            We only request access to your basic profile information. Your data stays private and secure.
          </p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════════
  // Phase 2: Connected
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div style={s.container}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.avatar}>S</div>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>Study Planner</div>
            <div style={s.connectedLabel}>
              <span style={s.connectedDot} />
              Connected as {userRole}
            </div>
          </div>
        </div>
        {plan && (
          <div style={{
            fontSize: '12px',
            fontWeight: 600,
            color: theme === 'dark' ? '#a5b4fc' : '#6366f1',
            background: theme === 'dark' ? 'rgba(165,180,252,0.1)' : 'rgba(99,102,241,0.08)',
            padding: '4px 10px',
            borderRadius: '12px',
          }}>
            {overallPct}% Complete
          </div>
        )}
      </div>

      {/* No plan yet */}
      {!plan && (
        <div style={s.emptyState}>
          <div style={s.emptyIcon}>&#128203;</div>
          <div style={s.emptyTitle}>No Active Study Plan</div>
          <div style={s.emptySubtitle}>
            Ask the AI to create a study plan for you!<br />
            Try: "Create a 4-week math study plan to master fractions"
          </div>
        </div>
      )}

      {/* Active plan */}
      {plan && (
        <>
          {/* Plan header */}
          <div style={s.planHeader}>
            <div style={s.planSubject}>{plan.subject}</div>
            <div style={s.planGoal}>{plan.goal}</div>
          </div>

          {/* Overall progress */}
          <div style={s.overallProgress}>
            <div style={s.overallProgressLabel}>
              <span>Overall Progress</span>
              <span>{completedSessions}/{totalSessions} sessions</span>
            </div>
            <div style={s.progressBarOuter}>
              <div style={s.progressBarInner(overallPct)} />
            </div>
          </div>

          {/* Milestone badges row */}
          <div style={{
            display: 'flex',
            flexWrap: 'wrap' as const,
            gap: '8px',
            marginBottom: '20px',
            justifyContent: 'center',
          }}>
            {plan.weeks.map((week, wi) => {
              const earned = week.sessions.every(s => s.completed);
              return (
                <div key={wi} style={s.milestoneBadge(earned)}>
                  <span>{earned ? '\uD83C\uDFC6' : '\uD83D\uDD12'}</span>
                  <span>{week.milestone}</span>
                </div>
              );
            })}
          </div>

          {/* Week cards */}
          {plan.weeks.map((week, wi) => {
            const isExpanded = expandedWeek === week.week;
            const weekCompleted = week.sessions.filter(s => s.completed).length;
            const weekTotal = week.sessions.length;
            const weekPct = Math.round((weekCompleted / weekTotal) * 100);
            const allDone = weekCompleted === weekTotal;

            return (
              <div key={wi} style={s.weekCard(isExpanded)}>
                {/* Week header */}
                <div
                  style={s.weekHeader}
                  onClick={() => setExpandedWeek(isExpanded ? null : week.week)}
                >
                  <div style={s.weekHeaderLeft}>
                    <div style={{
                      ...s.weekNumber,
                      ...(allDone ? { background: 'linear-gradient(135deg, #22c55e, #16a34a)' } : {}),
                    }}>
                      {allDone ? '\u2713' : `W${week.week}`}
                    </div>
                    <div>
                      <div style={s.weekTitle}>{week.theme}</div>
                      <div style={s.weekProgressMini}>
                        {weekCompleted}/{weekTotal} sessions {allDone ? '- Complete!' : ''}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {allDone && (
                      <span style={{ fontSize: '16px' }} title={`Milestone: ${week.milestone}`}>
                        &#127942;
                      </span>
                    )}
                    <span style={s.chevron(isExpanded)}>&#9660;</span>
                  </div>
                </div>

                {/* Week progress bar (always visible) */}
                <div style={{ padding: '0 16px', paddingBottom: isExpanded ? '0' : '12px' }}>
                  <div style={s.weekProgressBar}>
                    <div style={s.progressBarInner(weekPct)} />
                  </div>
                </div>

                {/* Expanded sessions */}
                {isExpanded && (
                  <div style={s.weekBody}>
                    {week.sessions.map((session) => (
                      <div
                        key={session.id}
                        style={s.sessionItem(session.completed)}
                        onClick={() => toggleSession(wi, session.id)}
                      >
                        <div style={s.checkbox(session.completed)}>
                          {session.completed && '\u2713'}
                        </div>
                        <span style={s.sessionTopic(session.completed)}>
                          {session.topic}
                        </span>
                        <span style={s.sessionDuration}>
                          {session.duration}
                        </span>
                      </div>
                    ))}
                    {allDone && (
                      <div style={{
                        textAlign: 'center' as const,
                        padding: '8px',
                        marginTop: '4px',
                        fontSize: '13px',
                        fontWeight: 600,
                        color: theme === 'dark' ? '#fbbf24' : '#d97706',
                      }}>
                        &#127942; Milestone Achieved: {week.milestone}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}
