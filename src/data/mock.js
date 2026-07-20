// Mock data structures mirroring the SDD database schema (Section 5.2).
// These drive the entire UI so every view is fully testable without a backend.

// ── Chapter meta ─────────────────────────────────────────────
export const chapter = {
  name: 'ACM TKMCE',
  fullName: 'ACM Student Chapter, TKM College of Engineering',
  established: 2019,
  tagline: 'Advancing computing as a science & profession — one build at a time.',
  description:
    'The official ACM Student Chapter at TKM College of Engineering. We host workshops, hackathons and talks that turn curious students into confident builders.',
  socials: {
    instagram: 'https://instagram.com/acmtkmce',
    linkedin: 'https://linkedin.com/company/acmtkmce',
    github: 'https://github.com/acmtkmce',
    email: 'hello@acmtkmce.org',
  },
}

// ── About: Chapter statistics ────────────────────────────────
export const stats = [
  { label: 'Members', value: 480, suffix: '+' },
  { label: 'Events Conducted', value: 65, suffix: '+' },
  { label: 'Workshops', value: 28, suffix: '' },
  { label: 'Achievements', value: 15, suffix: '' },
]

export const whyJoin = [
  {
    title: 'Learn by Building',
    body: 'Hands-on workshops on web, ML, systems and design — no spectators, only builders.',
    icon: 'Hammer',
  },
  {
    title: 'Global ACM Network',
    body: 'Tap into the world’s largest computing society — resources, competitions and mentors.',
    icon: 'Globe2',
  },
  {
    title: 'Lead & Ship',
    body: 'Own real events and projects. Graduate with a portfolio, not just a certificate.',
    icon: 'Rocket',
  },
  {
    title: 'Community that Cares',
    body: 'A tight-knit group of peers and alumni who review your PRs and your career moves.',
    icon: 'HeartHandshake',
  },
]

// ── Goals: Vision / Mission / Values ─────────────────────────
export const goals = [
  {
    key: 'Vision',
    icon: 'Eye',
    text: 'To be the launchpad where every TKMCE student discovers and masters the craft of computing.',
  },
  {
    key: 'Mission',
    icon: 'Target',
    text: 'Deliver high-signal events, mentorship and open-source culture that make world-class skills accessible on campus.',
  },
  {
    key: 'Values',
    icon: 'Gem',
    text: 'Curiosity over credentials, collaboration over competition, and shipping over talking.',
  },
]

// ── Executive Committee ──────────────────────────────────────
// Ordered top-down by hierarchy: Secretary → teams (Heads before Members)
// → Junior Representative. `lead` marks a standalone leadership role.
export const execomGroups = [
  {
    team: 'Secretary',
    icon: 'Award',
    lead: true,
    members: [{ name: 'Sivanandana J P', role: 'Secretary' }],
  },
  {
    team: 'Program Team',
    icon: 'CalendarRange',
    members: [
      { name: 'Fitha Asma Sulfeekhar', role: 'Head' },
      { name: 'Muhammed Midhlaj K', role: 'Head' },
      { name: 'Nivin M K', role: 'Member' },
      { name: 'Alakananda D', role: 'Member' },
    ],
  },
  {
    team: 'Operations Team',
    icon: 'Settings2',
    members: [
      { name: 'Amna Hudha C P', role: 'Head' },
      { name: 'Vaishnav V Bishoy', role: 'Head' },
      { name: 'Veda P V', role: 'Member' },
      { name: 'Hridhya B S', role: 'Member' },
    ],
  },
  {
    team: 'Design Team',
    icon: 'Palette',
    members: [
      { name: 'Parthiv P', role: 'Head' },
      { name: 'Aparna P', role: 'Member' },
      { name: 'Arathy Vinod', role: 'Member' },
    ],
  },
  {
    team: 'Documentation Team',
    icon: 'FileText',
    members: [
      { name: 'Ananya Suresh', role: 'Head' },
      { name: 'Ashish Joy', role: 'Member' },
      { name: 'Muhammed Hisham A H', role: 'Member' },
    ],
  },
  {
    team: 'Tech & Web Team',
    icon: 'Code2',
    members: [
      { name: 'Michael Harold Sony', role: 'Head' },
      { name: 'Adithya Kiran', role: 'Head' },
      { name: 'Sreehari R', role: 'Member' },
      { name: 'Sruthi Mariam Shaji', role: 'Member' },
    ],
  },
  {
    team: 'Publicity & Sponsorship Team',
    icon: 'Megaphone',
    members: [
      { name: 'Affan Muhammed', role: 'Head' },
      { name: 'Arshin T', role: 'Head' },
      { name: 'Sandesh K V', role: 'Member' },
      { name: 'Gouri Parvathy S', role: 'Member' },
    ],
  },
  {
    team: 'Network Team',
    icon: 'Network',
    members: [
      { name: 'Niveditha B', role: 'Head' },
      { name: 'Sreenanda V H', role: 'Member' },
      { name: 'Goutham Krishna B', role: 'Member' },
    ],
  },
  {
    team: 'Social Media Team',
    icon: 'AtSign',
    members: [
      { name: 'Janaki R', role: 'Head' },
      { name: 'Asmin Shahal', role: 'Member' },
      { name: 'Mohammed Nihal', role: 'Member' },
    ],
  },
  {
    team: 'Junior Representative',
    icon: 'Star',
    lead: true,
    members: [{ name: 'Fathima Husna U', role: 'Junior Representative' }],
  },
]

