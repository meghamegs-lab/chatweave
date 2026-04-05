import { useState, useEffect, useCallback, useRef } from 'react';

// ─── Inline SDK bridge (same pattern as chess plugin) ────────────────────────

let messageCounter = 0;
function generateMessageId(): string {
  return `msg_${Date.now()}_${++messageCounter}`;
}

function sendToParent(message: any): void {
  if (window.parent && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

// ─── Types ───────────────────────────────────────────────────────────────────

type ChallengeMode = 'fake-news' | 'source-check' | 'bias-spotter' | 'ad-detective' | 'debate-builder';
type Difficulty = 'beginner' | 'intermediate' | 'advanced';
type ThemeMode = 'light' | 'dark';

interface HeadlineItem {
  id: string;
  headline: string;
  source: string;
  snippet: string;
  verdict: 'real' | 'misleading' | 'fake';
  explanation: string;
  checklist: { sourceCredibility: boolean; evidenceCited: boolean; emotionalLanguage: boolean; tooGoodToBeTrue: boolean };
}

interface SourceItem {
  id: string;
  claim: string;
  sources: { id: string; label: string; type: string; reliability: number; description: string }[];
  correctOrder: string[];
}

interface BiasItem {
  id: string;
  title: string;
  paragraph: string;
  biasedPhrases: { start: number; end: number; type: string; explanation: string }[];
}

interface AdItem {
  id: string;
  title: string;
  content: string;
  isAd: boolean;
  technique: string;
  explanation: string;
}

interface DebateTopic {
  id: string;
  topic: string;
  sideA: string;
  sideB: string;
  evidenceCards: { id: string; text: string; quality: 'strong' | 'moderate' | 'weak'; side: 'A' | 'B' | 'both' }[];
}

interface PlayerProgress {
  totalChallenges: number;
  correctAnswers: number;
  streakCurrent: number;
  streakBest: number;
  modeScores: Record<ChallengeMode, { attempted: number; correct: number }>;
  badge: string;
  badgeLevel: number;
  skillScores: { sourceEval: number; biasDetection: number; factChecking: number; adAwareness: number; argumentation: number };
}

// ─── Content Bank ────────────────────────────────────────────────────────────

const HEADLINES: Record<Difficulty, HeadlineItem[]> = {
  beginner: [
    { id: 'b1', headline: 'Scientists Confirm Chocolate Is Officially a Vegetable', source: 'The Daily Spoof', snippet: 'A groundbreaking study from an unnamed lab has confirmed that chocolate contains enough plant material to be classified as a vegetable. Experts recommend three bars daily.', verdict: 'fake', explanation: 'This is completely fabricated. Chocolate comes from cacao beans, but no legitimate scientific body has classified it as a vegetable. The "unnamed lab" is a red flag, and no real experts would recommend eating three chocolate bars daily.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: false, tooGoodToBeTrue: true } },
    { id: 'b2', headline: 'NASA\'s James Webb Space Telescope Captures New Images of Distant Galaxies', source: 'Associated Press', snippet: 'NASA released stunning new images from the James Webb Space Telescope showing galaxies formed in the early universe, helping scientists understand how stars and galaxies evolved over billions of years.', verdict: 'real', explanation: 'This is a real news story. NASA regularly releases images from the James Webb Space Telescope. The source (Associated Press) is a well-established news wire service, and the claims are consistent with the telescope\'s known capabilities.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'b3', headline: 'School District Bans Homework Forever After Study Shows It Causes Stress', source: 'ViralNewsNow.biz', snippet: 'One small town school district has permanently banned all homework after a parent survey showed 90% of students feel stressed. The superintendent says "learning should only happen in school."', verdict: 'fake', explanation: 'While homework debates are real, this story uses a suspicious source domain (.biz), cites only a "parent survey" rather than research, and the superintendent\'s absolute quote is unrealistic. No verified school district has "permanently banned all homework."', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: true } },
    { id: 'b4', headline: 'Global Temperatures in 2024 Were the Hottest on Record, Climate Agencies Report', source: 'Reuters', snippet: 'Multiple international climate agencies confirmed that 2024 global average temperatures exceeded previous records, continuing a decades-long warming trend linked to greenhouse gas emissions.', verdict: 'real', explanation: 'This is consistent with verified reports from agencies like NASA, NOAA, and the WMO. Reuters is a reputable international news agency. The claim is supported by multiple independent data sources.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'b5', headline: 'Teen Earns $50 Million Playing Video Games From His Bedroom', source: 'ClickBaitKing.com', snippet: 'An anonymous 13-year-old reportedly made $50 million last year playing video games from home. Game companies are now begging him to promote their products.', verdict: 'fake', explanation: 'While some professional gamers earn significant money, $50 million for an anonymous 13-year-old is wildly exaggerated. The source name itself ("ClickBaitKing") is a warning sign. No verifiable details are provided.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: true } },
    { id: 'b6', headline: 'New York City Public Libraries Report Record Number of Visitors in 2024', source: 'The New York Times', snippet: 'The New York Public Library system saw a record 40 million visits across its branches in 2024, driven by expanded programming for teens and free technology access.', verdict: 'real', explanation: 'Public library usage statistics are regularly reported. The New York Times is a credible newspaper, and the specific details (40 million visits, teen programs, tech access) are verifiable claims consistent with real library trends.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'b7', headline: 'Eating Ice Cream for Breakfast Makes You Smarter, Scientists Say', source: 'FunFacts Daily', snippet: 'Japanese researchers discovered that people who eat ice cream first thing in the morning show increased alertness and mental performance compared to those who don\'t.', verdict: 'misleading', explanation: 'This is based on a real (but misrepresented) study by Professor Yoshihiko Koga. The actual study found that cold stimulus increases alertness briefly -- any cold food would do the same. The headline makes it sound like ice cream specifically boosts intelligence, which is misleading.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: false, tooGoodToBeTrue: true } },
    { id: 'b8', headline: 'SpaceX Successfully Launches Crew to International Space Station', source: 'BBC News', snippet: 'SpaceX\'s Crew Dragon capsule launched four astronauts to the International Space Station as part of NASA\'s Commercial Crew Program, marking the company\'s latest successful crewed mission.', verdict: 'real', explanation: 'SpaceX regularly launches crew missions to the ISS. BBC News is a well-established international news source. The details are consistent with the real Commercial Crew Program.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'b9', headline: 'Wi-Fi Signals Proven to Cause Headaches in 98% of People', source: 'NaturalHealthTruth.org', snippet: 'A shocking new study proves that Wi-Fi radiation causes severe headaches in nearly all people exposed to it. Experts urge families to disconnect immediately.', verdict: 'fake', explanation: 'No credible scientific study has shown Wi-Fi signals cause headaches in 98% of people. The source (.org does not guarantee credibility), the extreme percentage, and the alarmist "disconnect immediately" language are all red flags. Electromagnetic hypersensitivity has been studied and not linked to Wi-Fi in controlled trials.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: false } },
    { id: 'b10', headline: 'City of Chicago Opens New Public Skate Park for Youth', source: 'Chicago Tribune', snippet: 'The City of Chicago opened a new 25,000-square-foot public skate park on the South Side, part of a $10 million investment in youth recreation spaces across underserved neighborhoods.', verdict: 'real', explanation: 'This is a straightforward local news story from a credible regional newspaper. The specific details (location, size, budget) are verifiable, and city investment in recreation is common news.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'b11', headline: 'Dogs Can Now Learn to Read English With New Training Program', source: 'PetNewsToday.net', snippet: 'A revolutionary new training program claims that dogs can learn to recognize and respond to written English words, with some dogs reportedly reading at a first-grade level.', verdict: 'fake', explanation: 'Dogs cannot read English. While dogs can be trained to respond to visual cues and symbols, they do not process written language. The claim of "first-grade reading level" is absurd. The source is not a recognized authority on animal behavior.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: false, tooGoodToBeTrue: true } },
  ],
  intermediate: [
    { id: 'i1', headline: 'Study Finds Social Media Use Linked to 50% Drop in Teen Attention Spans', source: 'The Daily Report', snippet: 'A new university study surveyed 200 teens and found that heavy social media users scored 50% lower on attention tests compared to non-users, prompting calls for phone bans in schools.', verdict: 'misleading', explanation: 'While some studies do find correlations between social media and attention, this headline overstates the findings. A survey of only 200 teens is a small sample. "50% drop" sounds dramatic but correlation does not equal causation. The headline presents this as definitive when the evidence is preliminary.', checklist: { sourceCredibility: false, evidenceCited: true, emotionalLanguage: true, tooGoodToBeTrue: false } },
    { id: 'i2', headline: 'Electric Vehicle Sales Surpass Gas Cars in Norway for Third Consecutive Year', source: 'Reuters', snippet: 'Norway\'s Road Traffic Information Council reported that battery electric vehicles accounted for over 80% of all new car sales in 2024, continuing the country\'s lead in EV adoption driven by tax incentives and charging infrastructure.', verdict: 'real', explanation: 'Norway is indeed a global leader in EV adoption. Reuters is a highly reliable news agency. The specific statistic (80%+ market share) is consistent with verified reports from Norwegian authorities. This is factual reporting with cited data.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'i3', headline: 'New App Guarantees Your Child Will Get Straight A\'s or Your Money Back', source: 'Sponsored Content — EduTech Inc.', snippet: 'Revolutionary AI-powered tutoring app promises to improve any student\'s grades to straight A\'s within 30 days. Over 1 million parents have already signed up!', verdict: 'fake', explanation: 'No app can "guarantee" straight A\'s -- academic performance depends on many factors. This is sponsored (paid) content disguised as news. The "1 million parents" claim is unverifiable. Absolute guarantees about educational outcomes are a classic marketing red flag.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: true } },
    { id: 'i4', headline: 'Ocean Plastic Pollution Reduced by 30% in Coastal Cleanup Regions', source: 'National Geographic', snippet: 'A decade-long study published in the journal Science found that sustained coastal cleanup efforts in targeted regions reduced visible ocean plastic by approximately 30%, though microplastic levels remain largely unchanged.', verdict: 'real', explanation: 'National Geographic is a credible source, and the claim references a specific journal (Science). The nuance about microplastics remaining unchanged adds credibility -- real news includes limitations. The 30% figure is specific and plausible for targeted regions.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'i5', headline: 'Violent Video Games Cause Kids to Become Aggressive, Major Study Confirms', source: 'ParentWatch Magazine', snippet: 'A comprehensive review of gaming research has once and for all confirmed that playing violent video games directly causes increased aggression and violent behavior in children and teenagers.', verdict: 'misleading', explanation: 'While some studies find small correlations between violent games and short-term aggressive thoughts, the scientific consensus does NOT support a direct causal link to violent behavior. The headline uses "once and for all confirmed" which no legitimate study would claim. The source is an advocacy-oriented magazine, not a peer-reviewed journal.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: false } },
    { id: 'i6', headline: 'FDA Approves First Gene Therapy Treatment for Sickle Cell Disease', source: 'The Washington Post', snippet: 'The FDA approved two groundbreaking gene therapies for sickle cell disease, offering potentially curative options for patients with the painful blood disorder that affects approximately 100,000 Americans.', verdict: 'real', explanation: 'This is a real, verified news story. The FDA did approve gene therapies (Casgevy and Lyfgenia) for sickle cell disease. The Washington Post is a credible newspaper, and the details including patient population numbers are accurate.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'i7', headline: '9 Out of 10 Dentists Say This One Fruit Whitens Teeth Instantly', source: 'HealthHacks.co', snippet: 'Dentists across America are recommending strawberries as a natural tooth whitener. Just rub them on your teeth for 5 minutes daily and see results overnight!', verdict: 'misleading', explanation: 'The "9 out of 10 dentists" claim is a classic advertising trope with no cited survey. While strawberries contain malic acid that can have mild effects on stain appearance, no dentist would claim they "whiten teeth instantly." The advice could actually damage enamel. This is health misinformation disguised as a tip.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: true } },
    { id: 'i8', headline: 'Teens Who Read for Pleasure Score Higher on Standardized Tests, Data Shows', source: 'Education Week', snippet: 'Analysis of national assessment data shows that students who read for pleasure at least 30 minutes daily score significantly higher on reading and math portions of standardized tests, controlling for socioeconomic factors.', verdict: 'real', explanation: 'Education Week is a respected education publication. The claim cites specific data (national assessment, controlling for socioeconomic factors) and the correlation between reading and test scores is well-established in educational research. The "30 minutes daily" is a specific, reasonable metric.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'i9', headline: 'New Research Shows Homework Has Zero Educational Benefit', source: 'FreeKids Blog', snippet: 'Groundbreaking research from an international team proves that homework provides absolutely no educational benefit and may actually harm learning. "It\'s just busywork," says lead researcher.', verdict: 'misleading', explanation: 'The homework debate is real, but "zero educational benefit" is an extreme overstatement. Research by Harris Cooper and others shows a nuanced picture: homework benefits vary by age and type. The quote "just busywork" is editorialized. A blog is not a reliable primary source for research claims.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: true } },
    { id: 'i10', headline: 'Microplastics Found in Human Blood for the First Time, Dutch Study Reveals', source: 'The Guardian', snippet: 'Scientists at Vrije Universiteit Amsterdam detected microplastic particles in human blood samples for the first time, with plastic found in 80% of participants tested, raising concerns about potential health effects.', verdict: 'real', explanation: 'This is a real study published in the journal Environment International in 2022, reported by The Guardian, a reputable newspaper. The specific details (Vrije Universiteit Amsterdam, 80% of participants) match the actual study findings.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
  ],
  advanced: [
    { id: 'a1', headline: 'New Study Links Organic Food to 25% Lower Cancer Risk', source: 'Health & Wellness Journal', snippet: 'A French study of 69,000 adults published in JAMA Internal Medicine found that those who ate the most organic food had a 25% lower risk of developing cancer compared to those who ate the least organic food.', verdict: 'misleading', explanation: 'This references a real study (the NutriNet-Sante study), but the headline oversimplifies it. The study found an association, not a causal link. People who choose organic food also tend to have healthier lifestyles overall (more exercise, less smoking). The 25% figure is the relative risk reduction, which sounds more dramatic than the absolute risk difference. This is a classic case of correlation vs. causation.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a2', headline: 'AI System Outperforms Doctors in Diagnosing Skin Cancer', source: 'MIT Technology Review', snippet: 'A deep learning system trained on 130,000 skin images matched or exceeded the diagnostic accuracy of 21 board-certified dermatologists in identifying melanoma, according to a study published in the Annals of Oncology.', verdict: 'real', explanation: 'This references real research. Multiple studies have shown AI can match dermatologists in classifying skin lesions from images. MIT Technology Review is a credible tech publication, and the specific journal (Annals of Oncology) is a real peer-reviewed journal. The claim is specific and verifiable.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a3', headline: 'Country With Strictest Gun Laws Has Highest Gun Violence Rate', source: 'Freedom Policy Institute', snippet: 'Analysis by our research team shows that the country with the world\'s most restrictive gun legislation actually has the highest per-capita rate of gun violence, proving that gun control doesn\'t work.', verdict: 'misleading', explanation: 'This cherry-picks one data point to draw a sweeping conclusion. It does not name which country, uses vague "our research team" (a think tank, not independent research), and ignores that most countries with strict gun laws have low gun violence. The word "proving" signals bias -- single data points don\'t prove broad claims. This is a classic cherry-picking fallacy.', checklist: { sourceCredibility: false, evidenceCited: false, emotionalLanguage: true, tooGoodToBeTrue: false } },
    { id: 'a4', headline: 'Renewable Energy Now Cheaper Than Fossil Fuels in Most Countries', source: 'International Renewable Energy Agency', snippet: 'IRENA\'s latest report finds that newly installed renewable power generation capacity had lower costs than the cheapest fossil fuel option in countries representing over two-thirds of the world\'s population.', verdict: 'real', explanation: 'IRENA is a legitimate intergovernmental organization. This claim is consistent with their published reports and verified by multiple independent analyses. The specific framing ("newly installed capacity" and "two-thirds of world population") provides appropriate nuance rather than oversimplifying.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a5', headline: 'Study Proves Smartphones Are Rewiring Children\'s Brains', source: 'Digital Wellness News', snippet: 'Neuroscientists used MRI scans to show that children who use smartphones more than 3 hours daily have measurably different brain structures compared to light users, with areas linked to attention and impulse control being significantly smaller.', verdict: 'misleading', explanation: 'This references real research (like the NIH ABCD study), but "rewiring brains" and "proves" overstate the findings. Brain differences in heavy users could be a cause or effect (do phones change brains, or do kids with certain brain types use phones more?). MRI snapshots show correlation, not causation. "Significantly smaller" in statistics has a different meaning than in everyday language.', checklist: { sourceCredibility: false, evidenceCited: true, emotionalLanguage: true, tooGoodToBeTrue: false } },
    { id: 'a6', headline: 'Ancient Humans Coexisted With Giant Sloths in the Americas, Fossil Evidence Shows', source: 'Smithsonian Magazine', snippet: 'Fossilized footprints found at White Sands National Park in New Mexico show that ancient humans walked alongside and likely hunted giant ground sloths approximately 11,000 years ago, reshaping our understanding of early American ecosystems.', verdict: 'real', explanation: 'This is a real archaeological discovery. Smithsonian Magazine is a highly credible publication. The White Sands footprints are well-documented in peer-reviewed journals (Science). The interplay of human and megafauna footprints is a verified finding.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a7', headline: 'Mediterranean Diet Reduces Heart Disease Risk by 30%, Landmark Trial Shows', source: 'The New England Journal of Medicine', snippet: 'The PREDIMED trial, involving 7,447 participants over 5 years, found that a Mediterranean diet supplemented with olive oil or nuts reduced cardiovascular events by approximately 30% compared to a low-fat diet control group.', verdict: 'misleading', explanation: 'The PREDIMED trial is real, but the original 2013 study was retracted and republished in 2018 due to randomization issues at some sites. The re-analysis still showed benefits but with wider confidence intervals. Presenting this without mentioning the retraction and re-analysis is misleading by omission. It also compares to a low-fat diet, not a typical diet.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a8', headline: 'Scientists Discover New Species of Whale in Gulf of Mexico', source: 'NOAA Fisheries', snippet: 'Researchers have identified a previously unknown species of baleen whale, Rice\'s whale, in the Gulf of Mexico. With an estimated population of fewer than 100 individuals, it is considered one of the most endangered whales on Earth.', verdict: 'real', explanation: 'Rice\'s whale (Balaenoptera ricei) was officially described as a new species in 2021. NOAA Fisheries is a credible government scientific agency. The population estimate and endangered status are consistent with published research.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
    { id: 'a9', headline: 'Exposure to Nature Boosts Immune System by 50%, Forest Bathing Study Finds', source: 'Wellness Research Quarterly', snippet: 'Japanese researchers measured natural killer cell activity in participants before and after three-day forest visits, finding a 50% increase in immune cell activity that persisted for up to 30 days, attributed to phytoncides released by trees.', verdict: 'misleading', explanation: 'This references real research on "shinrin-yoku" (forest bathing) by Dr. Qing Li. However, "boosts immune system by 50%" oversimplifies: one marker (NK cell activity) increased in a small study, which does not equal overall immune system boosting by 50%. The source journal name sounds generic. Small sample sizes and lack of controlled conditions limit the conclusions.', checklist: { sourceCredibility: false, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: true } },
    { id: 'a10', headline: 'Study Claims Cell Phones Cause Brain Tumors, But Data Tells a Different Story', source: 'Science-Based Medicine', snippet: 'Despite decades of concern, large-scale epidemiological studies including the Interphone study and Danish cohort study have not found a consistent link between cell phone use and brain tumors. Brain cancer rates have remained stable even as phone use has skyrocketed.', verdict: 'real', explanation: 'Science-Based Medicine is a credible evidence-review publication. The Interphone and Danish cohort studies are real, well-known studies. The claim that brain cancer rates have not increased despite massive phone adoption is consistent with surveillance data. This is well-sourced, nuanced reporting.', checklist: { sourceCredibility: true, evidenceCited: true, emotionalLanguage: false, tooGoodToBeTrue: false } },
  ],
};

