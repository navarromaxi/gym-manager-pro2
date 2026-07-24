import type { Prospect } from "@/lib/supabase";

type ProspectFilterOptions = {
  search: string;
  status: string;
  priority: string;
  scheduledDate: string;
  nextContactDate: string;
  contactDate: string;
  contactDateRange: string;
  datesMatch: (candidate?: string | null, filter?: string | null) => boolean;
  isWithinContactDateRange: (candidate?: string | null, range?: string | null) => boolean;
};

/** Applies the existing lead-list filters without changing their priority or matching rules. */
export const filterProspects = (
  prospects: Prospect[],
  options: ProspectFilterOptions
) => {
  const normalizedSearch = options.search.toLowerCase();
  return prospects.filter((prospect) => {
    const matchesSearch = [prospect.name ?? "", prospect.email ?? "", prospect.notes ?? "", prospect.phone ?? ""]
      .some((field) => field.toLowerCase().includes(normalizedSearch));
    return matchesSearch &&
      (options.status === "all" || prospect.status === options.status) &&
      (options.priority === "all" || prospect.priority_level === options.priority) &&
      options.datesMatch(prospect.scheduled_date, options.scheduledDate) &&
      options.datesMatch(prospect.next_contact_date, options.nextContactDate) &&
      options.datesMatch(prospect.contact_date, options.contactDate) &&
      options.isWithinContactDateRange(prospect.contact_date, options.contactDateRange);
  });
};

export const sortProspectsByContactDate = (prospects: Prospect[]) =>
  [...prospects].sort((a, b) =>
    new Date(`${b.contact_date}T00:00:00`).getTime() -
    new Date(`${a.contact_date}T00:00:00`).getTime()
  );