// ── Testimonials (alumni) ────────────────────────────────────
export const testimonials = [
  {
    id: 't1',
    name: 'Nikhil Varma',
    designation: 'Software Engineer',
    organization: 'Google',
    photo: 'https://i.pravatar.cc/200?img=53',
    quote:
      'ACM TKMCE was where I wrote my first real project and my first real resume line. The workshops were the reason I cleared my interviews.',
  },
  {
    id: 't2',
    name: 'Divya Krishnan',
    designation: 'Product Designer',
    organization: 'Razorpay',
    photo: 'https://i.pravatar.cc/200?img=27',
    quote:
      'The community gave me the confidence to lead. I ran my first design workshop here — now I design for millions of users.',
  },
  {
    id: 't3',
    name: 'Sarath Menon',
    designation: 'ML Engineer',
    organization: 'Nvidia',
    photo: 'https://i.pravatar.cc/200?img=57',
    quote:
      'Nothing on campus came close to the signal-per-hour of an ACM session. It set the bar for how I still learn today.',
  },
]

// ── Events ───────────────────────────────────────────────────
export const events = [
  {
    id: 'ev1',
    name: 'HackTKM 2025',
    poster: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop',
    date: '2026-08-22',
    time: '9:00 AM',
    venue: 'Main Auditorium, TKMCE',
    shortDescription: '24-hour flagship hackathon. Build, break, ship — and win big.',
    description:
      'HackTKM is the chapter’s flagship 24-hour hackathon bringing together 300+ builders across Kerala. Form a team, pick a track — AI, Web3, Sustainability or Open Innovation — and turn an idea into a working prototype overnight, with mentors on the floor and prizes for the boldest builds.',
    status: 'open',
    fee: 0,
    deadline: '2025-08-18',
    speakers: [
      { name: 'Dr. Latha Menon', designation: 'Professor, CSE', organization: 'TKMCE', photo: 'https://i.pravatar.cc/150?img=32' },
      { name: 'Rohit Sharma', designation: 'Staff Engineer', organization: 'Postman', photo: 'https://i.pravatar.cc/150?img=13' },
    ],
  },
  {
    id: 'ev2',
    name: 'Intro to Systems Design',
    poster: 'https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=1200&auto=format&fit=crop',
    date: '2026-07-20',
    time: '2:00 PM',
    venue: 'Seminar Hall B',
    shortDescription: 'A hands-on primer on scalable systems, load balancing and caching.',
    description:
      'A practical, whiteboard-heavy session decoding how large systems actually scale — caching layers, load balancing, queues and databases. Walk out able to sketch the architecture of your favourite app.',
    status: 'coming-soon',
    fee: 0,
    deadline: '2025-07-28',
    speakers: [
      { name: 'Arjun Das', designation: 'Secretary, ACM TKMCE', organization: 'TKMCE', photo: 'https://i.pravatar.cc/150?img=33' },
    ],
  },
  {
    id: 'ev3',
    name: 'Design Systems Workshop',
    poster: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?q=80&w=1200&auto=format&fit=crop',
    date: '2025-06-14',
    time: '10:00 AM',
    venue: 'Design Lab',
    shortDescription: 'From Figma tokens to production components in one afternoon.',
    description:
      'A full-day workshop on building and maintaining a design system — tokens, components, accessibility and hand-off — taught through a real product rebuild.',
    status: 'closed',
    fee: 99,
    deadline: '2025-06-10',
    speakers: [
      { name: 'Divya Krishnan', designation: 'Product Designer', organization: 'Razorpay', photo: 'https://i.pravatar.cc/150?img=27' },
    ],
  },
  {
    id: 'ev4',
    name: 'Open Source Sprint',
    poster: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?q=80&w=1200&auto=format&fit=crop',
    date: '2026-07-29',
    time: '11:00 AM',
    venue: 'Computer Centre',
    shortDescription: 'Land your first merged PR with mentors by your side.',
    description:
      'A guided sprint where first-timers make their first open-source contribution — git basics, reading issues, and getting a PR reviewed and merged into a live project by day’s end.',
    status: 'open',
    fee: 0,
    deadline: '2025-09-01',
    speakers: [
      { name: 'Kevin Joseph', designation: 'Web Lead, ACM TKMCE', organization: 'TKMCE', photo: 'https://i.pravatar.cc/150?img=15' },
    ],
  },
]

