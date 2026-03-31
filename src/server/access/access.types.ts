export type AccessStatus = "pending" | "approved" | "rejected";

export type AccessState = {
  status: AccessStatus;
  approved: boolean;
};
