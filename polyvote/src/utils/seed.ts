/*
 * CHANGE: Expanded seed script – 24 topics across 8 categories
 * REASON: Populates the database with diverse topics for testing/preview
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
const now = Date.now();

// ── Seed data: 8 categories, ~24 topics, 2-4 metrics each ──

const SEED_TOPICS = [
  // ═══════════════════════════════════════
  // ── Technology (3) ─────────────────────
  // ═══════════════════════════════════════
  {
    id: 'ai-regulation',
    title: 'AI Regulation Approaches',
    description: 'How should governments regulate artificial intelligence development and deployment?',
    category: 'Technology',
    createdAt: now - DAY * 2,
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
    createdAt: now - DAY * 5,
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
    id: 'cryptocurrency-digital-currency',
    title: 'Cryptocurrency & Digital Currency',
    description: 'Should governments adopt central bank digital currencies or embrace decentralized crypto?',
    category: 'Technology',
    createdAt: now - DAY * 8,
    totalVotes: 87,
    metrics: [
      {
        id: 'preferred-model',
        label: 'Preferred Currency Model',
        choices: [
          { id: 'cbdc', label: 'Central bank digital currency', color: '#60a5fa', votes: 30 },
          { id: 'decentralized', label: 'Decentralized crypto (BTC, ETH)', color: '#fb923c', votes: 35 },
          { id: 'traditional', label: 'Traditional fiat only', color: '#d1d5db', votes: 22 },
        ],
      },
      {
        id: 'regulation-level',
        label: 'Crypto Regulation',
        choices: [
          { id: 'heavy', label: 'Heavy regulation', color: '#f87171', votes: 25 },
          { id: 'light', label: 'Light-touch regulation', color: '#facc15', votes: 38 },
          { id: 'none', label: 'No regulation', color: '#4ade80', votes: 24 },
        ],
      },
      {
        id: 'adoption-timeline',
        label: 'Mass Adoption Timeline',
        choices: [
          { id: 'soon', label: 'Within 5 years', color: '#4ade80', votes: 20 },
          { id: 'medium', label: '5-15 years', color: '#60a5fa', votes: 42 },
          { id: 'never', label: 'Never mainstream', color: '#f87171', votes: 25 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Science (3) ────────────────────────
  // ═══════════════════════════════════════
  {
    id: 'space-exploration',
    title: 'Space Exploration Priorities',
    description: 'Where should humanity focus space exploration resources in the next decade?',
    category: 'Science',
    createdAt: now - DAY * 1,
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
    createdAt: now - DAY * 3,
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
    description: 'How far should humanity go with CRISPR gene editing technology?',
    category: 'Science',
    createdAt: now - DAY * 12,
    totalVotes: 73,
    metrics: [
      {
        id: 'acceptable-use',
        label: 'Acceptable Use Cases',
        choices: [
          { id: 'disease', label: 'Curing genetic diseases only', color: '#4ade80', votes: 32 },
          { id: 'enhancement', label: 'Disease + human enhancement', color: '#60a5fa', votes: 22 },
          { id: 'unrestricted', label: 'Unrestricted research', color: '#c084fc', votes: 11 },
          { id: 'ban', label: 'Ban human gene editing', color: '#f87171', votes: 8 },
        ],
      },
      {
        id: 'oversight',
        label: 'Who Should Oversee?',
        choices: [
          { id: 'international', label: 'International body (WHO/UN)', color: '#60a5fa', votes: 35 },
          { id: 'national', label: 'National governments', color: '#fb923c', votes: 22 },
          { id: 'scientists', label: 'Scientific community self-governance', color: '#facc15', votes: 16 },
        ],
      },
      {
        id: 'equity',
        label: 'Access & Equity',
        choices: [
          { id: 'universal', label: 'Universal access required', color: '#4ade80', votes: 40 },
          { id: 'market', label: 'Market-driven pricing', color: '#f87171', votes: 15 },
          { id: 'subsidized', label: 'Subsidized for low-income', color: '#facc15', votes: 18 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Culture (3) ────────────────────────
  // ═══════════════════════════════════════
  {
    id: 'social-media-impact',
    title: 'Social Media Impact on Society',
    description: 'Is social media a net positive or negative for modern society?',
    category: 'Culture',
    createdAt: now - DAY * 4,
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
    createdAt: now - DAY * 6,
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
    id: 'ai-generated-art-copyright',
    title: 'AI-Generated Art & Copyright',
    description: 'Should AI-generated art be eligible for copyright? Who owns the rights?',
    category: 'Culture',
    createdAt: now - DAY * 15,
    totalVotes: 92,
    metrics: [
      {
        id: 'copyright-eligible',
        label: 'Copyright Eligibility',
        choices: [
          { id: 'yes', label: 'Yes, fully copyrightable', color: '#4ade80', votes: 22 },
          { id: 'partial', label: 'Partial / limited rights', color: '#facc15', votes: 35 },
          { id: 'no', label: 'No, public domain', color: '#f87171', votes: 28 },
          { id: 'new-framework', label: 'Needs new legal framework', color: '#c084fc', votes: 7 },
        ],
      },
      {
        id: 'ownership',
        label: 'Who Owns AI Art?',
        choices: [
          { id: 'prompter', label: 'The person who prompted', color: '#60a5fa', votes: 30 },
          { id: 'developer', label: 'AI model developer', color: '#fb923c', votes: 18 },
          { id: 'training-artists', label: 'Artists in training data', color: '#f87171', votes: 25 },
          { id: 'nobody', label: 'Nobody / public domain', color: '#d1d5db', votes: 19 },
        ],
      },
      {
        id: 'artist-impact',
        label: 'Impact on Human Artists',
        choices: [
          { id: 'threat', label: 'Major threat to livelihoods', color: '#f87171', votes: 38 },
          { id: 'tool', label: 'New tool, net positive', color: '#4ade80', votes: 30 },
          { id: 'coexist', label: 'Will coexist fine', color: '#60a5fa', votes: 24 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Politics (3) ───────────────────────
  // ═══════════════════════════════════════
  {
    id: 'voting-system-reform',
    title: 'Voting System Reform',
    description: 'Should countries move away from first-past-the-post to alternative voting systems?',
    category: 'Politics',
    createdAt: now - DAY * 7,
    totalVotes: 110,
    metrics: [
      {
        id: 'preferred-system',
        label: 'Preferred Voting System',
        choices: [
          { id: 'ranked', label: 'Ranked-choice voting', color: '#4ade80', votes: 40 },
          { id: 'proportional', label: 'Proportional representation', color: '#60a5fa', votes: 32 },
          { id: 'fptp', label: 'Keep first-past-the-post', color: '#f87171', votes: 20 },
          { id: 'approval', label: 'Approval voting', color: '#facc15', votes: 18 },
        ],
      },
      {
        id: 'urgency',
        label: 'Reform Urgency',
        choices: [
          { id: 'critical', label: 'Critical – needs immediate change', color: '#f87171', votes: 45 },
          { id: 'important', label: 'Important but not urgent', color: '#fb923c', votes: 40 },
          { id: 'unnecessary', label: 'Current system works fine', color: '#d1d5db', votes: 25 },
        ],
      },
    ],
  },
  {
    id: 'universal-basic-income',
    title: 'Universal Basic Income',
    description: 'Should governments provide a guaranteed basic income to all citizens?',
    category: 'Politics',
    createdAt: now - DAY * 10,
    totalVotes: 135,
    metrics: [
      {
        id: 'support',
        label: 'UBI Support Level',
        choices: [
          { id: 'full', label: 'Full UBI for all adults', color: '#4ade80', votes: 45 },
          { id: 'targeted', label: 'Targeted / means-tested', color: '#60a5fa', votes: 42 },
          { id: 'against', label: 'Against UBI entirely', color: '#f87171', votes: 30 },
          { id: 'pilot', label: 'More pilot programs first', color: '#facc15', votes: 18 },
        ],
      },
      {
        id: 'funding',
        label: 'How to Fund UBI',
        choices: [
          { id: 'wealth-tax', label: 'Wealth tax', color: '#f87171', votes: 50 },
          { id: 'vat', label: 'Value-added tax (VAT)', color: '#fb923c', votes: 35 },
          { id: 'automation-tax', label: 'Automation / robot tax', color: '#c084fc', votes: 30 },
          { id: 'reallocation', label: 'Reallocate existing welfare', color: '#60a5fa', votes: 20 },
        ],
      },
      {
        id: 'amount',
        label: 'Monthly Amount (USD)',
        choices: [
          { id: 'low', label: '$500 / month', color: '#d1d5db', votes: 25 },
          { id: 'medium', label: '$1,000 / month', color: '#facc15', votes: 55 },
          { id: 'high', label: '$2,000+ / month', color: '#4ade80', votes: 35 },
          { id: 'variable', label: 'Varies by cost of living', color: '#60a5fa', votes: 20 },
        ],
      },
    ],
  },
  {
    id: 'immigration-policy',
    title: 'Immigration Policy',
    description: 'How should countries approach immigration policy in the modern era?',
    category: 'Politics',
    createdAt: now - DAY * 18,
    totalVotes: 98,
    metrics: [
      {
        id: 'openness',
        label: 'Border Policy',
        choices: [
          { id: 'open', label: 'Open borders', color: '#4ade80', votes: 18 },
          { id: 'skills-based', label: 'Skills-based immigration', color: '#60a5fa', votes: 38 },
          { id: 'current', label: 'Maintain current levels', color: '#facc15', votes: 22 },
          { id: 'restrictive', label: 'More restrictive', color: '#f87171', votes: 20 },
        ],
      },
      {
        id: 'integration',
        label: 'Integration Approach',
        choices: [
          { id: 'multicultural', label: 'Multicultural coexistence', color: '#c084fc', votes: 35 },
          { id: 'assimilation', label: 'Cultural assimilation', color: '#fb923c', votes: 30 },
          { id: 'balanced', label: 'Balanced integration', color: '#60a5fa', votes: 33 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Environment (3) ────────────────────
  // ═══════════════════════════════════════
  {
    id: 'urban-transportation-future',
    title: 'Urban Transportation Future',
    description: 'How should cities redesign transportation for the next generation?',
    category: 'Environment',
    createdAt: now - DAY * 9,
    totalVotes: 78,
    metrics: [
      {
        id: 'priority-mode',
        label: 'Priority Transport Mode',
        choices: [
          { id: 'public', label: 'Public transit expansion', color: '#60a5fa', votes: 30 },
          { id: 'cycling', label: 'Cycling infrastructure', color: '#4ade80', votes: 20 },
          { id: 'ev', label: 'Electric vehicles', color: '#c084fc', votes: 18 },
          { id: 'autonomous', label: 'Autonomous vehicles', color: '#fb923c', votes: 10 },
        ],
      },
      {
        id: 'car-free',
        label: 'Car-Free City Centers?',
        choices: [
          { id: 'yes', label: 'Yes, fully car-free', color: '#4ade80', votes: 28 },
          { id: 'partial', label: 'Partial restrictions', color: '#facc15', votes: 32 },
          { id: 'no', label: 'No, keep car access', color: '#f87171', votes: 18 },
        ],
      },
    ],
  },
  {
    id: 'ocean-conservation',
    title: 'Ocean Conservation',
    description: 'What are the most critical ocean conservation priorities?',
    category: 'Environment',
    createdAt: now - DAY * 14,
    totalVotes: 62,
    metrics: [
      {
        id: 'top-threat',
        label: 'Biggest Threat to Oceans',
        choices: [
          { id: 'plastic', label: 'Plastic pollution', color: '#f87171', votes: 25 },
          { id: 'overfishing', label: 'Overfishing', color: '#fb923c', votes: 15 },
          { id: 'acidification', label: 'Ocean acidification', color: '#c084fc', votes: 12 },
          { id: 'warming', label: 'Ocean warming', color: '#facc15', votes: 10 },
        ],
      },
      {
        id: 'solution',
        label: 'Most Effective Solution',
        choices: [
          { id: 'protected-areas', label: 'Marine protected areas', color: '#4ade80', votes: 22 },
          { id: 'regulation', label: 'Stricter fishing regulations', color: '#60a5fa', votes: 20 },
          { id: 'cleanup', label: 'Ocean cleanup technology', color: '#c084fc', votes: 20 },
        ],
      },
    ],
  },
  {
    id: 'sustainable-agriculture',
    title: 'Sustainable Agriculture',
    description: 'How should we transform food production for a sustainable future?',
    category: 'Environment',
    createdAt: now - DAY * 20,
    totalVotes: 85,
    metrics: [
      {
        id: 'farming-method',
        label: 'Best Farming Approach',
        choices: [
          { id: 'organic', label: 'Organic farming', color: '#4ade80', votes: 28 },
          { id: 'precision', label: 'Precision agriculture (AI/drones)', color: '#60a5fa', votes: 25 },
          { id: 'vertical', label: 'Vertical / indoor farming', color: '#c084fc', votes: 18 },
          { id: 'regenerative', label: 'Regenerative agriculture', color: '#fb923c', votes: 14 },
        ],
      },
      {
        id: 'protein-future',
        label: 'Future of Protein',
        choices: [
          { id: 'plant', label: 'Plant-based alternatives', color: '#4ade80', votes: 30 },
          { id: 'lab-meat', label: 'Lab-grown meat', color: '#c084fc', votes: 25 },
          { id: 'insects', label: 'Insect protein', color: '#facc15', votes: 10 },
          { id: 'traditional', label: 'Traditional livestock', color: '#f87171', votes: 20 },
        ],
      },
      {
        id: 'subsidy-reform',
        label: 'Agricultural Subsidies',
        choices: [
          { id: 'redirect', label: 'Redirect to sustainable farms', color: '#4ade80', votes: 40 },
          { id: 'eliminate', label: 'Eliminate all subsidies', color: '#f87171', votes: 15 },
          { id: 'keep', label: 'Keep current system', color: '#d1d5db', votes: 30 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Health (3) ─────────────────────────
  // ═══════════════════════════════════════
  {
    id: 'mental-health-digital-age',
    title: 'Mental Health in the Digital Age',
    description: 'How should society address the mental health crisis driven by digital technology?',
    category: 'Health',
    createdAt: now - DAY * 11,
    totalVotes: 105,
    metrics: [
      {
        id: 'biggest-factor',
        label: 'Biggest Digital Mental Health Factor',
        choices: [
          { id: 'social-media', label: 'Social media comparison', color: '#f87171', votes: 40 },
          { id: 'screen-time', label: 'Excessive screen time', color: '#fb923c', votes: 30 },
          { id: 'isolation', label: 'Digital isolation', color: '#c084fc', votes: 20 },
          { id: 'information', label: 'Information overload', color: '#facc15', votes: 15 },
        ],
      },
      {
        id: 'solution',
        label: 'Best Intervention',
        choices: [
          { id: 'education', label: 'Digital literacy education', color: '#60a5fa', votes: 35 },
          { id: 'regulation', label: 'Platform regulation', color: '#f87171', votes: 28 },
          { id: 'tools', label: 'Better wellbeing tools in apps', color: '#4ade80', votes: 25 },
          { id: 'individual', label: 'Individual responsibility', color: '#d1d5db', votes: 17 },
        ],
      },
    ],
  },
  {
    id: 'healthcare-system-design',
    title: 'Healthcare System Design',
    description: 'What is the ideal healthcare system structure for a modern nation?',
    category: 'Health',
    createdAt: now - DAY * 16,
    totalVotes: 142,
    metrics: [
      {
        id: 'system-type',
        label: 'Healthcare System Model',
        choices: [
          { id: 'single-payer', label: 'Single-payer (government)', color: '#60a5fa', votes: 52 },
          { id: 'multi-payer', label: 'Multi-payer universal', color: '#4ade80', votes: 38 },
          { id: 'private', label: 'Private market-based', color: '#fb923c', votes: 28 },
          { id: 'hybrid', label: 'Public-private hybrid', color: '#c084fc', votes: 24 },
        ],
      },
      {
        id: 'priority',
        label: 'Top Healthcare Priority',
        choices: [
          { id: 'access', label: 'Universal access', color: '#4ade80', votes: 50 },
          { id: 'cost', label: 'Cost reduction', color: '#facc15', votes: 40 },
          { id: 'quality', label: 'Quality of care', color: '#60a5fa', votes: 35 },
          { id: 'prevention', label: 'Preventive care focus', color: '#c084fc', votes: 17 },
        ],
      },
      {
        id: 'pharma',
        label: 'Pharmaceutical Pricing',
        choices: [
          { id: 'negotiation', label: 'Government price negotiation', color: '#60a5fa', votes: 55 },
          { id: 'caps', label: 'Hard price caps', color: '#f87171', votes: 40 },
          { id: 'market', label: 'Free market pricing', color: '#fb923c', votes: 25 },
          { id: 'generic', label: 'Accelerate generics', color: '#4ade80', votes: 22 },
        ],
      },
    ],
  },
  {
    id: 'pandemic-preparedness',
    title: 'Pandemic Preparedness',
    description: 'How should the world prepare for the next pandemic?',
    category: 'Health',
    createdAt: now - DAY * 22,
    totalVotes: 88,
    metrics: [
      {
        id: 'top-priority',
        label: 'Top Preparedness Priority',
        choices: [
          { id: 'early-warning', label: 'Early warning systems', color: '#4ade80', votes: 30 },
          { id: 'vaccine-infra', label: 'Vaccine manufacturing capacity', color: '#60a5fa', votes: 28 },
          { id: 'stockpiles', label: 'Medical supply stockpiles', color: '#fb923c', votes: 18 },
          { id: 'research', label: 'Basic research funding', color: '#c084fc', votes: 12 },
        ],
      },
      {
        id: 'coordination',
        label: 'Coordination Level',
        choices: [
          { id: 'global', label: 'Global treaty / WHO reform', color: '#60a5fa', votes: 38 },
          { id: 'regional', label: 'Regional alliances', color: '#facc15', votes: 25 },
          { id: 'national', label: 'Each nation independently', color: '#f87171', votes: 25 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Sports (3) ─────────────────────────
  // ═══════════════════════════════════════
  {
    id: 'esports-recognition',
    title: 'Esports Recognition',
    description: 'Should esports be officially recognized as sports and included in the Olympics?',
    category: 'Sports',
    createdAt: now - DAY * 13,
    totalVotes: 75,
    metrics: [
      {
        id: 'olympic-inclusion',
        label: 'Olympics Inclusion',
        choices: [
          { id: 'full', label: 'Full Olympic sport', color: '#4ade80', votes: 28 },
          { id: 'demo', label: 'Demonstration event first', color: '#60a5fa', votes: 22 },
          { id: 'separate', label: 'Separate Esports Olympics', color: '#facc15', votes: 15 },
          { id: 'no', label: 'Not a sport', color: '#f87171', votes: 10 },
        ],
      },
      {
        id: 'legitimacy',
        label: 'Esports as "Real" Sport',
        choices: [
          { id: 'yes', label: 'Absolutely a real sport', color: '#4ade80', votes: 35 },
          { id: 'competition', label: 'Competition, not sport', color: '#facc15', votes: 25 },
          { id: 'no', label: 'Not a sport at all', color: '#f87171', votes: 15 },
        ],
      },
    ],
  },
  {
    id: 'college-athlete-compensation',
    title: 'College Athlete Compensation',
    description: 'How should college athletes be compensated for their contributions?',
    category: 'Sports',
    createdAt: now - DAY * 19,
    totalVotes: 95,
    metrics: [
      {
        id: 'compensation-model',
        label: 'Compensation Model',
        choices: [
          { id: 'salary', label: 'Direct salary from school', color: '#4ade80', votes: 30 },
          { id: 'nil', label: 'NIL deals (name/image/likeness)', color: '#60a5fa', votes: 35 },
          { id: 'scholarship', label: 'Scholarship only', color: '#facc15', votes: 18 },
          { id: 'revenue-share', label: 'Revenue sharing', color: '#c084fc', votes: 12 },
        ],
      },
      {
        id: 'fairness',
        label: 'Pay Equity Across Sports',
        choices: [
          { id: 'equal', label: 'Equal pay all sports', color: '#4ade80', votes: 25 },
          { id: 'revenue-based', label: 'Based on revenue generated', color: '#60a5fa', votes: 42 },
          { id: 'tiered', label: 'Tiered by division', color: '#fb923c', votes: 28 },
        ],
      },
      {
        id: 'impact',
        label: 'Impact on College Sports',
        choices: [
          { id: 'positive', label: 'Mostly positive', color: '#4ade80', votes: 35 },
          { id: 'mixed', label: 'Mixed effects', color: '#facc15', votes: 30 },
          { id: 'negative', label: 'Damaging to traditions', color: '#f87171', votes: 30 },
        ],
      },
    ],
  },
  {
    id: 'performance-enhancing-tech',
    title: 'Performance-Enhancing Technology',
    description: 'Where should the line be drawn on technology in sports performance?',
    category: 'Sports',
    createdAt: now - DAY * 25,
    totalVotes: 68,
    metrics: [
      {
        id: 'tech-limits',
        label: 'Acceptable Technology',
        choices: [
          { id: 'unlimited', label: 'Allow all technology', color: '#4ade80', votes: 12 },
          { id: 'wearables', label: 'Wearables & analytics OK', color: '#60a5fa', votes: 28 },
          { id: 'traditional', label: 'Minimal tech, keep it pure', color: '#f87171', votes: 18 },
          { id: 'case-by-case', label: 'Case-by-case evaluation', color: '#facc15', votes: 10 },
        ],
      },
      {
        id: 'super-shoes',
        label: 'Advanced Equipment (e.g. super shoes)',
        choices: [
          { id: 'allow', label: 'Allow if commercially available', color: '#4ade80', votes: 25 },
          { id: 'standardize', label: 'Standardize equipment', color: '#60a5fa', votes: 22 },
          { id: 'ban', label: 'Ban performance-enhancing gear', color: '#f87171', votes: 21 },
        ],
      },
    ],
  },

  // ═══════════════════════════════════════
  // ── Other (3) ──────────────────────────
  // ═══════════════════════════════════════
  {
    id: 'four-day-work-week',
    title: 'Four-Day Work Week',
    description: 'Should the four-day work week become the new standard?',
    category: 'Other',
    createdAt: now - DAY * 17,
    totalVotes: 120,
    metrics: [
      {
        id: 'support',
        label: 'Support Level',
        choices: [
          { id: 'strongly-for', label: 'Strongly support', color: '#4ade80', votes: 55 },
          { id: 'conditional', label: 'Support with conditions', color: '#60a5fa', votes: 35 },
          { id: 'against', label: 'Against – 5 days needed', color: '#f87171', votes: 20 },
          { id: 'flexible', label: 'Prefer flexible hours instead', color: '#facc15', votes: 10 },
        ],
      },
      {
        id: 'implementation',
        label: 'Implementation Approach',
        choices: [
          { id: 'mandate', label: 'Government mandate', color: '#f87171', votes: 30 },
          { id: 'incentive', label: 'Tax incentives for companies', color: '#60a5fa', votes: 45 },
          { id: 'voluntary', label: 'Voluntary by employer', color: '#4ade80', votes: 35 },
          { id: 'trial', label: 'National trial period first', color: '#facc15', votes: 10 },
        ],
      },
      {
        id: 'pay',
        label: 'Pay Adjustment',
        choices: [
          { id: 'same', label: 'Same pay, fewer hours', color: '#4ade80', votes: 70 },
          { id: 'prorated', label: 'Pro-rated (80% pay)', color: '#f87171', votes: 25 },
          { id: 'performance', label: 'Performance-based', color: '#60a5fa', votes: 25 },
        ],
      },
    ],
  },
  {
    id: 'space-tourism-ethics',
    title: 'Space Tourism Ethics',
    description: 'Is space tourism an exciting frontier or an irresponsible use of resources?',
    category: 'Other',
    createdAt: now - DAY * 23,
    totalVotes: 58,
    metrics: [
      {
        id: 'stance',
        label: 'Overall Stance',
        choices: [
          { id: 'exciting', label: 'Exciting and worthwhile', color: '#4ade80', votes: 18 },
          { id: 'acceptable', label: 'Acceptable if regulated', color: '#60a5fa', votes: 20 },
          { id: 'wasteful', label: 'Wasteful and irresponsible', color: '#f87171', votes: 15 },
          { id: 'premature', label: 'Premature – solve Earth first', color: '#facc15', votes: 5 },
        ],
      },
      {
        id: 'environment',
        label: 'Environmental Concern',
        choices: [
          { id: 'major', label: 'Major concern – limit launches', color: '#f87171', votes: 22 },
          { id: 'moderate', label: 'Moderate – offset emissions', color: '#facc15', votes: 20 },
          { id: 'minor', label: 'Minor impact, not worried', color: '#4ade80', votes: 16 },
        ],
      },
    ],
  },
  {
    id: 'digital-privacy-vs-security',
    title: 'Digital Privacy vs Security',
    description: 'How should society balance individual privacy with collective security?',
    category: 'Other',
    createdAt: now - DAY * 28,
    totalVotes: 130,
    metrics: [
      {
        id: 'balance',
        label: 'Privacy vs Security Balance',
        choices: [
          { id: 'privacy-first', label: 'Privacy is paramount', color: '#4ade80', votes: 45 },
          { id: 'balanced', label: 'Case-by-case balance', color: '#60a5fa', votes: 40 },
          { id: 'security-first', label: 'Security takes priority', color: '#f87171', votes: 25 },
          { id: 'transparency', label: 'Full government transparency', color: '#facc15', votes: 20 },
        ],
      },
      {
        id: 'encryption',
        label: 'Encryption Backdoors',
        choices: [
          { id: 'never', label: 'Never – strong encryption always', color: '#4ade80', votes: 55 },
          { id: 'court-order', label: 'Only with court order', color: '#60a5fa', votes: 40 },
          { id: 'law-enforcement', label: 'Law enforcement should have access', color: '#f87171', votes: 35 },
        ],
      },
      {
        id: 'surveillance',
        label: 'Government Surveillance',
        choices: [
          { id: 'minimal', label: 'Minimal – strict oversight', color: '#4ade80', votes: 48 },
          { id: 'targeted', label: 'Targeted surveillance OK', color: '#60a5fa', votes: 42 },
          { id: 'broad', label: 'Broad surveillance for safety', color: '#f87171', votes: 20 },
          { id: 'none', label: 'No government surveillance', color: '#facc15', votes: 20 },
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
    console.log(`  ✓ ${topic.category} → ${topic.title}`);
  }
  console.log(`\nDone! ${SEED_TOPICS.length} topics seeded.`);
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
