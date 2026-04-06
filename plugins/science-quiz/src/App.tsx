import React, { useState, useEffect, useCallback, useRef } from 'react';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type Category =
  | 'general-science'
  | 'biology'
  | 'physics'
  | 'chemistry'
  | 'astronomy'
  | 'earth-science';

type Difficulty = 'easy' | 'medium' | 'hard';

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

type QuestionBank = Record<Category, Record<Difficulty, Question[]>>;

type Theme = 'light' | 'dark';

type Screen = 'idle' | 'quiz' | 'results';

/* ------------------------------------------------------------------ */
/*  Question Bank  (10+ per category across difficulties = 60+)        */
/* ------------------------------------------------------------------ */

const QUESTION_BANK: QuestionBank = {
  'general-science': {
    easy: [
      { question: 'What is the chemical formula for water?', options: ['H2O', 'CO2', 'NaCl', 'O2'], correctIndex: 0, explanation: 'Water is composed of two hydrogen atoms and one oxygen atom, giving it the formula H2O.' },
      { question: 'What planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Saturn'], correctIndex: 1, explanation: 'Mars appears reddish due to iron oxide (rust) on its surface.' },
      { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon dioxide', 'Helium'], correctIndex: 2, explanation: 'Plants absorb carbon dioxide during photosynthesis and release oxygen.' },
      { question: 'How many bones are in the adult human body?', options: ['106', '206', '306', '186'], correctIndex: 1, explanation: 'An adult human skeleton consists of 206 bones.' },
    ],
    medium: [
      { question: 'What is the speed of light in a vacuum (approximately)?', options: ['300,000 km/s', '150,000 km/s', '500,000 km/s', '1,000,000 km/s'], correctIndex: 0, explanation: 'Light travels at approximately 299,792 km/s in a vacuum, roughly 300,000 km/s.' },
      { question: 'What type of bond involves the sharing of electron pairs between atoms?', options: ['Ionic bond', 'Covalent bond', 'Metallic bond', 'Hydrogen bond'], correctIndex: 1, explanation: 'Covalent bonds form when atoms share one or more pairs of electrons.' },
      { question: 'Which organ in the human body is primarily responsible for filtering blood?', options: ['Heart', 'Liver', 'Kidney', 'Lungs'], correctIndex: 2, explanation: 'The kidneys filter about 200 liters of blood daily, removing waste and excess fluid.' },
      { question: 'What is the most abundant gas in Earth\'s atmosphere?', options: ['Oxygen', 'Carbon dioxide', 'Nitrogen', 'Argon'], correctIndex: 2, explanation: 'Nitrogen makes up about 78% of Earth\'s atmosphere.' },
    ],
    hard: [
      { question: 'What is the Heisenberg Uncertainty Principle about?', options: ['Energy conservation', 'Simultaneous measurement of position and momentum', 'Speed of light limit', 'Atomic decay rates'], correctIndex: 1, explanation: 'The Heisenberg Uncertainty Principle states that you cannot simultaneously know the exact position and momentum of a particle.' },
      { question: 'What is the name of the process by which a solid changes directly to a gas?', options: ['Evaporation', 'Condensation', 'Sublimation', 'Deposition'], correctIndex: 2, explanation: 'Sublimation is the transition from solid to gas without passing through the liquid phase, like dry ice.' },
      { question: 'Which subatomic particle was discovered by James Chadwick in 1932?', options: ['Proton', 'Electron', 'Neutron', 'Positron'], correctIndex: 2, explanation: 'James Chadwick discovered the neutron in 1932, which has no electric charge.' },
    ],
  },

  biology: {
    easy: [
      { question: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Mitochondria', 'Ribosome', 'Golgi apparatus'], correctIndex: 1, explanation: 'Mitochondria generate most of the cell\'s supply of ATP, the energy currency.' },
      { question: 'What molecule carries genetic information?', options: ['RNA', 'DNA', 'ATP', 'Protein'], correctIndex: 1, explanation: 'DNA (deoxyribonucleic acid) stores and transmits genetic information.' },
      { question: 'Which blood cells help fight infection?', options: ['Red blood cells', 'White blood cells', 'Platelets', 'Plasma cells'], correctIndex: 1, explanation: 'White blood cells (leukocytes) are part of the immune system and fight infections.' },
      { question: 'What is the largest organ in the human body?', options: ['Liver', 'Brain', 'Skin', 'Heart'], correctIndex: 2, explanation: 'The skin is the largest organ, covering about 1.5-2 square meters in adults.' },
    ],
    medium: [
      { question: 'What is the process by which cells divide to produce two identical daughter cells?', options: ['Meiosis', 'Mitosis', 'Binary fission', 'Budding'], correctIndex: 1, explanation: 'Mitosis produces two genetically identical daughter cells from a single parent cell.' },
      { question: 'Which organelle is responsible for protein synthesis?', options: ['Lysosome', 'Ribosome', 'Vacuole', 'Centriole'], correctIndex: 1, explanation: 'Ribosomes read mRNA and assemble amino acids into polypeptide chains (proteins).' },
      { question: 'What type of organism can produce its own food through photosynthesis?', options: ['Heterotroph', 'Autotroph', 'Decomposer', 'Parasite'], correctIndex: 1, explanation: 'Autotrophs (like plants) produce their own food from sunlight and CO2 via photosynthesis.' },
      { question: 'How many chromosomes do humans have in each somatic cell?', options: ['23', '44', '46', '48'], correctIndex: 2, explanation: 'Human somatic cells contain 46 chromosomes (23 pairs).' },
    ],
    hard: [
      { question: 'What enzyme unwinds the DNA double helix during replication?', options: ['DNA polymerase', 'Helicase', 'Ligase', 'Topoisomerase'], correctIndex: 1, explanation: 'Helicase breaks hydrogen bonds between base pairs to unwind and separate the DNA strands.' },
      { question: 'Which phase of meiosis results in crossing over?', options: ['Prophase I', 'Metaphase I', 'Anaphase II', 'Telophase I'], correctIndex: 0, explanation: 'Crossing over occurs during Prophase I when homologous chromosomes exchange genetic material.' },
      { question: 'What is the term for a change in allele frequencies in a population due to random chance?', options: ['Natural selection', 'Gene flow', 'Genetic drift', 'Mutation'], correctIndex: 2, explanation: 'Genetic drift is the random fluctuation of allele frequencies, especially significant in small populations.' },
    ],
  },

  physics: {
    easy: [
      { question: 'What is the unit of force in the SI system?', options: ['Joule', 'Watt', 'Newton', 'Pascal'], correctIndex: 2, explanation: 'The Newton (N) is the SI unit of force, named after Sir Isaac Newton.' },
      { question: 'What type of energy does a moving object have?', options: ['Potential energy', 'Kinetic energy', 'Thermal energy', 'Chemical energy'], correctIndex: 1, explanation: 'Kinetic energy is the energy of motion, calculated as KE = 1/2 mv^2.' },
      { question: 'What is the force that pulls objects toward the center of the Earth?', options: ['Magnetism', 'Friction', 'Gravity', 'Tension'], correctIndex: 2, explanation: 'Gravity is the force of attraction between masses; on Earth it causes objects to fall at 9.8 m/s^2.' },
      { question: 'Which color of visible light has the longest wavelength?', options: ['Blue', 'Green', 'Red', 'Violet'], correctIndex: 2, explanation: 'Red light has the longest wavelength (about 620-750 nm) in the visible spectrum.' },
    ],
    medium: [
      { question: 'What is Newton\'s Second Law of Motion?', options: ['F = ma', 'E = mc^2', 'F = Gm1m2/r^2', 'PV = nRT'], correctIndex: 0, explanation: 'Newton\'s Second Law states that force equals mass times acceleration (F = ma).' },
      { question: 'What phenomenon causes a straw to appear bent in a glass of water?', options: ['Reflection', 'Refraction', 'Diffraction', 'Dispersion'], correctIndex: 1, explanation: 'Refraction is the bending of light as it passes between media of different densities.' },
      { question: 'What is the SI unit of electrical resistance?', options: ['Volt', 'Ampere', 'Ohm', 'Watt'], correctIndex: 2, explanation: 'The Ohm is the SI unit of electrical resistance, defined as voltage per ampere.' },
      { question: 'In which medium does sound travel fastest?', options: ['Air', 'Water', 'Steel', 'Vacuum'], correctIndex: 2, explanation: 'Sound travels fastest through solids like steel (~5,960 m/s) because molecules are packed tightly.' },
    ],
    hard: [
      { question: 'What is the de Broglie wavelength formula?', options: ['lambda = h/p', 'lambda = c/f', 'lambda = E/h', 'lambda = hf/c'], correctIndex: 0, explanation: 'De Broglie\'s equation lambda = h/p relates a particle\'s wavelength to its momentum, showing wave-particle duality.' },
      { question: 'What is the Schwarzschild radius?', options: ['Radius of a neutron star', 'Event horizon radius of a black hole', 'Radius of the observable universe', 'Bohr radius of hydrogen'], correctIndex: 1, explanation: 'The Schwarzschild radius defines the event horizon of a non-rotating black hole, beyond which nothing can escape.' },
      { question: 'Which conservation law is violated in beta-plus decay if we don\'t account for neutrinos?', options: ['Conservation of charge', 'Conservation of energy', 'Conservation of lepton number', 'All of the above'], correctIndex: 3, explanation: 'Without neutrinos, beta-plus decay would violate conservation of energy, momentum, and lepton number simultaneously.' },
    ],
  },

  chemistry: {
    easy: [
      { question: 'What is the atomic number of carbon?', options: ['4', '6', '8', '12'], correctIndex: 1, explanation: 'Carbon has 6 protons in its nucleus, giving it an atomic number of 6.' },
      { question: 'What is the pH of pure water?', options: ['0', '5', '7', '14'], correctIndex: 2, explanation: 'Pure water has a neutral pH of 7, neither acidic nor basic.' },
      { question: 'Which element is represented by the symbol "Fe"?', options: ['Fluorine', 'Iron', 'Francium', 'Fermium'], correctIndex: 1, explanation: 'Fe comes from the Latin word "ferrum," meaning iron.' },
      { question: 'What are the three states of matter?', options: ['Solid, liquid, gas', 'Solid, liquid, plasma', 'Solid, gas, plasma', 'Liquid, gas, plasma'], correctIndex: 0, explanation: 'The three classical states of matter are solid, liquid, and gas (plasma is sometimes called the fourth).' },
    ],
    medium: [
      { question: 'What is Avogadro\'s number (approximately)?', options: ['6.022 x 10^23', '3.14 x 10^23', '6.022 x 10^20', '1.602 x 10^19'], correctIndex: 0, explanation: 'Avogadro\'s number (6.022 x 10^23) is the number of particles in one mole of a substance.' },
      { question: 'What type of reaction releases energy to the surroundings?', options: ['Endothermic', 'Exothermic', 'Isothermic', 'Adiabatic'], correctIndex: 1, explanation: 'Exothermic reactions release heat energy, resulting in a negative enthalpy change.' },
      { question: 'What is the most electronegative element?', options: ['Oxygen', 'Chlorine', 'Nitrogen', 'Fluorine'], correctIndex: 3, explanation: 'Fluorine has the highest electronegativity (3.98 on the Pauling scale) of all elements.' },
      { question: 'What type of bond holds water molecules to each other?', options: ['Covalent bond', 'Ionic bond', 'Hydrogen bond', 'Van der Waals force'], correctIndex: 2, explanation: 'Hydrogen bonds form between the slightly positive hydrogen of one water molecule and the slightly negative oxygen of another.' },
    ],
    hard: [
      { question: 'What is the hybridization of carbon in methane (CH4)?', options: ['sp', 'sp2', 'sp3', 'sp3d'], correctIndex: 2, explanation: 'In methane, carbon undergoes sp3 hybridization, forming four equivalent bonds in a tetrahedral geometry.' },
      { question: 'What is Le Chatelier\'s Principle primarily about?', options: ['Reaction rates', 'Equilibrium shifts in response to disturbances', 'Electron configuration', 'Gas behavior'], correctIndex: 1, explanation: 'Le Chatelier\'s Principle states that a system at equilibrium will shift to counteract any imposed change.' },
      { question: 'Which quantum number describes the shape of an electron orbital?', options: ['Principal (n)', 'Angular momentum (l)', 'Magnetic (ml)', 'Spin (ms)'], correctIndex: 1, explanation: 'The angular momentum quantum number (l) determines the shape of the orbital (s, p, d, f).' },
    ],
  },

  astronomy: {
    easy: [
      { question: 'What is the closest star to Earth?', options: ['Proxima Centauri', 'Sirius', 'The Sun', 'Alpha Centauri A'], correctIndex: 2, explanation: 'The Sun is about 150 million km away, far closer than any other star.' },
      { question: 'How many planets are in our solar system?', options: ['7', '8', '9', '10'], correctIndex: 1, explanation: 'There are 8 recognized planets since Pluto was reclassified as a dwarf planet in 2006.' },
      { question: 'What causes the phases of the Moon?', options: ['Earth\'s shadow', 'Moon\'s rotation', 'Sunlight angles as Moon orbits Earth', 'Solar eclipses'], correctIndex: 2, explanation: 'The Moon\'s phases are caused by the changing angle of sunlight as the Moon orbits Earth.' },
      { question: 'Which planet has the most moons?', options: ['Jupiter', 'Saturn', 'Uranus', 'Neptune'], correctIndex: 1, explanation: 'Saturn has the most confirmed moons of any planet in our solar system, with over 140 known moons.' },
    ],
    medium: [
      { question: 'What type of galaxy is the Milky Way?', options: ['Elliptical', 'Spiral', 'Irregular', 'Lenticular'], correctIndex: 1, explanation: 'The Milky Way is a barred spiral galaxy, approximately 100,000 light-years in diameter.' },
      { question: 'What is a supernova?', options: ['A very large planet', 'An exploding star', 'A type of asteroid', 'A galaxy collision'], correctIndex: 1, explanation: 'A supernova is the explosive death of a massive star, briefly outshining an entire galaxy.' },
      { question: 'What is the Kuiper Belt?', options: ['Asteroid belt between Mars and Jupiter', 'Ring of icy bodies beyond Neptune', 'Cloud of comets surrounding the solar system', 'Saturn\'s ring system'], correctIndex: 1, explanation: 'The Kuiper Belt is a region of icy bodies beyond Neptune\'s orbit, home to Pluto and similar objects.' },
      { question: 'What instrument is used to measure the brightness of stars?', options: ['Spectrometer', 'Photometer', 'Barometer', 'Interferometer'], correctIndex: 1, explanation: 'A photometer measures the intensity (brightness) of light from celestial objects.' },
    ],
    hard: [
      { question: 'What is the Chandrasekhar limit?', options: ['Maximum mass of a neutron star', 'Maximum mass of a white dwarf (~1.4 solar masses)', 'Size limit of a black hole', 'Maximum mass of a main-sequence star'], correctIndex: 1, explanation: 'The Chandrasekhar limit (~1.4 solar masses) is the maximum mass for a stable white dwarf star.' },
      { question: 'What is the primary evidence for the Big Bang theory?', options: ['Existence of black holes', 'Cosmic microwave background radiation', 'Solar wind', 'Existence of galaxies'], correctIndex: 1, explanation: 'The cosmic microwave background (CMB) is residual thermal radiation from the early universe, a key prediction confirmed in 1965.' },
      { question: 'What is the Roche limit?', options: ['Maximum orbit speed', 'Minimum distance before tidal forces disintegrate a satellite', 'Maximum stellar temperature', 'Minimum mass for fusion'], correctIndex: 1, explanation: 'The Roche limit is the closest distance a celestial body can orbit a larger body without being torn apart by tidal forces.' },
    ],
  },

  'earth-science': {
    easy: [
      { question: 'What are the three main layers of the Earth?', options: ['Crust, mantle, core', 'Crust, magma, core', 'Surface, middle, center', 'Lithosphere, hydrosphere, atmosphere'], correctIndex: 0, explanation: 'Earth is divided into three main layers: the crust (outermost), mantle (middle), and core (innermost).' },
      { question: 'What type of rock is formed from cooled lava?', options: ['Sedimentary', 'Metamorphic', 'Igneous', 'Mineral'], correctIndex: 2, explanation: 'Igneous rocks form when molten rock (magma or lava) cools and solidifies.' },
      { question: 'What scale is used to measure earthquake magnitude?', options: ['Beaufort scale', 'Richter scale', 'Mohs scale', 'Kelvin scale'], correctIndex: 1, explanation: 'The Richter scale (and its modern replacement, the moment magnitude scale) measures earthquake magnitude.' },
      { question: 'What causes ocean tides?', options: ['Wind', 'Gravitational pull of Moon and Sun', 'Earth\'s rotation', 'Underwater volcanoes'], correctIndex: 1, explanation: 'Tides are primarily caused by the gravitational pull of the Moon and, to a lesser extent, the Sun.' },
    ],
    medium: [
      { question: 'What drives the movement of tectonic plates?', options: ['Solar energy', 'Convection currents in the mantle', 'Moon\'s gravity', 'Earth\'s magnetic field'], correctIndex: 1, explanation: 'Convection currents in the semi-fluid asthenosphere drive the movement of tectonic plates.' },
      { question: 'What is the water cycle process where water vapor turns into liquid?', options: ['Evaporation', 'Precipitation', 'Condensation', 'Transpiration'], correctIndex: 2, explanation: 'Condensation is the process where water vapor cools and turns into liquid droplets, forming clouds.' },
      { question: 'Which atmospheric layer contains the ozone layer?', options: ['Troposphere', 'Stratosphere', 'Mesosphere', 'Thermosphere'], correctIndex: 1, explanation: 'The ozone layer is located in the stratosphere, about 15-35 km above Earth\'s surface.' },
      { question: 'What type of rock is marble?', options: ['Igneous', 'Sedimentary', 'Metamorphic', 'Volcanic'], correctIndex: 2, explanation: 'Marble is a metamorphic rock formed when limestone is subjected to heat and pressure.' },
    ],
    hard: [
      { question: 'What is the Mohorovicic discontinuity?', options: ['Boundary between crust and mantle', 'Boundary between mantle and core', 'Boundary between inner and outer core', 'Boundary between lithosphere and asthenosphere'], correctIndex: 0, explanation: 'The Moho discontinuity marks the boundary between Earth\'s crust and the denser mantle below, identified by seismic wave velocity changes.' },
      { question: 'What causes the Earth\'s magnetic field?', options: ['Iron in the crust', 'Convection of liquid iron in the outer core', 'Solar radiation', 'Tectonic plate movement'], correctIndex: 1, explanation: 'Earth\'s magnetic field is generated by convective motion of liquid iron and nickel in the outer core (the geodynamo effect).' },
      { question: 'What is isostasy?', options: ['Study of earthquakes', 'Gravitational equilibrium of Earth\'s lithosphere', 'Formation of mountains', 'Ocean current patterns'], correctIndex: 1, explanation: 'Isostasy is the state of gravitational equilibrium between the lithosphere and asthenosphere, where thicker/lighter crust floats higher.' },
    ],
  },
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const PLUGIN_ID = 'science-quiz';
const QUESTIONS_PER_ROUND = 5;

const CATEGORY_LABELS: Record<Category, string> = {
  'general-science': 'General Science',
  biology: 'Biology',
  physics: 'Physics',
  chemistry: 'Chemistry',
  astronomy: 'Astronomy',
  'earth-science': 'Earth Science',
};

const CATEGORY_ICONS: Record<Category, string> = {
  'general-science': '\u{1F52C}',
  biology: '\u{1F9EC}',
  physics: '\u{269B}',
  chemistry: '\u{2697}',
  astronomy: '\u{1F30C}',
  'earth-science': '\u{1F30D}',
};

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function pickQuestions(category: Category, difficulty: Difficulty): Question[] {
  const pool = QUESTION_BANK[category][difficulty];
  return shuffle(pool).slice(0, QUESTIONS_PER_ROUND);
}

function sendToParent(message: Record<string, unknown>) {
  try {
    window.parent.postMessage(message, '*');
  } catch {
    // silently ignore if no parent
  }
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

function getStyles(theme: Theme) {
  const dark = theme === 'dark';
  return {
    container: {
      width: '100%',
      maxWidth: 560,
      margin: '0 auto',
      padding: 20,
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: dark ? '#e8e8e8' : '#1a1a2e',
      minHeight: '100vh',
      background: dark ? '#1a1a2e' : '#ffffff',
    } as React.CSSProperties,
    /* Progress bar */
    progressOuter: {
      width: '100%',
      height: 6,
      borderRadius: 3,
      background: dark ? '#2d2d4a' : '#e0e7f1',
      marginBottom: 16,
      overflow: 'hidden',
    } as React.CSSProperties,
    progressInner: (pct: number) => ({
      height: '100%',
      borderRadius: 3,
      width: `${pct}%`,
      background: 'linear-gradient(90deg, #0ea5e9, #22d3ee)',
      transition: 'width 0.5s ease',
    }) as React.CSSProperties,
    /* Header */
    header: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    } as React.CSSProperties,
    badge: (bg: string) => ({
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      background: bg,
      color: '#fff',
      marginRight: 6,
    }) as React.CSSProperties,
    score: {
      fontSize: 14,
      fontWeight: 700,
      color: dark ? '#22d3ee' : '#0369a1',
    } as React.CSSProperties,
    /* Question */
    questionNumber: {
      fontSize: 13,
      fontWeight: 600,
      color: dark ? '#94a3b8' : '#64748b',
      marginBottom: 4,
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    } as React.CSSProperties,
    questionText: {
      fontSize: 18,
      fontWeight: 600,
      lineHeight: 1.4,
      marginBottom: 18,
      color: dark ? '#f1f5f9' : '#0f172a',
    } as React.CSSProperties,
    /* Options */
    optionCard: (state: 'idle' | 'correct' | 'incorrect' | 'dimmed', dark: boolean) => {
      let bg = dark ? '#252547' : '#f0f7ff';
      let border = dark ? '#3b3b6b' : '#c7d9f0';
      let color = dark ? '#e2e8f0' : '#1e293b';
      if (state === 'correct') { bg = dark ? '#064e3b' : '#d1fae5'; border = '#10b981'; }
      if (state === 'incorrect') { bg = dark ? '#7f1d1d' : '#fee2e2'; border = '#ef4444'; }
      if (state === 'dimmed') { bg = dark ? '#1e1e3a' : '#f8fafc'; border = dark ? '#2d2d4a' : '#e2e8f0'; color = dark ? '#64748b' : '#94a3b8'; }
      return {
        padding: '12px 16px',
        borderRadius: 10,
        border: `2px solid ${border}`,
        background: bg,
        color,
        cursor: state === 'idle' ? 'pointer' : 'default',
        marginBottom: 10,
        fontSize: 15,
        fontWeight: 500,
        transition: 'all 0.25s ease',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      } as React.CSSProperties;
    },
    optionLabel: (state: 'idle' | 'correct' | 'incorrect' | 'dimmed', dark: boolean) => {
      let bg = dark ? '#3b3b6b' : '#bfdbfe';
      let color = dark ? '#e2e8f0' : '#1e40af';
      if (state === 'correct') { bg = '#10b981'; color = '#fff'; }
      if (state === 'incorrect') { bg = '#ef4444'; color = '#fff'; }
      if (state === 'dimmed') { bg = dark ? '#2d2d4a' : '#e2e8f0'; color = dark ? '#475569' : '#94a3b8'; }
      return {
        width: 28,
        height: 28,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 13,
        background: bg,
        color,
        flexShrink: 0,
      } as React.CSSProperties;
    },
    /* Explanation */
    explanation: {
      marginTop: 4,
      padding: '10px 14px',
      borderRadius: 8,
      fontSize: 13,
      lineHeight: 1.5,
      background: dark ? '#1e1e3a' : '#f0f9ff',
      border: `1px solid ${dark ? '#3b3b6b' : '#bae6fd'}`,
      color: dark ? '#94a3b8' : '#0369a1',
    } as React.CSSProperties,
    nextBtn: {
      marginTop: 16,
      width: '100%',
      padding: '12px 0',
      borderRadius: 10,
      border: 'none',
      fontSize: 15,
      fontWeight: 600,
      cursor: 'pointer',
      background: 'linear-gradient(135deg, #0ea5e9, #06b6d4)',
      color: '#fff',
      transition: 'opacity 0.2s',
    } as React.CSSProperties,
    /* Idle screen */
    idleTitle: {
      fontSize: 28,
      fontWeight: 800,
      textAlign: 'center' as const,
      marginBottom: 6,
      background: 'linear-gradient(135deg, #0ea5e9, #10b981)',
      WebkitBackgroundClip: 'text',
      WebkitTextFillColor: 'transparent',
    } as React.CSSProperties,
    idleSubtitle: {
      textAlign: 'center' as const,
      color: dark ? '#94a3b8' : '#64748b',
      fontSize: 14,
      marginBottom: 24,
    } as React.CSSProperties,
    /* Results */
    resultCircle: (pct: number) => ({
      width: 120,
      height: 120,
      borderRadius: '50%',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 20px',
      background: `conic-gradient(${pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444'} ${pct * 3.6}deg, ${dark ? '#2d2d4a' : '#e2e8f0'} 0deg)`,
    }) as React.CSSProperties,
    resultInner: {
      width: 100,
      height: 100,
      borderRadius: '50%',
      background: dark ? '#1a1a2e' : '#ffffff',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
    } as React.CSSProperties,
    resultPct: {
      fontSize: 28,
      fontWeight: 800,
      color: dark ? '#22d3ee' : '#0369a1',
    } as React.CSSProperties,
    resultLabel: {
      fontSize: 11,
      color: dark ? '#94a3b8' : '#64748b',
      textTransform: 'uppercase' as const,
      letterSpacing: 1,
    } as React.CSSProperties,
  };
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function App() {
  const [theme, setTheme] = useState<Theme>('light');
  const [screen, setScreen] = useState<Screen>('idle');
  const [category, setCategory] = useState<Category>('general-science');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [fadeIn, setFadeIn] = useState(true);

  const pendingMessageId = useRef<string | null>(null);

  /* ---- theme side-effect ---- */
  useEffect(() => {
    document.body.className = theme;
  }, [theme]);

  /* ---- postMessage listener ---- */
  const startQuiz = useCallback((cat: Category, diff: Difficulty, messageId?: string) => {
    const q = pickQuestions(cat, diff);
    setCategory(cat);
    setDifficulty(diff);
    setQuestions(q);
    setCurrentIdx(0);
    setScore(0);
    setSelectedOption(null);
    setAnswered(false);
    setFadeIn(true);
    setScreen('quiz');

    const result = {
      status: 'started',
      category: cat,
      difficulty: diff,
      totalQuestions: q.length,
    };

    if (messageId) {
      sendToParent({ type: 'TOOL_RESULT', pluginId: PLUGIN_ID, messageId, result });
    }

    sendToParent({
      type: 'STATE_UPDATE',
      pluginId: PLUGIN_ID,
      state: { category: cat, difficulty: diff, question: 1, score: 0, total: q.length },
      summary: `Started ${CATEGORY_LABELS[cat]} quiz (${diff}) - Question 1/${q.length}`,
    });
  }, []);

  useEffect(() => {
    // Send PLUGIN_READY immediately on mount (before PLUGIN_INIT)
    sendToParent({ type: 'PLUGIN_READY', pluginId: PLUGIN_ID, messageId: `msg_${Date.now()}`, payload: { version: '1.0.0' } });

    function handleMessage(e: MessageEvent) {
      const data = e.data;
      if (!data || typeof data !== 'object' || !data.type) return;

      switch (data.type) {
        case 'PLUGIN_INIT':
          // Already sent PLUGIN_READY, nothing else needed
          break;

        case 'TOOL_INVOKE': {
          const tool = data.payload?.toolName || data.tool;
          const parameters = data.payload?.parameters || data.parameters;
          const messageId = data.messageId;
          if (tool === 'start_science_quiz') {
            const cat = (parameters?.category || 'general-science') as Category;
            const diff = (parameters?.difficulty || 'medium') as Difficulty;
            startQuiz(cat, diff, messageId);
          } else if (tool === 'get_quiz_score') {
            const result = {
              score,
              totalQuestions: questions.length || QUESTIONS_PER_ROUND,
              currentQuestion: currentIdx + 1,
              category: CATEGORY_LABELS[category],
              difficulty,
              percentage: questions.length > 0 ? Math.round((score / questions.length) * 100) : 0,
              status: screen === 'results' ? 'completed' : screen === 'quiz' ? 'in_progress' : 'not_started',
            };
            sendToParent({ type: 'TOOL_RESULT', pluginId: PLUGIN_ID, messageId, result });
          }
          break;
        }

        case 'THEME_UPDATE':
          if (data.theme === 'dark' || data.theme === 'light') {
            setTheme(data.theme);
          }
          break;

        case 'PLUGIN_DESTROY':
          // cleanup if needed
          break;
      }
    }

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [startQuiz, score, questions, currentIdx, category, difficulty, screen]);

  /* ---- answer handler ---- */
  const handleAnswer = (optIdx: number) => {
    if (answered) return;
    setSelectedOption(optIdx);
    setAnswered(true);

    const isCorrect = optIdx === questions[currentIdx].correctIndex;
    const newScore = isCorrect ? score + 1 : score;
    if (isCorrect) setScore(newScore);

    sendToParent({
      type: 'STATE_UPDATE',
      pluginId: PLUGIN_ID,
      state: {
        category,
        difficulty,
        question: currentIdx + 1,
        score: newScore,
        total: questions.length,
        lastAnswer: isCorrect ? 'correct' : 'incorrect',
      },
      summary: `Q${currentIdx + 1}: ${isCorrect ? 'Correct' : 'Incorrect'} - Score: ${newScore}/${questions.length}`,
    });
  };

  /* ---- next / finish ---- */
  const handleNext = () => {
    if (currentIdx + 1 >= questions.length) {
      setScreen('results');
      const pct = Math.round((score / questions.length) * 100);
      sendToParent({
        type: 'PLUGIN_COMPLETE',
        pluginId: PLUGIN_ID,
        event: 'quiz_completed',
        data: { score, totalQuestions: questions.length, percentage: pct, category, difficulty },
        summary: `Quiz completed! Score: ${score}/${questions.length} (${pct}%)`,
      });
    } else {
      setFadeIn(false);
      setTimeout(() => {
        setCurrentIdx((i) => i + 1);
        setSelectedOption(null);
        setAnswered(false);
        setFadeIn(true);
      }, 200);
    }
  };

  /* ---- render ---- */
  const s = getStyles(theme);
  const dark = theme === 'dark';

  /* Idle Screen */
  if (screen === 'idle') {
    return (
      <div style={s.container}>
        <div style={{ paddingTop: 40 }}>
          <div style={{ textAlign: 'center', fontSize: 48, marginBottom: 8 }}>{'\u{1F52C}'}</div>
          <div style={s.idleTitle}>Science Quiz</div>
          <div style={s.idleSubtitle}>Test your knowledge across six science categories</div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: dark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              Category
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(Object.keys(CATEGORY_LABELS) as Category[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 8,
                    border: `2px solid ${category === cat ? '#0ea5e9' : dark ? '#3b3b6b' : '#e2e8f0'}`,
                    background: category === cat ? (dark ? '#0c4a6e' : '#e0f2fe') : (dark ? '#252547' : '#f8fafc'),
                    color: category === cat ? (dark ? '#38bdf8' : '#0369a1') : (dark ? '#94a3b8' : '#64748b'),
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {CATEGORY_ICONS[cat]} {CATEGORY_LABELS[cat]}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: dark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 6 }}>
              Difficulty
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {(['easy', 'medium', 'hard'] as Difficulty[]).map((d) => {
                const colors: Record<Difficulty, string> = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };
                const sel = difficulty === d;
                return (
                  <button
                    key={d}
                    onClick={() => setDifficulty(d)}
                    style={{
                      flex: 1,
                      padding: '8px 0',
                      borderRadius: 8,
                      border: `2px solid ${sel ? colors[d] : dark ? '#3b3b6b' : '#e2e8f0'}`,
                      background: sel ? colors[d] + '22' : (dark ? '#252547' : '#f8fafc'),
                      color: sel ? colors[d] : (dark ? '#94a3b8' : '#64748b'),
                      fontSize: 14,
                      fontWeight: 700,
                      cursor: 'pointer',
                      textTransform: 'capitalize',
                      transition: 'all 0.2s',
                    }}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            onClick={() => startQuiz(category, difficulty)}
            style={s.nextBtn}
          >
            Start Quiz
          </button>
        </div>
      </div>
    );
  }

  /* Results Screen */
  if (screen === 'results') {
    const pct = Math.round((score / questions.length) * 100);
    const message = pct === 100 ? 'Perfect Score!' : pct >= 80 ? 'Excellent!' : pct >= 60 ? 'Good Job!' : pct >= 40 ? 'Keep Practicing!' : 'Better Luck Next Time!';
    return (
      <div style={s.container}>
        <div style={{ paddingTop: 30 }}>
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700, marginBottom: 20, color: dark ? '#f1f5f9' : '#0f172a' }}>
            Quiz Complete
          </div>
          <div style={s.resultCircle(pct)}>
            <div style={s.resultInner}>
              <div style={s.resultPct}>{pct}%</div>
              <div style={s.resultLabel}>Score</div>
            </div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 700, color: pct >= 80 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444', marginBottom: 4 }}>
            {message}
          </div>
          <div style={{ textAlign: 'center', fontSize: 14, color: dark ? '#94a3b8' : '#64748b', marginBottom: 24 }}>
            You scored {score} out of {questions.length} in {CATEGORY_LABELS[category]} ({difficulty})
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 10,
            marginBottom: 24,
          }}>
            {[
              { label: 'Correct', value: score, color: '#10b981' },
              { label: 'Incorrect', value: questions.length - score, color: '#ef4444' },
              { label: 'Questions', value: questions.length, color: '#0ea5e9' },
            ].map((stat) => (
              <div
                key={stat.label}
                style={{
                  textAlign: 'center',
                  padding: '12px 0',
                  borderRadius: 10,
                  background: dark ? '#252547' : '#f0f7ff',
                  border: `1px solid ${dark ? '#3b3b6b' : '#c7d9f0'}`,
                }}
              >
                <div style={{ fontSize: 24, fontWeight: 800, color: stat.color }}>{stat.value}</div>
                <div style={{ fontSize: 11, color: dark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <button onClick={() => startQuiz(category, difficulty)} style={s.nextBtn}>
            Play Again
          </button>
          <button
            onClick={() => { setScreen('idle'); setQuestions([]); setCurrentIdx(0); setScore(0); }}
            style={{
              ...s.nextBtn,
              marginTop: 10,
              background: dark ? '#252547' : '#f0f7ff',
              color: dark ? '#94a3b8' : '#0369a1',
              border: `2px solid ${dark ? '#3b3b6b' : '#bae6fd'}`,
            }}
          >
            Change Category
          </button>
        </div>
      </div>
    );
  }

  /* Quiz Screen */
  const q = questions[currentIdx];
  if (!q) return null;
  const progress = ((currentIdx + (answered ? 1 : 0)) / questions.length) * 100;
  const optionLetters = ['A', 'B', 'C', 'D'];
  const diffColors: Record<Difficulty, string> = { easy: '#10b981', medium: '#f59e0b', hard: '#ef4444' };

  return (
    <div style={s.container}>
      {/* Progress bar */}
      <div style={s.progressOuter}>
        <div style={s.progressInner(progress)} />
      </div>

      {/* Header */}
      <div style={s.header}>
        <div>
          <span style={s.badge('#0ea5e9')}>{CATEGORY_ICONS[category]} {CATEGORY_LABELS[category]}</span>
          <span style={s.badge(diffColors[difficulty])}>{difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</span>
        </div>
        <div style={s.score}>
          {score}/{questions.length}
        </div>
      </div>

      {/* Question area with fade transition */}
      <div
        style={{
          opacity: fadeIn ? 1 : 0,
          transform: fadeIn ? 'translateY(0)' : 'translateY(8px)',
          transition: 'opacity 0.25s ease, transform 0.25s ease',
        }}
      >
        <div style={s.questionNumber}>
          Question {currentIdx + 1} of {questions.length}
        </div>
        <div style={s.questionText}>{q.question}</div>

        {/* Options */}
        {q.options.map((opt, idx) => {
          let state: 'idle' | 'correct' | 'incorrect' | 'dimmed' = 'idle';
          if (answered) {
            if (idx === q.correctIndex) state = 'correct';
            else if (idx === selectedOption) state = 'incorrect';
            else state = 'dimmed';
          }
          return (
            <div
              key={idx}
              style={s.optionCard(state, dark)}
              onClick={() => handleAnswer(idx)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleAnswer(idx); }}
            >
              <div style={s.optionLabel(state, dark)}>
                {state === 'correct' ? '\u2713' : state === 'incorrect' ? '\u2717' : optionLetters[idx]}
              </div>
              <span>{opt}</span>
            </div>
          );
        })}

        {/* Explanation + Next */}
        {answered && (
          <div style={{ animation: 'fadeIn 0.3s ease' }}>
            <div style={s.explanation}>
              <strong>{selectedOption === q.correctIndex ? 'Correct! ' : 'Incorrect. '}</strong>
              {q.explanation}
            </div>
            <button onClick={handleNext} style={s.nextBtn}>
              {currentIdx + 1 >= questions.length ? 'See Results' : 'Next Question'}
            </button>
          </div>
        )}
      </div>

      {/* Inline keyframe for fadeIn animation */}
      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}
