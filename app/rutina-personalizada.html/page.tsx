import OnlineTrainingAgendaPage from "@/app/entrenamiento/[gymId]/agenda/page";

const onlineTrainingGymId = "entrenamiento_online";

/** Entrada pública con el dominio comercial de PyMes Sistemas. */
export default function PersonalizedRoutinePage() {
  return (
    <OnlineTrainingAgendaPage
      params={Promise.resolve({ gymId: onlineTrainingGymId })}
    />
  );
}