const SOURCE_ITEMS: Record<Difficulty, SourceItem[]> = {
  beginner: [
    { id: 'sb1', claim: 'The Earth\'s average temperature has risen by about 1.1 degrees Celsius since pre-industrial times.', sources: [
      { id: 's1', label: 'NASA Climate Change', type: 'Government Agency', reliability: 4, description: 'Official NASA climate data page citing satellite measurements and peer-reviewed research' },
      { id: 's2', label: 'WeatherFanBlog.com', type: 'Personal Blog', reliability: 1, description: 'A weather enthusiast\'s blog with personal opinions about climate trends' },
      { id: 's3', label: 'BBC News', type: 'Major News Outlet', reliability: 3, description: 'BBC Science section reporting on the latest IPCC report findings' },
      { id: 's4', label: 'Nature (Journal)', type: 'Peer-Reviewed Journal', reliability: 4, description: 'Original research paper analyzing global temperature datasets' },
    ], correctOrder: ['s4', 's1', 's3', 's2'] },
    { id: 'sb2', claim: 'A new vaccine has been developed for a common childhood illness.', sources: [
      { id: 's5', label: 'World Health Organization', type: 'International Agency', reliability: 4, description: 'WHO press release about vaccine approval after Phase 3 clinical trials' },
      { id: 's6', label: '@HealthGuru123 on Twitter', type: 'Social Media Post', reliability: 1, description: 'An anonymous account sharing a screenshot of a headline about the vaccine' },
      { id: 's7', label: 'The Lancet', type: 'Peer-Reviewed Journal', reliability: 4, description: 'Original Phase 3 clinical trial results with full methodology and data' },
      { id: 's8', label: 'CNN Health', type: 'Major News Outlet', reliability: 3, description: 'News article interviewing doctors about the vaccine with links to the study' },
    ], correctOrder: ['s7', 's5', 's8', 's6'] },
  ],
  intermediate: [
    { id: 'si1', claim: 'Playing video games can improve problem-solving skills in teenagers.', sources: [
      { id: 's9', label: 'Journal of Educational Psychology', type: 'Peer-Reviewed Journal', reliability: 4, description: 'Controlled study of 500 teens measuring cognitive skills before and after gaming interventions' },
      { id: 's10', label: 'GamerReview.gg', type: 'Gaming Website', reliability: 1, description: 'Gaming site article titled "Why Gaming Makes You Smarter" with no cited research' },
      { id: 's11', label: 'PBS NewsHour', type: 'Public Broadcasting', reliability: 3, description: 'Balanced segment interviewing researchers from multiple universities about gaming and cognition' },
      { id: 's12', label: 'University of Oxford Press Release', type: 'University Research', reliability: 3, description: 'Press release summarizing their latest peer-reviewed study on gaming benefits and limitations' },
    ], correctOrder: ['s9', 's12', 's11', 's10'] },
    { id: 'si2', claim: 'Microplastics have been found in bottled water brands worldwide.', sources: [
      { id: 's13', label: 'Environmental Science & Technology', type: 'Peer-Reviewed Journal', reliability: 4, description: 'Peer-reviewed analysis testing 250 bottles from 11 brands across 9 countries' },
      { id: 's14', label: 'A TikTok video with 2M views', type: 'Social Media', reliability: 1, description: 'An influencer claims "ALL water is toxic" while showing a single unverified test' },
      { id: 's15', label: 'WHO Technical Brief', type: 'International Agency', reliability: 4, description: 'WHO assessment of microplastics in drinking water including risk analysis and methodology review' },
      { id: 's16', label: 'The New York Times', type: 'Major Newspaper', reliability: 3, description: 'Investigative piece linking to the journal study and including expert commentary' },
    ], correctOrder: ['s13', 's15', 's16', 's14'] },
  ],
  advanced: [
    { id: 'sa1', claim: 'Artificial intelligence will replace 40% of jobs within the next 15 years.', sources: [
      { id: 's17', label: 'McKinsey Global Institute Report', type: 'Industry Report', reliability: 3, description: 'Detailed economic modeling of automation potential across 800 occupations in 46 countries' },
      { id: 's18', label: 'OECD Employment Outlook', type: 'Intergovernmental Report', reliability: 4, description: 'Annual analysis using different methodology that estimates 14% of jobs at high risk of automation' },
      { id: 's19', label: 'AI entrepreneur\'s keynote speech', type: 'Industry Speaker', reliability: 2, description: 'Tech CEO claiming "AI will replace most workers" at an industry conference (selling AI products)' },
      { id: 's20', label: 'MIT Technology Review', type: 'Tech Publication', reliability: 3, description: 'Analysis comparing multiple automation studies and explaining why predictions vary so widely' },
    ], correctOrder: ['s18', 's17', 's20', 's19'] },
    { id: 'sa2', claim: 'Intermittent fasting leads to significant weight loss and improved health markers.', sources: [
      { id: 's21', label: 'New England Journal of Medicine Review', type: 'Peer-Reviewed Review', reliability: 4, description: 'Systematic review of 27 clinical trials examining intermittent fasting outcomes' },
      { id: 's22', label: 'Dr. FastTrack\'s YouTube Channel', type: 'Social Media / Influencer', reliability: 1, description: 'Popular health influencer selling a fasting course, citing personal testimonials' },
      { id: 's23', label: 'Mayo Clinic Health Letter', type: 'Medical Institution', reliability: 3, description: 'Patient-facing summary of current evidence on intermittent fasting with balanced pros and cons' },
      { id: 's24', label: 'A Reddit thread with 5K upvotes', type: 'Social Media Forum', reliability: 1, description: 'Collection of personal anecdotes about fasting results with no medical citations' },
    ], correctOrder: ['s21', 's23', 's22', 's24'] },
  ],
};

