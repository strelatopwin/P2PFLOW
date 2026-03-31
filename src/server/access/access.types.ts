export type AccessStatus = "pending" | "approved";

export type AccessState = {
  status: AccessStatus;
  approved: boolean;
};
