export type Goal = {
  id: string;
  title: string;
  domain: string;
  description: string;
  season: string;
  active: boolean;
};

export const goals: Goal[] = [
  {
    id: "health-fitness",
    title: "Build a sustainable health & fitness foundation",
    domain: "Health & Fitness",
    description:
      "Weight loss through calorie awareness, consistent movement (gym, running, walking), and embodied care rather than punishment.",
    season: "Phase 1 — building minimums",
    active: true,
  },
  {
    id: "emotional-growth",
    title: "Grow emotionally through identity-based practice",
    domain: "Emotional Growth",
    description:
      "Daily grounding, presence, curiosity sparks, and identity check-ins that reinforce who I am becoming rather than what I produce.",
    season: "Ongoing — daily practice",
    active: true,
  },
  {
    id: "marriage",
    title: "Nurture my marriage and partnership",
    domain: "Marriage & Relationship",
    description:
      "Intentional date nights, present connection with my partner, wedding planning momentum, and genuine care over performance.",
    season: "Engaged — wedding season",
    active: true,
  },
  {
    id: "mba",
    title: "Excel in my graduate program program",
    domain: "graduate program",
    description:
      "Engage meaningfully with coursework, build professional skills, and leverage the graduate program network without losing balance.",
    season: "Active enrollment",
    active: true,
  },
  {
    id: "bcg-career",
    title: "Launch strong at Employer",
    domain: "Career — Employer",
    description:
      "Prepare for internship and career with technical skill building (Python, causal inference, ML), professional presence, and strategic learning.",
    season: "Pre-internship prep",
    active: true,
  },
  {
    id: "relationships",
    title: "Maintain meaningful relationships",
    domain: "Relationships & Community",
    description:
      "Stay connected with family, friends, and community through regular check-ins, social events, and genuine presence.",
    season: "Ongoing",
    active: true,
  },
  {
    id: "daily-identity",
    title: "Live from identity, not output",
    domain: "Daily Identity",
    description:
      "Anchor each day in values (presence, grounded confidence, curiosity) rather than productivity metrics. The system serves identity, not the reverse.",
    season: "Core operating principle",
    active: true,
  },
];

export const activeGoals = () => goals.filter((g) => g.active);