const BIAS_ITEMS: Record<Difficulty, BiasItem[]> = {
  beginner: [
    { id: 'bb1', title: 'New Park Proposal', paragraph: 'The OUTRAGEOUS new park proposal will WASTE $2 million of YOUR hard-earned tax dollars on a project that NOBODY asked for. City officials, who clearly don\'t care about residents, claim it will "benefit the community," but everyone knows this is just another example of government throwing money away.', biasedPhrases: [
      { start: 4, end: 14, type: 'Loaded Language', explanation: '"OUTRAGEOUS" is an emotional word designed to make you angry before you even know the details.' },
      { start: 35, end: 40, type: 'Loaded Language', explanation: '"WASTE" assumes the conclusion. A neutral article would say "spend" or "allocate" and let you decide.' },
      { start: 56, end: 73, type: 'Emotional Appeal', explanation: '"YOUR hard-earned" is designed to make you feel personally attacked and protective of your money.' },
      { start: 97, end: 113, type: 'Missing Context', explanation: '"NOBODY asked for" -- was there a community survey? Were public meetings held? This claim has no evidence.' },
      { start: 120, end: 154, type: 'Loaded Language', explanation: '"clearly don\'t care about residents" is an assumption presented as fact with no evidence.' },
      { start: 194, end: 209, type: 'One-Sided Argument', explanation: '"everyone knows" is a bandwagon claim. It presents one opinion as universal agreement.' },
    ] },
    { id: 'bb2', title: 'School Lunch Changes', paragraph: 'The school board has made a BRILLIANT decision to overhaul the lunch menu with organic options. Only someone who doesn\'t care about children\'s health could possibly object. The new menu, which costs just a tiny bit more, will TRANSFORM our kids into healthier, happier students. Critics are obviously just being cheap.', biasedPhrases: [
      { start: 29, end: 38, type: 'Loaded Language', explanation: '"BRILLIANT" assumes the decision is good before presenting any evidence.' },
      { start: 89, end: 140, type: 'Emotional Appeal', explanation: 'This is an ad hominem attack -- it implies anyone who disagrees doesn\'t care about children.' },
      { start: 164, end: 180, type: 'Missing Context', explanation: '"just a tiny bit more" minimizes cost without providing actual numbers. How much more?' },
      { start: 186, end: 195, type: 'Loaded Language', explanation: '"TRANSFORM" is hyperbolic. Menu changes can improve nutrition but probably won\'t "transform" students.' },
      { start: 232, end: 264, type: 'One-Sided Argument', explanation: 'Dismissing all critics as "obviously just being cheap" ignores that there may be valid concerns.' },
    ] },
  ],
  intermediate: [
    { id: 'bi1', title: 'Technology in Schools', paragraph: 'While some old-fashioned educators cling to dusty textbooks, forward-thinking schools are embracing AI-powered learning. Studies overwhelmingly show that technology improves outcomes, and students who use AI tools consistently outperform their peers. The few teachers who resist are simply afraid of being replaced.', biasedPhrases: [
      { start: 11, end: 25, type: 'Loaded Language', explanation: '"old-fashioned" frames cautious educators negatively. Preferring traditional methods isn\'t inherently wrong.' },
      { start: 36, end: 52, type: 'Loaded Language', explanation: '"dusty textbooks" uses imagery to make traditional resources seem outdated and inferior.' },
      { start: 54, end: 70, type: 'Loaded Language', explanation: '"forward-thinking" implies only tech-adopting schools are progressive -- this is a false dichotomy.' },
      { start: 94, end: 112, type: 'Missing Context', explanation: '"Studies overwhelmingly show" -- which studies? From whom? This is a vague appeal to authority with no citations.' },
      { start: 139, end: 178, type: 'One-Sided Argument', explanation: '"consistently outperform" -- this ignores research showing mixed results and that context matters significantly.' },
      { start: 184, end: 253, type: 'Emotional Appeal', explanation: 'Claiming teachers who resist are "afraid of being replaced" is a personal attack that dismisses legitimate pedagogical concerns.' },
    ] },
  ],
  advanced: [
    { id: 'ba1', title: 'Youth Sports Participation', paragraph: 'A recent survey of 1,200 parents found that 67% believe youth sports build character. While participation rates have declined 8% since 2019, organized sports remain popular. However, some researchers note that the character-building benefits primarily appear in studies funded by sports organizations, raising questions about research independence. Meanwhile, the American Academy of Pediatrics recommends limiting single-sport specialization before age 15 due to injury risks.', biasedPhrases: [
      { start: 0, end: 75, type: 'Missing Context', explanation: 'A parent survey measures opinion, not fact. "67% believe" doesn\'t mean sports actually build character -- this conflates belief with evidence.' },
      { start: 170, end: 314, type: 'Missing Context', explanation: 'This is actually good critical analysis -- it notes potential funding bias. But the word "some" minimizes how widespread this concern is in research methodology.' },
    ] },
  ],
};