// ── Registrations (for User + Admin dashboards) ──────────────
export const registrations = [
  { id: 'r1', userId: 'u_local', eventId: 'ev1', date: '2025-07-10', status: 'Confirmed', paymentStatus: 'N/A' },
  { id: 'r2', userId: 'u_local', eventId: 'ev4', date: '2025-07-15', status: 'Confirmed', paymentStatus: 'N/A' },
  { id: 'r3', userId: 'u_local', eventId: 'ev3', date: '2025-06-02', status: 'Attended', paymentStatus: 'Paid' },
]

// ── Admin: sample participant roster ─────────────────────────
export const participants = [
  { id: 'p1', name: 'Aparna Menon', email: 'aparna@tkmce.ac.in', event: 'HackTKM 2025', college: 'TKMCE', acmMember: true, status: 'Confirmed' },
  { id: 'p2', name: 'Rahul Nair', email: 'rahul@tkmce.ac.in', event: 'HackTKM 2025', college: 'TKMCE', acmMember: true, status: 'Confirmed' },
  { id: 'p3', name: 'Sana Ali', email: 'sana@ceck.ac.in', event: 'Open Source Sprint', college: 'CE Chengannur', acmMember: false, status: 'Pending' },
  { id: 'p4', name: 'Joel George', email: 'joel@tkmce.ac.in', event: 'Open Source Sprint', college: 'TKMCE', acmMember: false, status: 'Confirmed' },
  { id: 'p5', name: 'Nimisha R', email: 'nimisha@mgits.ac.in', event: 'HackTKM 2025', college: 'MG Institute', acmMember: true, status: 'Confirmed' },
]

// ── Gallery ──────────────────────────────────────────────────
export const gallery = [
  { id: 'g1', eventId: 'ev1', image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?q=80&w=800&auto=format&fit=crop', caption: 'HackTKM finale' },
  { id: 'g2', eventId: 'ev3', image: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?q=80&w=800&auto=format&fit=crop', caption: 'Design workshop' },
  { id: 'g3', eventId: 'ev4', image: 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?q=80&w=800&auto=format&fit=crop', caption: 'Open source sprint' },
  { id: 'g4', eventId: 'ev1', image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=800&auto=format&fit=crop', caption: 'Midnight debugging' },
  { id: 'g5', eventId: 'ev2', image: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?q=80&w=800&auto=format&fit=crop', caption: 'AI bootcamp' },
  { id: 'g6', eventId: 'ev2', image: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=800&auto=format&fit=crop', caption: 'Team huddle' },
  { id: 'g7', eventId: 'ev3', image: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=800&auto=format&fit=crop', caption: 'Guest lecture' },
  { id: 'g8', eventId: 'ev4', image: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?q=80&w=800&auto=format&fit=crop', caption: 'Mentor circles' },
]

// ── Updates & announcements (home ticker) ────────────────────
export const announcements = [
  { id: 'a1', tag: 'New', text: 'HackTKM 2025 registrations are live — grab your spot' },
  { id: 'a2', tag: 'Soon', text: 'Execom 2025–26 applications open next month' },
  { id: 'a3', tag: 'Update', text: 'ACM India Winter School shortlists announced' },
  { id: 'a4', tag: 'Weekly', text: 'CP circle every Friday, 5 PM · Seminar Hall' },
]

// ── Status badge helpers ─────────────────────────────────────
export const statusMeta = {
  open: { label: 'Registration Open', tone: 'green' },
  closed: { label: 'Registration Closed', tone: 'red' },
  'coming-soon': { label: 'Coming Soon', tone: 'amber' },
}

export const getEventById = (id) => events.find((e) => e.id === id)
