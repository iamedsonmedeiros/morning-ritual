export type DefaultRoutineStep = {
  title: string;
  duration: string;
  description: string;
  isRequired: boolean;
};

export type DefaultHabit = {
  title: string;
  active: boolean;
};

export const defaultRoutineSteps: DefaultRoutineStep[] = [
  {
    title: "Silêncio",
    duration: "5 min",
    description: "Respiração, oração, meditação ou pausa sem tela.",
    isRequired: true,
  },
  {
    title: "Afirmações",
    duration: "2 min",
    description: "Reforço de identidade, direção e foco do dia.",
    isRequired: true,
  },
  {
    title: "Visualização",
    duration: "2 min",
    description: "Enxergar o dia ideal e o próximo passo real.",
    isRequired: true,
  },
  {
    title: "Exercício",
    duration: "5 min",
    description: "Movimento leve para ligar corpo e mente.",
    isRequired: true,
  },
  {
    title: "Leitura",
    duration: "5 min",
    description: "Leitura curta com impacto prático.",
    isRequired: true,
  },
  {
    title: "Escrita",
    duration: "5 min",
    description: "Registrar prioridades, compromissos e reflexão.",
    isRequired: true,
  },
];

export const defaultHabits: DefaultHabit[] = [
  { title: "Beber água ao acordar", active: true },
  { title: "10 min sem celular", active: true },
  { title: "Planejar 3 prioridades", active: true },
];

export const defaultGoal = {
  title: "Construir consistência pela manhã",
  description: "Usar a rotina todos os dias até ela virar automático.",
};