const AD_ITEMS: Record<Difficulty, AdItem[]> = {
  beginner: [
    { id: 'ab1', title: 'Amazing Energy Drink Review', content: 'You NEED to try ZapBlast Energy! I\'ve been drinking it every morning and my grades went up, I have more energy for sports, and I feel amazing. Use code STUDENT20 for 20% off your first order! #ZapBlast #Ad #Sponsored', isAd: true, technique: 'Testimonial + Influencer', explanation: 'This is a sponsored post. The hashtags #Ad and #Sponsored reveal it, but they\'re easy to miss. The personal testimonial ("my grades went up") and discount code are classic advertising techniques.' },
    { id: 'ab2', title: 'Local Library Hosts Coding Workshop', content: 'The Riverside Public Library will host a free coding workshop for teens ages 12-17 this Saturday from 2-4 PM. No experience needed. Laptops will be provided. Register at the library front desk or call 555-0123. Space is limited to 20 participants.', isAd: false, technique: 'None', explanation: 'This is genuine community information. It\'s from a public institution (library), the event is free, there\'s no product being sold, and it includes specific logistical details typical of public announcements.' },
    { id: 'ab3', title: 'Top 10 Study Apps Every Student Needs', content: 'We tested dozens of study apps and here are our top picks! #1 is StudyPro Premium ($9.99/month) -- it changed our lives! Note: StudyPro is a sponsor of this page. Other great options include free apps like Quizlet and Khan Academy...', isAd: true, technique: 'Native Advertising / Sponsored Ranking', explanation: 'While it looks like an independent review, the #1 pick is their sponsor. The disclosure ("Note: StudyPro is a sponsor") is buried in the middle. Genuine reviews don\'t rank sponsors first and put free alternatives at the end.' },
    { id: 'ab4', title: 'Severe Weather Expected This Weekend', content: 'The National Weather Service has issued a winter storm warning for the Greater Metro area from Friday evening through Sunday morning. Expected accumulation of 8-12 inches of snow. Schools may be affected. Check local announcements for closures.', isAd: false, technique: 'None', explanation: 'This is a public safety announcement from a government agency (NWS). It provides factual weather information with no products mentioned and no persuasive techniques.' },
    { id: 'ab5', title: 'Every Teen Is Wearing These Shoes', content: 'If you\'re not wearing FlexKick sneakers, you\'re literally the only one. All the coolest students at school have already switched. Don\'t be left out -- get yours before they sell out! Limited edition colors available NOW.', isAd: true, technique: 'Bandwagon + Scarcity', explanation: 'This uses the bandwagon technique ("everyone is doing it") and artificial scarcity ("before they sell out," "limited edition") to create urgency and social pressure. The claim that you\'re "literally the only one" is false.' },
  ],
  intermediate: [
    { id: 'ai1', title: 'Celebrity Chef\'s Healthy Cooking Tips', content: 'Celebrity chef Maria Santos shares her 5 favorite quick recipes for busy students. "I always use OrganicFresh produce because I care about what my family eats," says Santos. Each recipe takes under 15 minutes and costs less than $5 per serving. OrganicFresh -- Fuel Your Family.', isAd: true, technique: 'Celebrity Endorsement + Native Content', explanation: 'This blends genuine cooking advice with a celebrity endorsement of OrganicFresh produce. The tagline at the end ("Fuel Your Family") reveals it as advertising, but the useful recipe content makes it feel like editorial content.' },
    { id: 'ai2', title: 'New Study: Teens Spending More Time Outdoors', content: 'Research published in the Journal of Adolescent Health found that teens who spend at least 2 hours outdoors daily report better sleep quality and lower stress levels. The study followed 3,400 participants ages 13-17 across 12 months. Researchers controlled for screen time, physical activity levels, and socioeconomic status.', isAd: false, technique: 'None', explanation: 'This is genuine reporting on a scientific study. It cites a specific journal, sample size, duration, and methodology. There are no products mentioned and no persuasive techniques.' },
    { id: 'ai3', title: 'Warning: Your Phone Could Be Hurting You', content: 'Doctors are ALARMED by the effects of blue light on teen eyes. That\'s why leading eye specialists recommend ScreenShield glasses, the #1 doctor-recommended blue light blocker. Don\'t let your phone damage your vision -- protect yourself NOW. As seen on Dr. Mike\'s channel.', isAd: true, technique: 'Fear Appeal + Authority', explanation: 'This uses fear ("ALARMED," "damage your vision") to sell a product. "Doctor-recommended" and "#1" are vague claims. The reference to a YouTube doctor is an appeal to authority. Real medical advice comes from your own doctor, not product ads.' },
    { id: 'ai4', title: 'Science Fair Winners Announced', content: 'The 47th Annual Regional Science Fair awarded top honors to three middle school students. Emma Chen (Grade 8) won first place for her project on soil bacteria and plant growth. Second place went to Marcus Rivera (Grade 7) for his water filtration system, and third to Aisha Patel (Grade 8) for her study on pollinator habitats.', isAd: false, technique: 'None', explanation: 'This is a straightforward local news report about a community event. It includes specific names, grades, and project descriptions. There is nothing being sold and no persuasive language.' },
  ],
  advanced: [
    { id: 'aa1', title: 'The Future of Learning Is Here', content: 'This article was produced in partnership with EduTech Solutions. -- As classrooms evolve, adaptive AI tutoring is showing promising results. A Stanford study found that personalized learning platforms can improve test scores by 15-20%. EduTech\'s new TutorAI platform uses similar adaptive technology, starting at $14.99/month for students.', isAd: true, technique: 'Sponsored Content / Native Advertising', explanation: 'The disclosure ("produced in partnership with") appears at the start but is easy to skim past. The article cites a real Stanford study to build credibility, then pivots to selling a specific product. The legitimate research creates a halo effect for the commercial product, even though TutorAI wasn\'t part of the Stanford study.' },
    { id: 'aa2', title: 'How to Spot Misinformation Online', content: 'The News Literacy Project offers these tips: 1) Check the source -- is it a recognized news organization? 2) Look for the original study or data. 3) Check if other outlets are reporting the same story. 4) Be wary of content that triggers strong emotions. 5) Verify images using reverse image search.', isAd: false, technique: 'None', explanation: 'This is genuine educational content from the News Literacy Project, a real nonprofit. It provides practical, actionable advice with no products to sell and no persuasive commercial techniques.' },
  ],
};

const DEBATE_TOPICS: Record<Difficulty, DebateTopic[]> = {
  beginner: [
    { id: 'db1', topic: 'Should schools start later in the morning?', sideA: 'Yes, schools should start later', sideB: 'No, schools should keep current hours', evidenceCards: [
      { id: 'e1', text: 'The American Academy of Pediatrics recommends that middle and high schools start no earlier than 8:30 AM for teen health.', quality: 'strong', side: 'A' },
      { id: 'e2', text: 'My friend is always tired in first period, so school definitely starts too early.', quality: 'weak', side: 'A' },
      { id: 'e3', text: 'Studies show teens\' circadian rhythms naturally shift, making early wake times difficult. The CDC reports 73% of high schoolers don\'t get enough sleep.', quality: 'strong', side: 'A' },
      { id: 'e4', text: 'Later start times would disrupt parents\' work schedules and require changes to bus routes, costing districts an estimated $150 per student annually.', quality: 'strong', side: 'B' },
      { id: 'e5', text: 'Schools have always started early and people turned out fine.', quality: 'weak', side: 'B' },
      { id: 'e6', text: 'A California study of 30,000 students found that later start times correlated with improved attendance rates and a 4.5% increase in graduation rates.', quality: 'strong', side: 'A' },
      { id: 'e7', text: 'After-school activities and sports would end later, potentially creating safety issues for students traveling home in the dark.', quality: 'moderate', side: 'B' },
      { id: 'e8', text: 'Everyone on social media says school starts too early.', quality: 'weak', side: 'A' },
    ] },
  ],
  intermediate: [
    { id: 'di1', topic: 'Should students be allowed to use AI tools for homework?', sideA: 'Yes, AI tools should be allowed', sideB: 'No, AI tools should be restricted', evidenceCards: [
      { id: 'e9', text: 'A 2024 Stanford study found that students who used AI as a learning aid (not answer generator) improved problem-solving scores by 18% compared to a control group.', quality: 'strong', side: 'A' },
      { id: 'e10', text: 'AI is the future so students need to learn it now or they\'ll fall behind.', quality: 'weak', side: 'A' },
      { id: 'e11', text: 'Research from the National Bureau of Economic Research found that students who relied heavily on AI for writing assignments showed measurable decline in independent writing skills over one semester.', quality: 'strong', side: 'B' },
      { id: 'e12', text: 'UNESCO recommends teaching AI literacy while maintaining assessment integrity, suggesting a balanced approach with clear guidelines on appropriate use.', quality: 'strong', side: 'both' },
      { id: 'e13', text: 'My teacher says AI is cheating, so it must be bad.', quality: 'weak', side: 'B' },
      { id: 'e14', text: 'Schools that implemented structured AI-assisted learning programs saw higher engagement among students with learning disabilities, according to a Journal of Special Education study.', quality: 'strong', side: 'A' },
      { id: 'e15', text: 'A survey of employers showed that 85% value critical thinking and original analysis skills over the ability to use AI tools.', quality: 'moderate', side: 'B' },
      { id: 'e16', text: 'AI tools can provide immediate feedback on practice problems, reducing wait time for teacher help from days to seconds.', quality: 'moderate', side: 'A' },
    ] },
  ],
  advanced: [
    { id: 'da1', topic: 'Should social media platforms be required to verify users\' ages?', sideA: 'Yes, age verification should be required', sideB: 'No, mandatory age verification raises concerns', evidenceCards: [
      { id: 'e17', text: 'The Surgeon General\'s 2024 advisory stated that social media presents "a profound risk of harm" to children and called for stronger protections including age verification.', quality: 'strong', side: 'A' },
      { id: 'e18', text: 'The Electronic Frontier Foundation warns that age verification systems require collecting sensitive data (IDs, biometrics) that creates privacy risks and potential surveillance infrastructure.', quality: 'strong', side: 'B' },
      { id: 'e19', text: 'Australia implemented mandatory age verification, but early studies show teens circumvent it using VPNs and fake IDs, suggesting enforcement challenges.', quality: 'strong', side: 'B' },
      { id: 'e20', text: 'Everyone knows social media is bad for kids, so we should just ban them from it.', quality: 'weak', side: 'A' },
      { id: 'e21', text: 'A systematic review in BMC Public Health found that the relationship between social media use and teen mental health is complex, with effects varying by gender, usage pattern, and platform.', quality: 'strong', side: 'both' },
      { id: 'e22', text: 'The GDPR in Europe already requires parental consent for users under 16, providing a legal framework that could be adapted for age verification without excessive data collection.', quality: 'moderate', side: 'A' },
      { id: 'e23', text: 'For many LGBTQ+ youth and teens in restrictive households, anonymous social media access provides critical community support. Age verification could expose vulnerable users.', quality: 'strong', side: 'B' },
      { id: 'e24', text: 'Social media companies themselves support age verification because it shifts liability from platforms to users and governments.', quality: 'moderate', side: 'both' },
    ] },
  ],
};

const ANALYSIS_TIPS: Record<ChallengeMode, string[]> = {
  'fake-news': [
    'Check the source: Is this from a well-known, established news organization? Or does the website name sound suspicious?',
    'Look for specific details: Real news includes specific names, dates, places, and numbers. Vague claims like "scientists say" without naming who are red flags.',
    'Check your emotional reaction: If a headline makes you feel very angry, scared, or excited, pause. Fake news often uses strong emotions to bypass critical thinking.',
    'Is it too good (or too bad) to be true? Extreme claims like "cures all diseases" or "destroys everything" are usually exaggerated.',
    'Look for the original source: Real news articles link to studies, official statements, or named sources. If there\'s no trail back to primary evidence, be suspicious.',
    'Check if other major outlets are reporting it: If a shocking story appears on only one website, it might not be real.',
  ],
  'source-check': [
    'Peer-reviewed journals are the gold standard. Experts checked the research before it was published.',
    'Government and international agencies (NASA, WHO, CDC) use rigorous methods and have accountability requirements.',
    'Major news outlets fact-check their reporting, but they can still get things wrong. Look for ones that cite their sources.',
    'Personal blogs and social media posts can be written by anyone. There\'s no fact-checking process.',
    'Consider who funded the research. Industry-funded studies may have conflicts of interest.',
    'Press releases from universities summarize research but may oversimplify findings for media attention.',
  ],
  'bias-spotter': [
    'Look for emotional words: "outrageous," "brilliant," "devastating," "incredible." Neutral reporting uses measured language.',
    'Watch for one-sided arguments that only present one perspective without acknowledging the other side.',
    'Check for missing context: Are important details left out that would change how you see the story?',
    'Notice if the author attacks people rather than addressing their arguments (ad hominem).',
    '"Everyone knows," "obviously," "clearly" -- these words try to make opinions sound like established facts.',
    'Look for absolute claims: "always," "never," "proves," "destroys." Real situations are usually more nuanced.',
  ],
  'ad-detective': [
    'Look for disclosure language: "sponsored," "paid partnership," "in collaboration with," "#ad." These mean someone paid for the content.',
    'Is someone selling something? If the content leads to a product or discount code, it\'s advertising.',
    'Celebrity and influencer endorsements are usually paid. They may not reflect genuine opinions.',
    'Fear-based messaging ("Don\'t let this happen to you!") is a common advertising technique.',
    'The bandwagon technique says "everyone is doing it" to pressure you. Ask: is that really true?',
    '"Limited time" and "selling out fast" create artificial urgency to make you act without thinking.',
  ],
  'debate-builder': [
    'Strong evidence comes from studies, expert organizations, and verified data. Weak evidence is personal stories and unsupported opinions.',
    'A good argument acknowledges the other side\'s best points, then explains why your position is still stronger.',
    'Avoid logical fallacies: appeals to emotion, straw man arguments, false dichotomies, and slippery slopes.',
    'Quality matters more than quantity. Three strong pieces of evidence beat ten weak ones.',
    'Check if evidence is relevant to the specific claim. A true fact used to support an unrelated point is misleading.',
    'Consider who gathered the evidence and whether they have a conflict of interest.',
  ],
};

