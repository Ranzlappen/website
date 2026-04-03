/*
 * CHANGE: Expanded seed script – 24 topics across 8 categories
 * REASON: Populates the database with extensive demo data for testing/preview
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

const DAY = 86400000;

// ── Seed data: 8 categories, ~24 topics, 2-4 metrics per topic ──

const SEED_TOPICS = [
  // ═══════════════════════════════════════
  // ── Technology (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'ai-regulation',
    title: 'AI Regulation Approaches',
    description: 'How should governments regulate artificial intelligence development and deployment?',
    category: 'Technology',
    createdAt: Date.now() - DAY * 2,
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
    createdAt: Date.now() - DAY * 5,
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
  {
    id: 'crypto-digital-currency',
    title: 'Cryptocurrency & Digital Currency',
    description: 'Should governments embrace cryptocurrency or develop their own central bank digital currencies?',
    category: 'Technology',
    createdAt: Date.now() - DAY * 8,
    totalVotes: 87,
    metrics: [
      {
        id: 'adoption',
        label: 'Government Approach',
        choices: [
          { id: 'embrace', label: 'Embrace crypto fully', color: '#4ade80', votes: 25 },
          { id: 'cbdc', label: 'Central bank digital currency', color: '#60a5fa', votes: 32 },
          { id: 'regulate', label: 'Regulate but allow', color: '#facc15', votes: 20 },
          { id: 'ban', label: 'Ban cryptocurrency', color: '#f87171', votes: 10 },
        ],
      },
      {
        id: 'impact',
        label: 'Impact on Traditional Banking',
        choices: [
          { id: 'replace', label: 'Will replace banks', color: '#c084fc', votes: 18 },
          { id: 'coexist', label: 'Will coexist', color: '#60a5fa', votes: 40 },
          { id: 'fade', label: 'Crypto will fade', color: '#fb923c', votes: 29 },
        ],
      },
      {
        id: 'environment',
        label: 'Environmental Concern',
        choices: [
          { id: 'major', label: 'Major concern', color: '#f87171', votes: 35 },
          { id: 'solvable', label: 'Solvable with PoS', color: '#facc15', votes: 30 },
          { id: 'minor', label: 'Minor issue', color: '#4ade80', votes: 22 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Science (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'space-exploration',
    title: 'Space Exploration Priorities',
    description: 'Where should humanity focus space exploration resources in the next decade?',
    category: 'Science',
    createdAt: Date.now() - DAY * 1,
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
    createdAt: Date.now() - DAY * 3,
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
  {
    id: 'gene-editing-ethics',
    title: 'Gene Editing Ethics (CRISPR)',
    description: 'How far should gene editing technology go? Should we edit human embryos to eliminate disease?',
    category: 'Science',
    createdAt: Date.now() - DAY * 12,
    totalVotes: 93,
    metrics: [
      {
        id: 'scope',
        label: 'Acceptable Scope',
        choices: [
          { id: 'disease-only', label: 'Disease prevention only', color: '#60a5fa', votes: 38 },
          { id: 'broad-medical', label: 'Broad medical uses', color: '#4ade80', votes: 28 },
          { id: 'enhancement', label: 'Include enhancements', color: '#c084fc', votes: 15 },
          { id: 'ban', label: 'Ban human editing', color: '#f87171', votes: 12 },
        ],
      },
      {
        id: 'regulation',
        label: 'Who Should Regulate?',
        choices: [
          { id: 'international', label: 'International body', color: '#60a5fa', votes: 40 },
          { id: 'national', label: 'National governments', color: '#fb923c', votes: 30 },
          { id: 'scientific', label: 'Scientific community', color: '#4ade80', votes: 23 },
        ],
      },
      {
        id: 'access',
        label: 'Access & Equity',
        choices: [
          { id: 'universal', label: 'Universal access required', color: '#4ade80', votes: 45 },
          { id: 'subsidized', label: 'Subsidized access', color: '#facc15', votes: 28 },
          { id: 'market', label: 'Market-driven pricing', color: '#f87171', votes: 20 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Culture (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'social-media-impact',
    title: 'Social Media Impact on Society',
    description: 'Is social media a net positive or negative for modern society?',
    category: 'Culture',
    createdAt: Date.now() - DAY * 4,
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
    createdAt: Date.now() - DAY * 6,
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
  {
    id: 'ai-art-copyright',
    title: 'AI-Generated Art & Copyright',
    description: 'Should AI-generated art be eligible for copyright? Who owns it—the prompter, the developer, or nobody?',
    category: 'Culture',
    createdAt: Date.now() - DAY * 15,
    totalVotes: 110,
    metrics: [
      {
        id: 'ownership',
        label: 'Who Owns AI Art?',
        choices: [
          { id: 'prompter', label: 'The person who prompted', color: '#4ade80', votes: 32 },
          { id: 'developer', label: 'AI model developer', color: '#60a5fa', votes: 18 },
          { id: 'public', label: 'Public domain', color: '#facc15', votes: 35 },
          { id: 'no-one', label: 'Not copyrightable', color: '#f87171', votes: 25 },
        ],
      },
      {
        id: 'training-data',
        label: 'Training Data Ethics',
        choices: [
          { id: 'consent', label: 'Require artist consent', color: '#f87171', votes: 48 },
          { id: 'compensate', label: 'Compensate artists', color: '#fb923c', votes: 35 },
          { id: 'fair-use', label: 'Fair use applies', color: '#4ade80', votes: 27 },
        ],
      },
      {
        id: 'labeling',
        label: 'Disclosure Requirements',
        choices: [
          { id: 'mandatory', label: 'Mandatory AI label', color: '#f87171', votes: 52 },
          { id: 'optional', label: 'Optional disclosure', color: '#facc15', votes: 30 },
          { id: 'none', label: 'No labeling needed', color: '#4ade80', votes: 28 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Politics (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'voting-system-reform',
    title: 'Voting System Reform',
    description: 'Should democracies move away from first-past-the-post voting to alternative systems?',
    category: 'Politics',
    createdAt: Date.now() - DAY * 7,
    totalVotes: 128,
    metrics: [
      {
        id: 'system',
        label: 'Preferred Voting System',
        choices: [
          { id: 'rcv', label: 'Ranked choice voting', color: '#4ade80', votes: 45 },
          { id: 'proportional', label: 'Proportional representation', color: '#60a5fa', votes: 38 },
          { id: 'approval', label: 'Approval voting', color: '#c084fc', votes: 20 },
          { id: 'fptp', label: 'Keep first-past-the-post', color: '#f87171', votes: 25 },
        ],
      },
      {
        id: 'implementation',
        label: 'Implementation Approach',
        choices: [
          { id: 'federal', label: 'Federal mandate', color: '#60a5fa', votes: 35 },
          { id: 'state', label: 'State-by-state adoption', color: '#facc15', votes: 50 },
          { id: 'local', label: 'Start at local level', color: '#4ade80', votes: 43 },
        ],
      },
    ],
  },
  {
    id: 'universal-basic-income',
    title: 'Universal Basic Income',
    description: 'Should governments provide a universal basic income to all citizens regardless of employment status?',
    category: 'Politics',
    createdAt: Date.now() - DAY * 10,
    totalVotes: 145,
    metrics: [
      {
        id: 'support',
        label: 'Level of Support',
        choices: [
          { id: 'full', label: 'Full UBI for all', color: '#4ade80', votes: 42 },
          { id: 'partial', label: 'Partial / targeted UBI', color: '#60a5fa', votes: 48 },
          { id: 'against', label: 'Against UBI', color: '#f87171', votes: 30 },
          { id: 'unsure', label: 'Need more data', color: '#facc15', votes: 25 },
        ],
      },
      {
        id: 'funding',
        label: 'Funding Source',
        choices: [
          { id: 'wealth-tax', label: 'Wealth tax', color: '#f87171', votes: 50 },
          { id: 'vat', label: 'Value-added tax', color: '#fb923c', votes: 35 },
          { id: 'cut-programs', label: 'Replace existing programs', color: '#c084fc', votes: 32 },
          { id: 'money-creation', label: 'Money creation', color: '#facc15', votes: 28 },
        ],
      },
      {
        id: 'amount',
        label: 'Monthly Amount (USD)',
        choices: [
          { id: '500', label: '$500/month', color: '#d1d5db', votes: 30 },
          { id: '1000', label: '$1,000/month', color: '#60a5fa', votes: 55 },
          { id: '2000', label: '$2,000/month', color: '#4ade80', votes: 35 },
          { id: '3000', label: '$3,000+/month', color: '#c084fc', votes: 25 },
        ],
      },
    ],
  },
  {
    id: 'immigration-policy',
    title: 'Immigration Policy',
    description: 'How should countries approach immigration policy in an increasingly interconnected world?',
    category: 'Politics',
    createdAt: Date.now() - DAY * 18,
    totalVotes: 102,
    metrics: [
      {
        id: 'approach',
        label: 'Overall Approach',
        choices: [
          { id: 'open', label: 'Open borders', color: '#4ade80', votes: 18 },
          { id: 'merit', label: 'Merit-based system', color: '#60a5fa', votes: 38 },
          { id: 'current', label: 'Maintain current levels', color: '#facc15', votes: 25 },
          { id: 'restrict', label: 'More restrictive', color: '#f87171', votes: 21 },
        ],
      },
      {
        id: 'priority',
        label: 'Priority Factor',
        choices: [
          { id: 'skills', label: 'Skills & education', color: '#60a5fa', votes: 40 },
          { id: 'family', label: 'Family reunification', color: '#fb923c', votes: 28 },
          { id: 'humanitarian', label: 'Humanitarian need', color: '#f87171', votes: 34 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Environment (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'urban-transportation',
    title: 'Urban Transportation Future',
    description: 'How should cities redesign transportation to be sustainable and efficient?',
    category: 'Environment',
    createdAt: Date.now() - DAY * 9,
    totalVotes: 76,
    metrics: [
      {
        id: 'priority',
        label: 'Top Priority',
        choices: [
          { id: 'public-transit', label: 'Expand public transit', color: '#60a5fa', votes: 30 },
          { id: 'cycling', label: 'Bike infrastructure', color: '#4ade80', votes: 20 },
          { id: 'ev', label: 'Electric vehicles', color: '#c084fc', votes: 16 },
          { id: 'walkability', label: 'Walkable cities', color: '#fb923c', votes: 10 },
        ],
      },
      {
        id: 'car-policy',
        label: 'Car Restriction Policy',
        choices: [
          { id: 'ban', label: 'Ban cars in city centers', color: '#f87171', votes: 22 },
          { id: 'congestion', label: 'Congestion pricing', color: '#facc15', votes: 28 },
          { id: 'no-change', label: 'No restrictions needed', color: '#d1d5db', votes: 26 },
        ],
      },
    ],
  },
  {
    id: 'ocean-conservation',
    title: 'Ocean Conservation',
    description: 'What is the most urgent action needed to protect our oceans from pollution and overfishing?',
    category: 'Environment',
    createdAt: Date.now() - DAY * 14,
    totalVotes: 68,
    metrics: [
      {
        id: 'threat',
        label: 'Biggest Threat',
        choices: [
          { id: 'plastic', label: 'Plastic pollution', color: '#fb923c', votes: 25 },
          { id: 'overfishing', label: 'Overfishing', color: '#f87171', votes: 20 },
          { id: 'acidification', label: 'Ocean acidification', color: '#c084fc', votes: 13 },
          { id: 'warming', label: 'Ocean warming', color: '#facc15', votes: 10 },
        ],
      },
      {
        id: 'action',
        label: 'Priority Action',
        choices: [
          { id: 'mpas', label: 'Marine protected areas', color: '#60a5fa', votes: 28 },
          { id: 'ban-plastics', label: 'Ban single-use plastics', color: '#4ade80', votes: 22 },
          { id: 'fishing-quotas', label: 'Stricter fishing quotas', color: '#fb923c', votes: 18 },
        ],
      },
      {
        id: 'responsibility',
        label: 'Primary Responsibility',
        choices: [
          { id: 'governments', label: 'Governments', color: '#60a5fa', votes: 30 },
          { id: 'corporations', label: 'Corporations', color: '#f87171', votes: 25 },
          { id: 'individuals', label: 'Individuals', color: '#4ade80', votes: 13 },
        ],
      },
    ],
  },
  {
    id: 'sustainable-agriculture',
    title: 'Sustainable Agriculture',
    description: 'How should we transform food production to feed a growing population sustainably?',
    category: 'Environment',
    createdAt: Date.now() - DAY * 20,
    totalVotes: 85,
    metrics: [
      {
        id: 'method',
        label: 'Most Promising Method',
        choices: [
          { id: 'organic', label: 'Organic farming', color: '#4ade80', votes: 22 },
          { id: 'vertical', label: 'Vertical farming', color: '#c084fc', votes: 25 },
          { id: 'precision', label: 'Precision agriculture', color: '#60a5fa', votes: 20 },
          { id: 'lab-meat', label: 'Lab-grown meat', color: '#fb923c', votes: 18 },
        ],
      },
      {
        id: 'diet',
        label: 'Diet Shift Needed?',
        choices: [
          { id: 'plant-based', label: 'Mostly plant-based', color: '#4ade80', votes: 35 },
          { id: 'reduce-meat', label: 'Reduce meat consumption', color: '#facc15', votes: 30 },
          { id: 'no-change', label: 'No diet change needed', color: '#f87171', votes: 20 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Health (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'mental-health-digital-age',
    title: 'Mental Health in the Digital Age',
    description: 'How is technology affecting mental health, and what should be done about it?',
    category: 'Health',
    createdAt: Date.now() - DAY * 11,
    totalVotes: 95,
    metrics: [
      {
        id: 'impact',
        label: 'Technology Impact on Mental Health',
        choices: [
          { id: 'very-negative', label: 'Very negative', color: '#f87171', votes: 30 },
          { id: 'somewhat-negative', label: 'Somewhat negative', color: '#fb923c', votes: 35 },
          { id: 'neutral', label: 'Neutral', color: '#facc15', votes: 15 },
          { id: 'positive', label: 'Can be positive', color: '#4ade80', votes: 15 },
        ],
      },
      {
        id: 'intervention',
        label: 'Best Intervention',
        choices: [
          { id: 'screen-limits', label: 'Screen time limits', color: '#60a5fa', votes: 28 },
          { id: 'education', label: 'Digital literacy education', color: '#4ade80', votes: 32 },
          { id: 'platform-design', label: 'Regulate platform design', color: '#f87171', votes: 35 },
        ],
      },
      {
        id: 'age-restriction',
        label: 'Minimum Social Media Age',
        choices: [
          { id: '13', label: 'Keep at 13', color: '#d1d5db', votes: 15 },
          { id: '16', label: 'Raise to 16', color: '#facc15', votes: 40 },
          { id: '18', label: 'Raise to 18', color: '#f87171', votes: 25 },
          { id: 'none', label: 'No age restriction', color: '#4ade80', votes: 15 },
        ],
      },
    ],
  },
  {
    id: 'healthcare-system-design',
    title: 'Healthcare System Design',
    description: 'What is the ideal healthcare system? Single-payer, multi-payer, or market-based?',
    category: 'Health',
    createdAt: Date.now() - DAY * 16,
    totalVotes: 132,
    metrics: [
      {
        id: 'system',
        label: 'Preferred System',
        choices: [
          { id: 'single-payer', label: 'Single-payer (Medicare for All)', color: '#60a5fa', votes: 45 },
          { id: 'multi-payer', label: 'Multi-payer universal', color: '#4ade80', votes: 35 },
          { id: 'public-option', label: 'Public option + private', color: '#facc15', votes: 30 },
          { id: 'market', label: 'Free market', color: '#f87171', votes: 22 },
        ],
      },
      {
        id: 'priority',
        label: 'Top Priority',
        choices: [
          { id: 'cost', label: 'Lower costs', color: '#4ade80', votes: 50 },
          { id: 'access', label: 'Universal access', color: '#60a5fa', votes: 45 },
          { id: 'quality', label: 'Quality of care', color: '#c084fc', votes: 37 },
        ],
      },
    ],
  },
  {
    id: 'pandemic-preparedness',
    title: 'Pandemic Preparedness',
    description: 'How should the world prepare for future pandemics after COVID-19?',
    category: 'Health',
    createdAt: Date.now() - DAY * 22,
    totalVotes: 78,
    metrics: [
      {
        id: 'priority',
        label: 'Top Preparedness Priority',
        choices: [
          { id: 'surveillance', label: 'Global disease surveillance', color: '#60a5fa', votes: 28 },
          { id: 'vaccine', label: 'Rapid vaccine development', color: '#4ade80', votes: 25 },
          { id: 'stockpiles', label: 'Medical supply stockpiles', color: '#fb923c', votes: 15 },
          { id: 'coordination', label: 'International coordination', color: '#c084fc', votes: 10 },
        ],
      },
      {
        id: 'governance',
        label: 'Who Should Lead?',
        choices: [
          { id: 'who', label: 'Strengthened WHO', color: '#60a5fa', votes: 30 },
          { id: 'new-body', label: 'New global health body', color: '#c084fc', votes: 20 },
          { id: 'national', label: 'National agencies', color: '#facc15', votes: 28 },
        ],
      },
      {
        id: 'funding',
        label: 'Funding Approach',
        choices: [
          { id: 'global-tax', label: 'Global health tax', color: '#f87171', votes: 22 },
          { id: 'gdp-pledge', label: 'GDP percentage pledge', color: '#60a5fa', votes: 30 },
          { id: 'voluntary', label: 'Voluntary contributions', color: '#4ade80', votes: 26 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Sports (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'esports-recognition',
    title: 'Esports Recognition',
    description: 'Should esports be recognized as official sports and included in events like the Olympics?',
    category: 'Sports',
    createdAt: Date.now() - DAY * 13,
    totalVotes: 88,
    metrics: [
      {
        id: 'olympic',
        label: 'Olympics Inclusion',
        choices: [
          { id: 'yes', label: 'Yes, include in Olympics', color: '#4ade80', votes: 35 },
          { id: 'separate', label: 'Separate esports Olympics', color: '#60a5fa', votes: 25 },
          { id: 'no', label: 'Not a real sport', color: '#f87171', votes: 28 },
        ],
      },
      {
        id: 'scholarship',
        label: 'College Esports Scholarships',
        choices: [
          { id: 'full', label: 'Full athletic scholarships', color: '#4ade80', votes: 30 },
          { id: 'partial', label: 'Partial scholarships', color: '#facc15', votes: 32 },
          { id: 'none', label: 'No sports scholarships', color: '#f87171', votes: 26 },
        ],
      },
    ],
  },
  {
    id: 'college-athlete-compensation',
    title: 'College Athlete Compensation',
    description: 'Should college athletes be paid beyond scholarships? How should NIL deals be regulated?',
    category: 'Sports',
    createdAt: Date.now() - DAY * 19,
    totalVotes: 105,
    metrics: [
      {
        id: 'compensation',
        label: 'Compensation Model',
        choices: [
          { id: 'salary', label: 'Direct salary from school', color: '#4ade80', votes: 28 },
          { id: 'nil', label: 'NIL deals only', color: '#60a5fa', votes: 35 },
          { id: 'revenue-share', label: 'Revenue sharing', color: '#c084fc', votes: 22 },
          { id: 'scholarship-only', label: 'Scholarship is enough', color: '#f87171', votes: 20 },
        ],
      },
      {
        id: 'regulation',
        label: 'NIL Regulation',
        choices: [
          { id: 'ncaa', label: 'NCAA should regulate', color: '#60a5fa', votes: 30 },
          { id: 'federal', label: 'Federal legislation', color: '#fb923c', votes: 35 },
          { id: 'free-market', label: 'Free market', color: '#4ade80', votes: 25 },
          { id: 'school', label: 'School-by-school rules', color: '#facc15', votes: 15 },
        ],
      },
    ],
  },
  {
    id: 'performance-enhancing-tech',
    title: 'Performance-Enhancing Technology',
    description: 'Where is the line between acceptable training technology and unfair advantage in sports?',
    category: 'Sports',
    createdAt: Date.now() - DAY * 25,
    totalVotes: 72,
    metrics: [
      {
        id: 'acceptable',
        label: 'What Should Be Allowed?',
        choices: [
          { id: 'all-tech', label: 'All technology welcome', color: '#4ade80', votes: 15 },
          { id: 'training-only', label: 'Training tech only', color: '#60a5fa', votes: 28 },
          { id: 'strict-limits', label: 'Strict equipment limits', color: '#facc15', votes: 18 },
          { id: 'traditional', label: 'Keep sports traditional', color: '#f87171', votes: 11 },
        ],
      },
      {
        id: 'super-shoes',
        label: 'Super Shoes in Running',
        choices: [
          { id: 'allow', label: 'Allow all shoe tech', color: '#4ade80', votes: 25 },
          { id: 'standardize', label: 'Standardize shoes', color: '#60a5fa', votes: 27 },
          { id: 'ban-advanced', label: 'Ban carbon plates', color: '#f87171', votes: 20 },
        ],
      },
      {
        id: 'ai-coaching',
        label: 'AI-Assisted Coaching',
        choices: [
          { id: 'embrace', label: 'Fully embrace AI coaching', color: '#4ade80', votes: 30 },
          { id: 'limit', label: 'Allow with limits', color: '#facc15', votes: 25 },
          { id: 'ban-competition', label: 'Ban during competition', color: '#f87171', votes: 17 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Other (3 topics) ──
  // ═══════════════════════════════════════
  {
    id: 'four-day-work-week',
    title: 'Four-Day Work Week',
    description: 'Should the standard work week be reduced to four days? What would the impact be?',
    category: 'Other',
    createdAt: Date.now() - DAY * 17,
    totalVotes: 140,
    metrics: [
      {
        id: 'support',
        label: 'Support Level',
        choices: [
          { id: 'strongly-for', label: 'Strongly support', color: '#4ade80', votes: 60 },
          { id: 'conditional', label: 'Support if same pay', color: '#60a5fa', votes: 40 },
          { id: 'against', label: 'Against it', color: '#f87171', votes: 25 },
          { id: 'depends', label: 'Depends on industry', color: '#facc15', votes: 15 },
        ],
      },
      {
        id: 'implementation',
        label: 'Implementation',
        choices: [
          { id: 'mandate', label: 'Government mandate', color: '#60a5fa', votes: 35 },
          { id: 'incentive', label: 'Tax incentives for companies', color: '#4ade80', votes: 50 },
          { id: 'voluntary', label: 'Company choice', color: '#facc15', votes: 55 },
        ],
      },
    ],
  },
  {
    id: 'space-tourism-ethics',
    title: 'Space Tourism Ethics',
    description: 'Is billionaire-funded space tourism a waste of resources or a stepping stone for humanity?',
    category: 'Other',
    createdAt: Date.now() - DAY * 23,
    totalVotes: 65,
    metrics: [
      {
        id: 'value',
        label: 'Overall Value',
        choices: [
          { id: 'positive', label: 'Drives innovation', color: '#4ade80', votes: 20 },
          { id: 'mixed', label: 'Mixed feelings', color: '#facc15', votes: 18 },
          { id: 'waste', label: 'Waste of resources', color: '#f87171', votes: 27 },
        ],
      },
      {
        id: 'taxation',
        label: 'Should It Be Taxed?',
        choices: [
          { id: 'heavy-tax', label: 'Heavy carbon/luxury tax', color: '#f87171', votes: 30 },
          { id: 'moderate-tax', label: 'Moderate tax', color: '#facc15', votes: 20 },
          { id: 'no-tax', label: 'No special tax', color: '#4ade80', votes: 15 },
        ],
      },
      {
        id: 'access',
        label: 'Future Access',
        choices: [
          { id: 'affordable', label: 'Will become affordable', color: '#4ade80', votes: 25 },
          { id: 'elite', label: 'Always for the rich', color: '#f87171', votes: 22 },
          { id: 'government', label: 'Government should fund public access', color: '#60a5fa', votes: 18 },
        ],
      },
    ],
  },
  {
    id: 'digital-privacy-vs-security',
    title: 'Digital Privacy vs Security',
    description: 'How should society balance individual digital privacy with national security and law enforcement needs?',
    category: 'Other',
    createdAt: Date.now() - DAY * 28,
    totalVotes: 118,
    metrics: [
      {
        id: 'balance',
        label: 'Privacy vs Security Balance',
        choices: [
          { id: 'privacy-first', label: 'Privacy is paramount', color: '#4ade80', votes: 40 },
          { id: 'balanced', label: 'Need careful balance', color: '#60a5fa', votes: 38 },
          { id: 'security-first', label: 'Security takes priority', color: '#f87171', votes: 22 },
          { id: 'case-by-case', label: 'Case-by-case basis', color: '#facc15', votes: 18 },
        ],
      },
      {
        id: 'encryption',
        label: 'Encryption Backdoors',
        choices: [
          { id: 'never', label: 'Never allow backdoors', color: '#4ade80', votes: 50 },
          { id: 'warrant', label: 'Only with warrant', color: '#60a5fa', votes: 38 },
          { id: 'national-security', label: 'For national security', color: '#fb923c', votes: 18 },
          { id: 'all-access', label: 'Government should have access', color: '#f87171', votes: 12 },
        ],
      },
      {
        id: 'surveillance',
        label: 'Public Surveillance',
        choices: [
          { id: 'ban', label: 'Ban facial recognition', color: '#f87171', votes: 35 },
          { id: 'regulate', label: 'Strict regulation', color: '#60a5fa', votes: 42 },
          { id: 'allow', label: 'Allow with oversight', color: '#facc15', votes: 28 },
          { id: 'expand', label: 'Expand for safety', color: '#4ade80', votes: 13 },
        ],
      },
    ],
  },
];

async function seed() {
  console.log(`Seeding PolyVote topics… (${SEED_TOPICS.length} topics across 8 categories)`);
  for (const topic of SEED_TOPICS) {
    const { id, ...data } = topic;
    await setDoc(doc(collection(db, 'topics'), id), data);
    console.log(`  ✓ ${topic.title} [${topic.category}]`);
  }
  console.log(`Done! ${SEED_TOPICS.length} topics seeded.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
