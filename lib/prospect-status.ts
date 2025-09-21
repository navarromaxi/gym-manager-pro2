export type ProspectStatusDb =
  | "new"
  | "contacted"
  | "waiting_response"
  | "waiting_info"
  | "trial_scheduled"
  | "trial_completed"
  | "not_interested"
  | "contact_later";

export type ProspectStatusUI =
  | "averiguador"
  | "trial_scheduled"
  | "reagendado"
  | "asistio"
  | "no_asistio"
  | "inactivo"
  | "otro";

const UI_TO_DB_STATUS: Record<ProspectStatusUI, ProspectStatusDb> = {
  averiguador: "new",
  trial_scheduled: "trial_scheduled",
  reagendado: "waiting_response",
  asistio: "trial_completed",
  no_asistio: "not_interested",
  inactivo: "contact_later",
  otro: "waiting_info",
};

const DB_TO_UI_STATUS: Record<ProspectStatusDb, ProspectStatusUI> = {
  new: "averiguador",
  contacted: "averiguador",
  waiting_response: "reagendado",
  waiting_info: "otro",
  trial_scheduled: "trial_scheduled",
  trial_completed: "asistio",
  not_interested: "no_asistio",
  contact_later: "inactivo",
};

export const mapProspectStatusToDb = (
  status: ProspectStatusUI
): ProspectStatusDb => UI_TO_DB_STATUS[status] ?? "new";

export const mapProspectStatusFromDb = (
  status: string | null | undefined
): ProspectStatusUI => {
  if (!status) return "otro";
  return DB_TO_UI_STATUS[status as ProspectStatusDb] ?? "otro";
};