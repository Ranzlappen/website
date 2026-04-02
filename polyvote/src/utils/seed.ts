/*
 * CHANGE: New file – Firestore seed script
 * REASON: Populates the database with 3 categories × 2 topics × 2-3 metrics for demo
 * DATE: 2026-04-02
 *
 * Run with: npx tsx src/utils/seed.ts
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, doc, setDoc } from 'firebase/firestore';

const app = initializeApp({
  apiKey: 'AIzaSyByEwHUnausbBmyRT928uGTRw5ZvszjjiM',
  authDomain: 'proven-concept-436717-q3.firebaseapp.com',
  projectId: 'proven-concept-436717-q3',
  storageBucket: 'proven-concept-436717-q3.appspot.com',
  messagingSenderId: '420991269376',
  appId: '1:420991269376:web:8b2d0bcac98ffd92abb6e5',
});
const db = getFirestore(app);

// ── Seed data: 3 categories, 2 topics each, 2-3 metrics per topic ──

const SEED_TOPICS = [
  // ── Technology ──
  {
    id: 'ai-regulation',
    title: 'AI Regulation Approaches',
    description: 'How should governments regulate artificial intelligence development and deployment?',
    category: 'Technology',
    createdAt: Date.now() - 86400000 * 2,
    totalVotes: 42,
    metrics: [
      {
        id: 'strictness',
        label: 'Regulatory Strictness',
        choices: [
          { id: 'strict', label: 'Strict regulation', color: '#f87171', votes: 18 },
          { id: 'moderate', label: 'Moderate oversight', color: '#60a5fa', votes: 15 },
          { id: 'minimal', label: 'Minimal intervention', color: '#4ade80', votes: 9 },
        ],
      },
      {
        id: 'scope',
        label: 'Scope of Regulation',
        choices: [
          { id: 'global', label: 'Global standards', color: '#c084fc', votes: 20 },
          { id: 'national', label: 'National laws', color: '#fb923c', votes: 12 },
          { id: 'industry', label: 'Industry self-regulation', color: '#facc15', votes: 10 },
        ],
      },
    ],
  },
  {
    id: 'remote-work-future',
    title: 'Future of Remote Work',
    description: 'What will the workplace look like in 5 years? Fully remote, hybrid, or back to office?',
    category: 'Technology',
    createdAt: Date.now() - 86400000 * 5,
    totalVotes: 65,
    metrics: [
      {
        id: 'work-model',
        label: 'Preferred Work Model',
        choices: [
          { id: 'remote', label: 'Fully remote', color: '#4ade80', votes: 28 },
          { id: 'hybrid', label: 'Hybrid (2-3 days)', color: '#60a5fa', votes: 25 },
          { id: 'office', label: 'Full-time office', color: '#f87171', votes: 12 },
        ],
      },
      {
        id: 'productivity',
        label: 'Productivity Impact',
        choices: [
          { id: 'higher', label: 'Higher at home', color: '#4ade80', votes: 30 },
          { id: 'same', label: 'About the same', color: '#facc15', votes: 20 },
          { id: 'lower', label: 'Lower at home', color: '#f87171', votes: 15 },
        ],
      },
    ],
  },

  // ── Science ──
  {
    id: 'space-exploration',
    title: 'Space Exploration Priorities',
    description: 'Where should humanity focus space exploration resources in the next decade?',
    category: 'Science',
    createdAt: Date.now() - 86400000 * 1,
    totalVotes: 38,
    metrics: [
      {
        id: 'destination',
        label: 'Primary Destination',
        choices: [
          { id: 'mars', label: 'Mars colonisation', color: '#fb923c', votes: 16 },
          { id: 'moon', label: 'Lunar base', color: '#d1d5db', votes: 12 },
          { id: 'asteroids', label: 'Asteroid mining', color: '#c084fc', votes: 10 },
        ],
      },
      {
        id: 'funding',
        label: 'Funding Model',
        choices: [
          { id: 'public', label: 'Government-funded', color: '#60a5fa', votes: 14 },
          { id: 'private', label: 'Private sector', color: '#4ade80', votes: 15 },
          { id: 'collab', label: 'Public-private partnership', color: '#facc15', votes: 9 },
        ],
      },
      {
        id: 'timeline',
        label: 'Realistic Timeline',
        choices: [
          { id: '5y', label: 'Within 5 years', color: '#4ade80', votes: 8 },
          { id: '10y', label: '5-10 years', color: '#60a5fa', votes: 18 },
          { id: '20y', label: '10-20+ years', color: '#f87171', votes: 12 },
        ],
      },
    ],
  },
  {
    id: 'climate-solutions',
    title: 'Most Promising Climate Solutions',
    description: 'Which climate change mitigation strategies deserve the most investment?',
    category: 'Science',
    createdAt: Date.now() - 86400000 * 3,
    totalVotes: 55,
    metrics: [
      {
        id: 'energy',
        label: 'Energy Source',
        choices: [
          { id: 'solar', label: 'Solar & wind', color: '#facc15', votes: 22 },
          { id: 'nuclear', label: 'Nuclear power', color: '#c084fc', votes: 18 },
          { id: 'hydrogen', label: 'Green hydrogen', color: '#4ade80', votes: 15 },
        ],
      },
      {
        id: 'approach',
        label: 'Primary Approach',
        choices: [
          { id: 'reduction', label: 'Emission reduction', color: '#60a5fa', votes: 25 },
          { id: 'capture', label: 'Carbon capture', color: '#fb923c', votes: 18 },
          { id: 'adaptation', label: 'Adaptation', color: '#f87171', votes: 12 },
        ],
      },
    ],
  },

  // ── Culture ──
  {
    id: 'social-media-impact',
    title: 'Social Media Impact on Society',
    description: 'Is social media a net positive or negative for modern society?',
    category: 'Culture',
    createdAt: Date.now() - 86400000 * 4,
    totalVotes: 48,
    metrics: [
      {
        id: 'overall',
        label: 'Overall Impact',
        choices: [
          { id: 'positive', label: 'Mostly positive', color: '#4ade80', votes: 14 },
          { id: 'mixed', label: 'Mixed / neutral', color: '#facc15', votes: 20 },
          { id: 'negative', label: 'Mostly negative', color: '#f87171', votes: 14 },
        ],
      },
      {
        id: 'regulation',
        label: 'Should Platforms Be Regulated?',
        choices: [
          { id: 'yes', label: 'Yes, heavily', color: '#f87171', votes: 22 },
          { id: 'somewhat', label: 'Somewhat', color: '#60a5fa', votes: 16 },
          { id: 'no', label: 'No, free market', color: '#4ade80', votes: 10 },
        ],
      },
    ],
  },
  {
    id: 'education-reform',
    title: 'Education System Reform',
    description: 'What fundamental changes does the education system need?',
    category: 'Culture',
    createdAt: Date.now() - 86400000 * 6,
    totalVotes: 35,
    metrics: [
      {
        id: 'priority',
        label: 'Top Priority',
        choices: [
          { id: 'practical', label: 'Practical skills focus', color: '#4ade80', votes: 15 },
          { id: 'critical', label: 'Critical thinking', color: '#60a5fa', votes: 12 },
          { id: 'tech', label: 'Technology integration', color: '#c084fc', votes: 8 },
        ],
      },
      {
        id: 'structure',
        label: 'Structural Change',
        choices: [
          { id: 'personalized', label: 'Personalized learning', color: '#fb923c', votes: 18 },
          { id: 'shorter', label: 'Shorter school years', color: '#facc15', votes: 7 },
          { id: 'unchanged', label: 'Keep current structure', color: '#d1d5db', votes: 10 },
        ],
      },
      {
        id: 'assessment',
        label: 'Assessment Method',
        choices: [
          { id: 'project', label: 'Project-based', color: '#4ade80', votes: 16 },
          { id: 'portfolio', label: 'Portfolio reviews', color: '#60a5fa', votes: 11 },
          { id: 'traditional', label: 'Traditional exams', color: '#f87171', votes: 8 },
        ],
      },
    ],
  },
];

async function seed() {
  console.log('Seeding PolyVote topics…');
  for (const topic of SEED_TOPICS) {
    const { id, ...data } = topic;
    await setDoc(doc(collection(db, 'topics'), id), data);
    console.log(`  ✓ ${topic.title}`);
  }
  console.log('Done! 6 topics seeded across 3 categories.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
