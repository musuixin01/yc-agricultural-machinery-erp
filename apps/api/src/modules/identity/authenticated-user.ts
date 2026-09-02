export type AuthenticatedUser = {
  id: string;
  username: string;
  displayName: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
};
