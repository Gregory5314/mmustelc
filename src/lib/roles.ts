export const ROLE_LABELS: Record<string, string> = {
  admin: "Legacy Admin",
  member: "Member",
  president: "Chapter President",
  vice_president: "Vice President",
  treasurer: "Treasurer",
  event_manager: "Event Manager",
  comm_officer_y1: "Communication Officer (Year 1)",
  comm_officer_y2: "Communication Officer (Year 2)",
  comm_officer_y3: "Communication Officer (Year 3)",
  comm_officer_y4: "Communication Officer (Year 4)",
  secretary_general: "Secretary General",
  assistant_secretary: "Assistant Secretary",
  alumni_manager: "Alumni Manager",
  mentorship_coordinator: "Mentorship Coordinator",
  welfare_coordinator: "Welfare Coordinator",
  alumni: "Alumni",

};

export const ASSIGNABLE_ROLES = [
  "member", "president", "vice_president", "treasurer", "event_manager",
  "comm_officer_y1", "comm_officer_y2", "comm_officer_y3", "comm_officer_y4",
  "secretary_general", "assistant_secretary", "alumni_manager",
  "mentorship_coordinator", "welfare_coordinator",
] as const;

export function roleLabel(r: string) { return ROLE_LABELS[r] ?? r; }