const BADGES = [
  { name: 'Rookie Reporter', threshold: 0, icon: '1' },
  { name: 'Fact Checker', threshold: 10, icon: '2' },
  { name: 'Truth Detective', threshold: 25, icon: '3' },
  { name: 'Media Guru', threshold: 50, icon: '4' },
  { name: 'Master Analyst', threshold: 100, icon: '5' },
];

function getBadge(correct: number): { name: string; level: number } {
  let badge = BADGES[0];
  let level = 0;
  for (let i = BADGES.length - 1; i >= 0; i--) {
    if (correct >= BADGES[i].threshold) {
      badge = BADGES[i];
      level = i;
      break;
    }
  }
  return { name: badge.name, level };
}

// ─── Main App ────────────────────────────────────────────────────────────────

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>('light');
  const [initialized, setInitialized] = useState(false);

  // Game state
  const [activeMode, setActiveMode] = useState<ChallengeMode | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>('beginner');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(50);
  const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

  // Source check mode
  const [sourceRanking, setSourceRanking] = useState<string[]>([]);
  const [draggedSource, setDraggedSource] = useState<string | null>(null);

  // Bias spotter mode
  const [foundBiases, setFoundBiases] = useState<number[]>([]);
  const [showBiasExplanation, setShowBiasExplanation] = useState<number | null>(null);

  // Debate builder mode
  const [debateSide, setDebateSide] = useState<'A' | 'B' | null>(null);
  const [selectedEvidence, setSelectedEvidence] = useState<string[]>([]);
  const [debateSubmitted, setDebateSubmitted] = useState(false);

  // Completion event tracking
  const [completionSent, setCompletionSent] = useState<string | null>(null);

  // Progress
  const [progress, setProgress] = useState<PlayerProgress>({
    totalChallenges: 0,
    correctAnswers: 0,
    streakCurrent: 0,
    streakBest: 0,
    modeScores: {
      'fake-news': { attempted: 0, correct: 0 },
      'source-check': { attempted: 0, correct: 0 },
      'bias-spotter': { attempted: 0, correct: 0 },
      'ad-detective': { attempted: 0, correct: 0 },
      'debate-builder': { attempted: 0, correct: 0 },
    },
    badge: 'Rookie Reporter',
    badgeLevel: 0,
    skillScores: { sourceEval: 0, biasDetection: 0, factChecking: 0, adAwareness: 0, argumentation: 0 },
  });

  const progressRef = useRef(progress);
  useEffect(() => { progressRef.current = progress; }, [progress]);

  // ─── postMessage bridge ──────────────────────────────────────────────

  const handleToolInvoke = useCallback((messageId: string, toolName: string, parameters: Record<string, any>) => {
    switch (toolName) {
      case 'start_challenge': {
        const mode = (parameters.mode || 'fake-news') as ChallengeMode;
        const diff = (parameters.difficulty || 'beginner') as Difficulty;
        setActiveMode(mode);
        setDifficulty(diff);
        setCurrentIndex(0);
        setShowResult(false);
        setSelectedAnswer(null);
        setConfidence(50);
        setCheckedItems({});
        setSourceRanking([]);
        setFoundBiases([]);
        setDebateSide(null);
        setSelectedEvidence([]);
        setDebateSubmitted(false);
        setCompletionSent(null);

        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              status: 'challenge_started',
              mode,
              difficulty: diff,
              message: `Started ${mode} challenge on ${diff} difficulty. Let's test your media literacy skills!`,
            },
          },
        });

        sendToParent({
          type: 'STATE_UPDATE',
          messageId: generateMessageId(),
          payload: {
            state: { mode, difficulty: diff, questionIndex: 0 },
            summary: `New ${mode} challenge started (${diff})`,
          },
        });
        break;
      }

      case 'get_challenge_progress': {
        const p = progressRef.current;
        const b = getBadge(p.correctAnswers);
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: {
            result: {
              totalChallenges: p.totalChallenges,
              correctAnswers: p.correctAnswers,
              accuracy: p.totalChallenges > 0 ? Math.round((p.correctAnswers / p.totalChallenges) * 100) : 0,
              currentStreak: p.streakCurrent,
              bestStreak: p.streakBest,
              badge: b.name,
              modeScores: p.modeScores,
              skillScores: p.skillScores,
            },
          },
        });
        break;
      }

      case 'get_analysis_tip': {
        const mode = activeMode || 'fake-news';
        const tips = ANALYSIS_TIPS[mode];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        sendToParent({
          type: 'TOOL_RESULT',
          messageId,
          payload: { result: { tip, mode } },
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
  }, [activeMode]);

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
          setActiveMode(null);
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

  // ─── Scoring helpers ─────────────────────────────────────────────────

  const recordResult = useCallback((mode: ChallengeMode, correct: boolean) => {
    setProgress(prev => {
      const newStreak = correct ? prev.streakCurrent + 1 : 0;
      const newCorrect = prev.correctAnswers + (correct ? 1 : 0);
      const b = getBadge(newCorrect);
      const modeScores = { ...prev.modeScores };
      modeScores[mode] = {
        attempted: modeScores[mode].attempted + 1,
        correct: modeScores[mode].correct + (correct ? 1 : 0),
      };

      const skills = { ...prev.skillScores };
      if (mode === 'fake-news') skills.factChecking = Math.min(100, skills.factChecking + (correct ? 8 : 2));
      if (mode === 'source-check') skills.sourceEval = Math.min(100, skills.sourceEval + (correct ? 8 : 2));
      if (mode === 'bias-spotter') skills.biasDetection = Math.min(100, skills.biasDetection + (correct ? 8 : 2));
      if (mode === 'ad-detective') skills.adAwareness = Math.min(100, skills.adAwareness + (correct ? 8 : 2));
      if (mode === 'debate-builder') skills.argumentation = Math.min(100, skills.argumentation + (correct ? 8 : 2));

      const updated: PlayerProgress = {
        totalChallenges: prev.totalChallenges + 1,
        correctAnswers: newCorrect,
        streakCurrent: newStreak,
        streakBest: Math.max(prev.streakBest, newStreak),
        modeScores,
        badge: b.name,
        badgeLevel: b.level,
        skillScores: skills,
      };

      // Badge unlock event
      if (b.level > prev.badgeLevel) {
        sendToParent({
          type: 'PLUGIN_COMPLETE',
          messageId: generateMessageId(),
          payload: {
            event: 'skill_unlocked',
            data: { badge: b.name, level: b.level, totalCorrect: newCorrect },
            summary: `Badge unlocked: ${b.name}!`,
          },
        });
      }

      return updated;
    });
  }, []);

  // ─── Style helpers ───────────────────────────────────────────────────

  const isDark = theme === 'dark';
  const colors = {
    bg: isDark ? '#1a1a2e' : '#ffffff',
    card: isDark ? '#16213e' : '#f8f9fa',
    cardBorder: isDark ? '#0f3460' : '#e0e0e0',
    accent: '#e74c3c',
    accentBlue: '#2980b9',
    accentGreen: '#27ae60',
    accentOrange: '#f39c12',
    text: isDark ? '#eee' : '#333',
    textMuted: isDark ? '#999' : '#777',
    headline: isDark ? '#e8e8e8' : '#1a1a1a',
    success: '#27ae60',
    error: '#e74c3c',
    warning: '#f39c12',
    bannerBg: isDark ? '#2d1b1b' : '#fff5f5',
    bannerBorder: '#e74c3c',
  };

  const baseCard: React.CSSProperties = {
    background: colors.card,
    border: `1px solid ${colors.cardBorder}`,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  };

  const baseButton = (color: string, filled = true): React.CSSProperties => ({
    padding: '10px 20px',
    borderRadius: 8,
    border: filled ? 'none' : `2px solid ${color}`,
    background: filled ? color : 'transparent',
    color: filled ? '#fff' : color,
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
    transition: 'all 0.2s',
  });

  // ─── Fake News Detective ─────────────────────────────────────────────

  const renderFakeNews = () => {
    const items = HEADLINES[difficulty];
    if (currentIndex >= items.length) {
      return renderModeComplete('fake-news', items.length);
    }
    const item = items[currentIndex];

    const handleVerdictSelect = (verdict: string) => {
      setSelectedAnswer(verdict);
    };

    const handleSubmit = () => {
      if (!selectedAnswer) return;
      setShowResult(true);
      const correct = selectedAnswer === item.verdict;
      recordResult('fake-news', correct);
    };

    const handleNext = () => {
      setShowResult(false);
      setSelectedAnswer(null);
      setConfidence(50);
      setCheckedItems({});
      setCurrentIndex(prev => prev + 1);
    };

    return (
      <div>
        {/* Breaking news banner */}
        <div style={{ background: colors.accent, color: '#fff', padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, background: '#fff', borderRadius: '50%', animation: 'pulse 1.5s infinite' }} />
          Breaking News Check
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        {/* Headline card */}
        <div style={{ ...baseCard, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
          <div style={{ fontSize: 11, color: colors.textMuted, marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>
            Source: {item.source}
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: colors.headline, lineHeight: 1.3, marginBottom: 10 }}>
            {item.headline}
          </h3>
          <p style={{ fontSize: 14, color: colors.text, lineHeight: 1.6, opacity: 0.9 }}>
            {item.snippet}
          </p>
        </div>

        {!showResult ? (
          <>
            {/* Verdict buttons */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {(['real', 'misleading', 'fake'] as const).map(v => (
                <button
                  key={v}
                  onClick={() => handleVerdictSelect(v)}
                  style={{
                    ...baseButton(v === 'real' ? colors.accentGreen : v === 'misleading' ? colors.accentOrange : colors.accent, selectedAnswer === v),
                    flex: 1,
                    opacity: selectedAnswer && selectedAnswer !== v ? 0.5 : 1,
                  }}
                >
                  {v === 'real' ? 'Real News' : v === 'misleading' ? 'Misleading' : 'Fake'}
                </button>
              ))}
            </div>

            {/* Confidence slider */}
            <div style={{ ...baseCard, padding: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, marginBottom: 6 }}>
                How confident are you? {confidence}%
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={confidence}
                onChange={e => setConfidence(Number(e.target.value))}
                style={{ width: '100%', accentColor: colors.accentBlue }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: colors.textMuted }}>
                <span>Guessing</span><span>Somewhat sure</span><span>Very confident</span>
              </div>
            </div>

            {/* Analysis checklist */}
            <div style={{ ...baseCard }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.text }}>
                Analysis Checklist
              </div>
              {[
                { key: 'sourceCredibility', label: 'Source seems credible and well-known' },
                { key: 'evidenceCited', label: 'Specific evidence or data is cited' },
                { key: 'emotionalLanguage', label: 'Uses emotional or sensational language' },
                { key: 'tooGoodToBeTrue', label: 'Claims seem too extreme to be true' },
              ].map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', cursor: 'pointer', fontSize: 13, color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={!!checkedItems[c.key]}
                    onChange={() => setCheckedItems(prev => ({ ...prev, [c.key]: !prev[c.key] }))}
                    style={{ width: 16, height: 16, accentColor: colors.accentBlue }}
                  />
                  {c.label}
                </label>
              ))}
            </div>

            <button onClick={handleSubmit} disabled={!selectedAnswer} style={{ ...baseButton(colors.accentBlue), width: '100%', opacity: selectedAnswer ? 1 : 0.4, fontSize: 16, padding: '12px 20px' }}>
              Submit Answer
            </button>
          </>
        ) : (
          /* Result reveal */
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{
              ...baseCard,
              borderLeft: `4px solid ${selectedAnswer === item.verdict ? colors.success : colors.error}`,
              background: selectedAnswer === item.verdict
                ? (isDark ? '#1a2e1a' : '#f0fff0')
                : (isDark ? '#2e1a1a' : '#fff0f0'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{selectedAnswer === item.verdict ? '\u2713' : '\u2717'}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: selectedAnswer === item.verdict ? colors.success : colors.error }}>
                  {selectedAnswer === item.verdict ? 'Correct!' : 'Not quite!'}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: colors.text }}>
                This headline is: <span style={{
                  color: item.verdict === 'real' ? colors.accentGreen : item.verdict === 'misleading' ? colors.accentOrange : colors.accent,
                  textTransform: 'uppercase',
                }}>{item.verdict}</span>
              </div>
              <p style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
                {item.explanation}
              </p>
            </div>

            {/* Checklist comparison */}
            <div style={{ ...baseCard }}>
              <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: colors.text }}>Your Analysis vs Reality</div>
              {[
                { key: 'sourceCredibility', label: 'Credible source', actual: item.checklist.sourceCredibility },
                { key: 'evidenceCited', label: 'Evidence cited', actual: item.checklist.evidenceCited },
                { key: 'emotionalLanguage', label: 'Emotional language', actual: item.checklist.emotionalLanguage },
                { key: 'tooGoodToBeTrue', label: 'Too extreme', actual: item.checklist.tooGoodToBeTrue },
              ].map(c => {
                const yours = !!checkedItems[c.key];
                const match = yours === c.actual;
                return (
                  <div key={c.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', fontSize: 12, color: colors.text }}>
                    <span>{c.label}</span>
                    <span style={{ color: match ? colors.success : colors.warning, fontWeight: 600 }}>
                      You: {yours ? 'Yes' : 'No'} | Actual: {c.actual ? 'Yes' : 'No'} {match ? '\u2713' : '\u2717'}
                    </span>
                  </div>
                );
              })}
            </div>

            <button onClick={handleNext} style={{ ...baseButton(colors.accentBlue), width: '100%', fontSize: 16, padding: '12px 20px' }}>
              {currentIndex + 1 < items.length ? 'Next Headline' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Source Checker ───────────────────────────────────────────────────

  const renderSourceCheck = () => {
    const items = SOURCE_ITEMS[difficulty];
    if (currentIndex >= items.length) {
      return renderModeComplete('source-check', items.length);
    }
    const item = items[currentIndex];

    // Initialize ranking if empty
    if (sourceRanking.length === 0 && item.sources.length > 0) {
      setSourceRanking(item.sources.map(s => s.id));
      return null;
    }

    const handleDragStart = (sourceId: string) => {
      setDraggedSource(sourceId);
    };

    const handleDragOver = (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      if (!draggedSource || draggedSource === targetId) return;
      const newRanking = [...sourceRanking];
      const fromIdx = newRanking.indexOf(draggedSource);
      const toIdx = newRanking.indexOf(targetId);
      newRanking.splice(fromIdx, 1);
      newRanking.splice(toIdx, 0, draggedSource);
      setSourceRanking(newRanking);
    };

    const handleSubmitRanking = () => {
      setShowResult(true);
      const correct = JSON.stringify(sourceRanking) === JSON.stringify(item.correctOrder);
      // Partial credit: count how many are in correct position
      let correctPositions = 0;
      sourceRanking.forEach((id, idx) => {
        if (id === item.correctOrder[idx]) correctPositions++;
      });
      recordResult('source-check', correctPositions >= 3);
    };

    const handleNext = () => {
      setShowResult(false);
      setSourceRanking([]);
      setCurrentIndex(prev => prev + 1);
    };

    return (
      <div>
        <div style={{ background: colors.accentBlue, color: '#fff', padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#x1F50D;</span>
          Source Checker
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div style={{ ...baseCard, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.textMuted, marginBottom: 4 }}>The claim:</div>
          <p style={{ fontSize: 15, fontWeight: 600, color: colors.headline, lineHeight: 1.4 }}>
            "{item.claim}"
          </p>
        </div>

        <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 8 }}>
          Rank these sources from MOST to LEAST reliable (drag to reorder):
        </div>

        {sourceRanking.map((sourceId, idx) => {
          const source = item.sources.find(s => s.id === sourceId)!;
          const isCorrectPos = showResult && item.correctOrder[idx] === sourceId;
          return (
            <div
              key={sourceId}
              draggable={!showResult}
              onDragStart={() => handleDragStart(sourceId)}
              onDragOver={(e) => handleDragOver(e, sourceId)}
              onDragEnd={() => setDraggedSource(null)}
              style={{
                ...baseCard,
                cursor: showResult ? 'default' : 'grab',
                borderLeft: showResult ? `4px solid ${isCorrectPos ? colors.success : colors.error}` : `4px solid ${colors.accentBlue}`,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                opacity: draggedSource === sourceId ? 0.5 : 1,
                background: showResult ? (isCorrectPos ? (isDark ? '#1a2e1a' : '#f0fff0') : (isDark ? '#2e1a1a' : '#fff0f0')) : colors.card,
              }}
            >
              <div style={{ background: colors.accentBlue, color: '#fff', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                {idx + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{source.label}</div>
                <div style={{ fontSize: 11, color: colors.accentBlue, fontWeight: 600, marginBottom: 2 }}>{source.type}</div>
                <div style={{ fontSize: 12, color: colors.textMuted }}>{source.description}</div>
                {showResult && (
                  <div style={{ fontSize: 11, marginTop: 4, color: isCorrectPos ? colors.success : colors.error, fontWeight: 600 }}>
                    {isCorrectPos ? 'Correct position!' : `Should be #${item.correctOrder.indexOf(sourceId) + 1}`}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {!showResult ? (
          <button onClick={handleSubmitRanking} style={{ ...baseButton(colors.accentBlue), width: '100%', fontSize: 16, padding: '12px 20px' }}>
            Submit Ranking
          </button>
        ) : (
          <button onClick={handleNext} style={{ ...baseButton(colors.accentBlue), width: '100%', fontSize: 16, padding: '12px 20px', marginTop: 8 }}>
            {currentIndex + 1 < items.length ? 'Next Challenge' : 'See Results'}
          </button>
        )}
      </div>
    );
  };

  // ─── Bias Spotter ─────────────────────────────────────────────────────

  const renderBiasSpotter = () => {
    const items = BIAS_ITEMS[difficulty];
    if (currentIndex >= items.length) {
      return renderModeComplete('bias-spotter', items.length);
    }
    const item = items[currentIndex];

    const handleTextClick = (e: React.MouseEvent<HTMLSpanElement>) => {
      const target = e.target as HTMLElement;
      const biasIdx = target.getAttribute('data-bias-idx');
      if (biasIdx !== null) {
        const idx = Number(biasIdx);
        if (!foundBiases.includes(idx)) {
          setFoundBiases(prev => [...prev, idx]);
        }
        setShowBiasExplanation(idx);
      }
    };

    const handleSubmitBias = () => {
      setShowResult(true);
      const found = foundBiases.length;
      const total = item.biasedPhrases.length;
      recordResult('bias-spotter', found >= total * 0.5);
    };

    const handleNext = () => {
      setShowResult(false);
      setFoundBiases([]);
      setShowBiasExplanation(null);
      setCurrentIndex(prev => prev + 1);
    };

    // Build the paragraph with clickable bias regions
    const renderBiasText = () => {
      const text = item.paragraph;
      const segments: { text: string; biasIdx: number | null }[] = [];
      let lastEnd = 0;

      // Sort phrases by start position
      const sorted = [...item.biasedPhrases].map((p, idx) => ({ ...p, origIdx: idx })).sort((a, b) => a.start - b.start);

      for (const phrase of sorted) {
        if (phrase.start > lastEnd) {
          segments.push({ text: text.slice(lastEnd, phrase.start), biasIdx: null });
        }
        segments.push({ text: text.slice(phrase.start, phrase.end), biasIdx: phrase.origIdx });
        lastEnd = phrase.end;
      }
      if (lastEnd < text.length) {
        segments.push({ text: text.slice(lastEnd), biasIdx: null });
      }

      return (
        <p style={{ fontSize: 14, lineHeight: 1.8, color: colors.text }} onClick={handleTextClick}>
          {segments.map((seg, i) => {
            if (seg.biasIdx === null) {
              return <span key={i}>{seg.text}</span>;
            }
            const isFound = foundBiases.includes(seg.biasIdx);
            const isRevealed = showResult;
            return (
              <span
                key={i}
                data-bias-idx={seg.biasIdx}
                style={{
                  background: isFound ? (isDark ? '#2a5a2a' : '#d4edda')
                    : isRevealed ? (isDark ? '#5a2a2a' : '#f8d7da')
                    : 'transparent',
                  borderBottom: isFound ? `2px solid ${colors.success}` : isRevealed ? `2px solid ${colors.error}` : '2px dashed transparent',
                  cursor: 'pointer',
                  padding: '2px 0',
                  borderRadius: 2,
                  transition: 'all 0.2s',
                }}
              >
                {seg.text}
              </span>
            );
          })}
        </p>
      );
    };

    return (
      <div>
        <div style={{ background: colors.accentOrange, color: '#fff', padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#x26A0;</span>
          Bias Spotter
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div style={{ ...baseCard, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.headline, marginBottom: 8 }}>{item.title}</h3>
          <div style={{ fontSize: 12, color: colors.accentOrange, fontWeight: 600, marginBottom: 10 }}>
            Click on phrases that show bias. Found {foundBiases.length} of {item.biasedPhrases.length}
          </div>
          {renderBiasText()}
        </div>

        {showBiasExplanation !== null && (
          <div style={{ ...baseCard, borderLeft: `4px solid ${colors.accentOrange}`, background: isDark ? '#2e2a1a' : '#fff9e6' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: colors.accentOrange, marginBottom: 4 }}>
              {item.biasedPhrases[showBiasExplanation].type}
            </div>
            <p style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>
              {item.biasedPhrases[showBiasExplanation].explanation}
            </p>
          </div>
        )}

        {!showResult ? (
          <button onClick={handleSubmitBias} style={{ ...baseButton(colors.accentOrange), width: '100%', fontSize: 16, padding: '12px 20px' }}>
            Submit ({foundBiases.length} found)
          </button>
        ) : (
          <div>
            <div style={{ ...baseCard, borderLeft: `4px solid ${foundBiases.length >= item.biasedPhrases.length * 0.5 ? colors.success : colors.warning}` }}>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4, color: colors.text }}>
                You found {foundBiases.length} of {item.biasedPhrases.length} biased elements
              </div>
              <div style={{ fontSize: 12, color: colors.textMuted }}>
                {foundBiases.length === item.biasedPhrases.length
                  ? 'Perfect! You spotted all the bias in this text.'
                  : foundBiases.length >= item.biasedPhrases.length * 0.5
                  ? 'Good job! You caught most of the biased language. Check the highlighted areas you missed.'
                  : 'Keep practicing! Look at the red-highlighted phrases you missed above.'}
              </div>
            </div>
            <button onClick={handleNext} style={{ ...baseButton(colors.accentOrange), width: '100%', fontSize: 16, padding: '12px 20px' }}>
              {currentIndex + 1 < items.length ? 'Next Challenge' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Ad Detective ─────────────────────────────────────────────────────

  const renderAdDetective = () => {
    const items = AD_ITEMS[difficulty];
    if (currentIndex >= items.length) {
      return renderModeComplete('ad-detective', items.length);
    }
    const item = items[currentIndex];

    const handleAdAnswer = (answer: boolean) => {
      setSelectedAnswer(answer ? 'ad' : 'real');
    };

    const handleSubmit = () => {
      if (!selectedAnswer) return;
      setShowResult(true);
      const correct = (selectedAnswer === 'ad') === item.isAd;
      recordResult('ad-detective', correct);
    };

    const handleNext = () => {
      setShowResult(false);
      setSelectedAnswer(null);
      setCurrentIndex(prev => prev + 1);
    };

    return (
      <div>
        <div style={{ background: '#8e44ad', color: '#fff', padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#x1F575;</span>
          Ad Detective
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {currentIndex + 1} / {items.length}
          </span>
        </div>

        <div style={{ ...baseCard, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: colors.headline, marginBottom: 10 }}>{item.title}</h3>
          <div style={{
            background: isDark ? '#1a1a2e' : '#fff',
            border: `1px solid ${colors.cardBorder}`,
            borderRadius: 8,
            padding: 14,
            fontSize: 14,
            lineHeight: 1.7,
            color: colors.text,
          }}>
            {item.content}
          </div>
        </div>

        {!showResult ? (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, marginBottom: 8, textAlign: 'center' }}>
              Is this real content or an advertisement?
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
              <button
                onClick={() => handleAdAnswer(false)}
                style={{
                  ...baseButton(colors.accentGreen, selectedAnswer === 'real'),
                  flex: 1,
                  opacity: selectedAnswer && selectedAnswer !== 'real' ? 0.5 : 1,
                }}
              >
                Real Content
              </button>
              <button
                onClick={() => handleAdAnswer(true)}
                style={{
                  ...baseButton('#8e44ad', selectedAnswer === 'ad'),
                  flex: 1,
                  opacity: selectedAnswer && selectedAnswer !== 'ad' ? 0.5 : 1,
                }}
              >
                Ad / Sponsored
              </button>
            </div>
            <button onClick={handleSubmit} disabled={!selectedAnswer} style={{ ...baseButton(colors.accentBlue), width: '100%', opacity: selectedAnswer ? 1 : 0.4, fontSize: 16, padding: '12px 20px' }}>
              Submit
            </button>
          </>
        ) : (
          <div style={{ animation: 'fadeIn 0.4s ease-out' }}>
            <div style={{
              ...baseCard,
              borderLeft: `4px solid ${((selectedAnswer === 'ad') === item.isAd) ? colors.success : colors.error}`,
              background: ((selectedAnswer === 'ad') === item.isAd) ? (isDark ? '#1a2e1a' : '#f0fff0') : (isDark ? '#2e1a1a' : '#fff0f0'),
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 24 }}>{((selectedAnswer === 'ad') === item.isAd) ? '\u2713' : '\u2717'}</span>
                <span style={{ fontWeight: 700, fontSize: 16, color: ((selectedAnswer === 'ad') === item.isAd) ? colors.success : colors.error }}>
                  {((selectedAnswer === 'ad') === item.isAd) ? 'Correct!' : 'Not quite!'}
                </span>
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6, color: colors.text }}>
                This is: <span style={{ color: item.isAd ? '#8e44ad' : colors.accentGreen, textTransform: 'uppercase' }}>
                  {item.isAd ? 'An Advertisement' : 'Real Content'}
                </span>
              </div>
              {item.isAd && (
                <div style={{ fontSize: 12, color: '#8e44ad', fontWeight: 600, marginBottom: 6 }}>
                  Technique used: {item.technique}
                </div>
              )}
              <p style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
                {item.explanation}
              </p>
            </div>
            <button onClick={handleNext} style={{ ...baseButton('#8e44ad'), width: '100%', fontSize: 16, padding: '12px 20px' }}>
              {currentIndex + 1 < items.length ? 'Next Challenge' : 'See Results'}
            </button>
          </div>
        )}
      </div>
    );
  };

  // ─── Debate Builder ───────────────────────────────────────────────────

  const renderDebateBuilder = () => {
    const topics = DEBATE_TOPICS[difficulty];
    if (currentIndex >= topics.length) {
      return renderModeComplete('debate-builder', topics.length);
    }
    const topic = topics[currentIndex];

    const handlePickSide = (side: 'A' | 'B') => {
      setDebateSide(side);
      setSelectedEvidence([]);
    };

    const handleToggleEvidence = (evidenceId: string) => {
      if (debateSubmitted) return;
      setSelectedEvidence(prev =>
        prev.includes(evidenceId) ? prev.filter(id => id !== evidenceId) : [...prev, evidenceId]
      );
    };

    const handleSubmitDebate = () => {
      if (!debateSide || selectedEvidence.length === 0) return;
      setDebateSubmitted(true);

      // Score the argument
      let score = 0;
      const selectedCards = selectedEvidence.map(id => topic.evidenceCards.find(c => c.id === id)!);
      const strongCount = selectedCards.filter(c => c.quality === 'strong' && (c.side === debateSide || c.side === 'both')).length;
      const weakCount = selectedCards.filter(c => c.quality === 'weak').length;
      const wrongSide = selectedCards.filter(c => c.side !== debateSide && c.side !== 'both').length;

      score = strongCount * 3 + selectedCards.filter(c => c.quality === 'moderate' && (c.side === debateSide || c.side === 'both')).length * 2 - weakCount - wrongSide * 2;
      const maxScore = topic.evidenceCards.filter(c => c.quality === 'strong' && (c.side === debateSide || c.side === 'both')).length * 3;
      const good = maxScore > 0 && score >= maxScore * 0.5;

      recordResult('debate-builder', good);
      setShowResult(true);
    };

    const handleNext = () => {
      setShowResult(false);
      setDebateSide(null);
      setSelectedEvidence([]);
      setDebateSubmitted(false);
      setCurrentIndex(prev => prev + 1);
    };

    return (
      <div>
        <div style={{ background: '#2c3e50', color: '#fff', padding: '8px 16px', borderRadius: '8px 8px 0 0', fontWeight: 700, fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14 }}>&#x2696;</span>
          Debate Builder
          <span style={{ marginLeft: 'auto', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
            {currentIndex + 1} / {topics.length}
          </span>
        </div>

        <div style={{ ...baseCard, borderTopLeftRadius: 0, borderTopRightRadius: 0, marginTop: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: colors.textMuted, marginBottom: 4, textTransform: 'uppercase' }}>Topic</div>
          <h3 style={{ fontSize: 17, fontWeight: 700, color: colors.headline, lineHeight: 1.3 }}>
            {topic.topic}
          </h3>
        </div>

        {!debateSide ? (
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, textAlign: 'center', marginBottom: 10 }}>
              Choose your side:
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => handlePickSide('A')} style={{ ...baseButton(colors.accentBlue), flex: 1, fontSize: 13, padding: '14px 12px', lineHeight: 1.3 }}>
                {topic.sideA}
              </button>
              <button onClick={() => handlePickSide('B')} style={{ ...baseButton(colors.accent), flex: 1, fontSize: 13, padding: '14px 12px', lineHeight: 1.3 }}>
                {topic.sideB}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.text, marginBottom: 4 }}>
              Your position: <span style={{ color: debateSide === 'A' ? colors.accentBlue : colors.accent }}>
                {debateSide === 'A' ? topic.sideA : topic.sideB}
              </span>
            </div>
            <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 10 }}>
              Select the best evidence to support your argument ({selectedEvidence.length} selected):
            </div>

            {topic.evidenceCards.map(card => {
              const isSelected = selectedEvidence.includes(card.id);
              const isRevealed = debateSubmitted;
              const qualityColor = card.quality === 'strong' ? colors.success : card.quality === 'moderate' ? colors.accentOrange : colors.error;

              return (
                <div
                  key={card.id}
                  onClick={() => handleToggleEvidence(card.id)}
                  style={{
                    ...baseCard,
                    cursor: debateSubmitted ? 'default' : 'pointer',
                    borderLeft: `4px solid ${isSelected ? (debateSubmitted ? qualityColor : colors.accentBlue) : 'transparent'}`,
                    background: isSelected ? (isDark ? '#16213e' : '#f0f4ff') : colors.card,
                    opacity: debateSubmitted && !isSelected ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: 4, flexShrink: 0, marginTop: 2,
                      border: `2px solid ${isSelected ? colors.accentBlue : colors.cardBorder}`,
                      background: isSelected ? colors.accentBlue : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontSize: 12, fontWeight: 700,
                    }}>
                      {isSelected ? '\u2713' : ''}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, color: colors.text, lineHeight: 1.5 }}>{card.text}</p>
                      {isRevealed && (
                        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 11 }}>
                          <span style={{ color: qualityColor, fontWeight: 700, textTransform: 'uppercase' }}>
                            {card.quality} evidence
                          </span>
                          <span style={{ color: colors.textMuted }}>
                            | Supports: {card.side === 'A' ? topic.sideA : card.side === 'B' ? topic.sideB : 'Both sides'}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {!debateSubmitted ? (
              <button
                onClick={handleSubmitDebate}
                disabled={selectedEvidence.length === 0}
                style={{ ...baseButton('#2c3e50'), width: '100%', fontSize: 16, padding: '12px 20px', opacity: selectedEvidence.length > 0 ? 1 : 0.4 }}
              >
                Submit Argument
              </button>
            ) : (
              <div>
                {showResult && (() => {
                  const selectedCards = selectedEvidence.map(id => topic.evidenceCards.find(c => c.id === id)!);
                  const strongRelevant = selectedCards.filter(c => c.quality === 'strong' && (c.side === debateSide || c.side === 'both')).length;
                  const weakSelected = selectedCards.filter(c => c.quality === 'weak').length;
                  const wrongSide = selectedCards.filter(c => c.side !== debateSide && c.side !== 'both').length;

                  return (
                    <div style={{ ...baseCard, borderLeft: `4px solid ${strongRelevant > 0 && weakSelected === 0 ? colors.success : colors.warning}` }}>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6, color: colors.text }}>Argument Analysis</div>
                      <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6 }}>
                        <div>Strong evidence for your side: <span style={{ color: colors.success, fontWeight: 700 }}>{strongRelevant}</span></div>
                        <div>Weak evidence used: <span style={{ color: weakSelected > 0 ? colors.error : colors.success, fontWeight: 700 }}>{weakSelected}</span></div>
                        <div>Evidence for wrong side: <span style={{ color: wrongSide > 0 ? colors.error : colors.success, fontWeight: 700 }}>{wrongSide}</span></div>
                        <div style={{ marginTop: 8, fontSize: 12, color: colors.textMuted }}>
                          {strongRelevant >= 2 && weakSelected === 0 && wrongSide === 0
                            ? 'Excellent! You built a strong, well-supported argument using quality evidence.'
                            : strongRelevant >= 1
                            ? 'Good start! Try to use more strong evidence and avoid weak claims to strengthen your argument.'
                            : 'Keep practicing! Focus on finding evidence that is research-backed and relevant to your position.'}
                        </div>
                      </div>
                    </div>
                  );
                })()}
                <button onClick={handleNext} style={{ ...baseButton('#2c3e50'), width: '100%', fontSize: 16, padding: '12px 20px' }}>
                  {currentIndex + 1 < topics.length ? 'Next Topic' : 'See Results'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  // ─── Mode completion screen ───────────────────────────────────────────

  // Send completion event when mode finishes
  useEffect(() => {
    if (!activeMode) return;
    const items =
      activeMode === 'fake-news' ? HEADLINES[difficulty] :
      activeMode === 'source-check' ? SOURCE_ITEMS[difficulty] :
      activeMode === 'bias-spotter' ? BIAS_ITEMS[difficulty] :
      activeMode === 'ad-detective' ? AD_ITEMS[difficulty] :
      DEBATE_TOPICS[difficulty];
    if (currentIndex < items.length) return;

    const key = `${activeMode}-${difficulty}`;
    if (completionSent === key) return;
    setCompletionSent(key);

    const modeScore = progress.modeScores[activeMode];
    const pct = modeScore.attempted > 0 ? Math.round((modeScore.correct / modeScore.attempted) * 100) : 0;
    const b = getBadge(progress.correctAnswers);

    sendToParent({
      type: 'PLUGIN_COMPLETE',
      messageId: generateMessageId(),
      payload: {
        event: 'challenge_completed',
        data: {
          mode: activeMode,
          difficulty,
          score: modeScore.correct,
          total: modeScore.attempted,
          accuracy: pct,
          badge: b.name,
        },
        summary: `Completed ${activeMode} challenge: ${modeScore.correct}/${modeScore.attempted} correct (${pct}%)`,
      },
    });
  }, [activeMode, currentIndex, difficulty, completionSent, progress]);

  const renderModeComplete = (mode: ChallengeMode, totalQuestions: number) => {
    const modeScore = progress.modeScores[mode];
    const pct = modeScore.attempted > 0 ? Math.round((modeScore.correct / modeScore.attempted) * 100) : 0;
    const b = getBadge(progress.correctAnswers);

    const modeLabel = mode === 'fake-news' ? 'Fake News Detective' : mode === 'source-check' ? 'Source Checker' : mode === 'bias-spotter' ? 'Bias Spotter' : mode === 'ad-detective' ? 'Ad Detective' : 'Debate Builder';
    const modeColor = mode === 'fake-news' ? colors.accent : mode === 'source-check' ? colors.accentBlue : mode === 'bias-spotter' ? colors.accentOrange : mode === 'ad-detective' ? '#8e44ad' : '#2c3e50';

    return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ ...baseCard, padding: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {pct >= 80 ? '\u2605' : pct >= 50 ? '\u2606' : '\u25CB'}
          </div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.headline, marginBottom: 4 }}>
            {modeLabel} Complete!
          </h2>
          <div style={{ fontSize: 14, color: colors.textMuted, marginBottom: 16 }}>
            {difficulty} difficulty
          </div>

          {/* Score circle */}
          <div style={{
            width: 100, height: 100, borderRadius: '50%', margin: '0 auto 16px',
            border: `4px solid ${pct >= 80 ? colors.success : pct >= 50 ? colors.accentOrange : colors.error}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ fontSize: 28, fontWeight: 700, color: pct >= 80 ? colors.success : pct >= 50 ? colors.accentOrange : colors.error }}>
              {pct}%
            </div>
            <div style={{ fontSize: 10, color: colors.textMuted }}>accuracy</div>
          </div>

          <div style={{ fontSize: 14, color: colors.text, marginBottom: 4 }}>
            {modeScore.correct} of {modeScore.attempted} correct
          </div>
          <div style={{ fontSize: 13, color: colors.textMuted, marginBottom: 16 }}>
            {pct >= 80 ? 'Outstanding work! You have sharp critical thinking skills.'
              : pct >= 50 ? 'Good effort! Keep practicing to sharpen your skills.'
              : 'Keep at it! Media literacy is a skill that improves with practice.'}
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-block', padding: '8px 20px', borderRadius: 20,
            background: `${modeColor}15`, border: `2px solid ${modeColor}`,
            fontWeight: 700, fontSize: 13, color: modeColor,
          }}>
            {b.name}
          </div>
        </div>

        {/* Skill bars */}
        <div style={{ ...baseCard }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: colors.text }}>
            Your Media Literacy Skills
          </div>
          {([
            { label: 'Fact Checking', value: progress.skillScores.factChecking, color: colors.accent },
            { label: 'Source Evaluation', value: progress.skillScores.sourceEval, color: colors.accentBlue },
            { label: 'Bias Detection', value: progress.skillScores.biasDetection, color: colors.accentOrange },
            { label: 'Ad Awareness', value: progress.skillScores.adAwareness, color: '#8e44ad' },
            { label: 'Argumentation', value: progress.skillScores.argumentation, color: '#2c3e50' },
          ] as const).map(skill => (
            <div key={skill.label} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2, color: colors.textMuted }}>
                <span>{skill.label}</span>
                <span>{skill.value}/100</span>
              </div>
              <div style={{ height: 8, background: isDark ? '#0f3460' : '#e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${skill.value}%`, background: skill.color,
                  borderRadius: 4, transition: 'width 0.5s ease-out',
                }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setCurrentIndex(0); setShowResult(false); }} style={{ ...baseButton(modeColor), flex: 1 }}>
            Replay
          </button>
          <button onClick={() => setActiveMode(null)} style={{ ...baseButton(colors.textMuted, false), flex: 1 }}>
            Back to Menu
          </button>
        </div>
      </div>
    );
  };

  // ─── Mode selection menu ──────────────────────────────────────────────

  const renderMenu = () => {
    const modes: { mode: ChallengeMode; label: string; desc: string; color: string; icon: string }[] = [
      { mode: 'fake-news', label: 'Fake News Detective', desc: 'Spot fake, misleading, and real news headlines', color: colors.accent, icon: '\uD83D\uDCF0' },
      { mode: 'source-check', label: 'Source Checker', desc: 'Rank sources from most to least reliable', color: colors.accentBlue, icon: '\uD83D\uDD0D' },
      { mode: 'bias-spotter', label: 'Bias Spotter', desc: 'Find loaded language, emotional appeals, and missing context', color: colors.accentOrange, icon: '\u26A0\uFE0F' },
      { mode: 'ad-detective', label: 'Ad Detective', desc: 'Distinguish real content from hidden advertising', color: '#8e44ad', icon: '\uD83D\uDD75\uFE0F' },
      { mode: 'debate-builder', label: 'Debate Builder', desc: 'Build strong arguments using quality evidence', color: '#2c3e50', icon: '\u2696\uFE0F' },
    ];

    const b = getBadge(progress.correctAnswers);

    return (
      <div>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: colors.headline, marginBottom: 4, letterSpacing: -0.5 }}>
            Fact or Fiction
          </h1>
          <p style={{ fontSize: 13, color: colors.textMuted }}>
            Sharpen your media literacy and critical thinking skills
          </p>
        </div>

        {/* Badge + stats bar */}
        {progress.totalChallenges > 0 && (
          <div style={{ ...baseCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}>
            <div>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Badge</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.accentBlue }}>{b.name}</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Score</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.text }}>
                {progress.correctAnswers}/{progress.totalChallenges}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: colors.textMuted, fontWeight: 600, textTransform: 'uppercase' }}>Streak</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: colors.accentOrange }}>{progress.streakCurrent}</div>
            </div>
          </div>
        )}

        {/* Difficulty selector */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {(['beginner', 'intermediate', 'advanced'] as Difficulty[]).map(d => (
            <button
              key={d}
              onClick={() => setDifficulty(d)}
              style={{
                ...baseButton(colors.accentBlue, difficulty === d),
                flex: 1,
                fontSize: 12,
                padding: '8px 10px',
                textTransform: 'capitalize',
              }}
            >
              {d}
            </button>
          ))}
        </div>

        {/* Mode cards */}
        {modes.map(m => {
          const modeProgress = progress.modeScores[m.mode];
          return (
            <div
              key={m.mode}
              onClick={() => {
                setActiveMode(m.mode);
                setCurrentIndex(0);
                setShowResult(false);
                setSelectedAnswer(null);
                setConfidence(50);
                setCheckedItems({});
                setSourceRanking([]);
                setFoundBiases([]);
                setDebateSide(null);
                setSelectedEvidence([]);
                setDebateSubmitted(false);
                setCompletionSent(null);
              }}
              style={{
                ...baseCard,
                cursor: 'pointer',
                borderLeft: `4px solid ${m.color}`,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                transition: 'transform 0.15s, box-shadow 0.15s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
            >
              <div style={{ fontSize: 28, flexShrink: 0 }}>{m.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 14, color: colors.text }}>{m.label}</div>
                <div style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>{m.desc}</div>
                {modeProgress.attempted > 0 && (
                  <div style={{ fontSize: 11, color: m.color, marginTop: 4, fontWeight: 600 }}>
                    {modeProgress.correct}/{modeProgress.attempted} correct
                  </div>
                )}
              </div>
              <div style={{ color: colors.textMuted, fontSize: 18 }}>{'\u203A'}</div>
            </div>
          );
        })}
      </div>
    );
  };

  // ─── Render ──────────────────────────────────────────────────────────

  const containerStyle: React.CSSProperties = {
    maxWidth: 480,
    margin: '0 auto',
    padding: 16,
    width: '100%',
  };

  const renderActiveMode = () => {
    switch (activeMode) {
      case 'fake-news': return renderFakeNews();
      case 'source-check': return renderSourceCheck();
      case 'bias-spotter': return renderBiasSpotter();
      case 'ad-detective': return renderAdDetective();
      case 'debate-builder': return renderDebateBuilder();
      default: return renderMenu();
    }
  };

  return (
    <div style={containerStyle}>
      {/* Inject keyframes */}
      <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {activeMode && (
        <button
          onClick={() => setActiveMode(null)}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textMuted,
            fontSize: 13,
            cursor: 'pointer',
            marginBottom: 12,
            padding: '4px 0',
            fontWeight: 600,
          }}
        >
          {'\u2190'} Back to Menu
        </button>
      )}

      {renderActiveMode()}
    </div>
  );
}
