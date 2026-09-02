import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { identityApi, type ManagedUser } from "./identity-api";

export function useEmployeeRoles(enabled: boolean) {
  return useQuery({
    queryKey: ["identity", "roles"],
    queryFn: identityApi.roles,
    enabled,
  });
}
export function useManagedUsers(
  search: string,
  status: string,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["identity", "users", search, status],
    queryFn: () => identityApi.users(search, status),
    enabled,
  });
}
export function useAuditEvents(result: string, enabled: boolean) {
  return useQuery({
    queryKey: ["identity", "audit", result],
    queryFn: () => identityApi.audit(result),
    enabled,
  });
}
export function useIdentityMutations() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: ["identity"] });
  return {
    createUser: useMutation({
      mutationFn: identityApi.createUser,
      onSuccess: refresh,
    }),
    setStatus: useMutation({
      mutationFn: ({
        user,
        status,
      }: {
        user: ManagedUser;
        status: "ACTIVE" | "INACTIVE";
      }) => identityApi.setStatus(user, status),
      onSuccess: refresh,
    }),
    revokeSessions: useMutation({
      mutationFn: identityApi.revokeSessions,
      onSuccess: refresh,
    }),
    resetPassword: useMutation({
      mutationFn: ({
        user,
        password,
      }: {
        user: ManagedUser;
        password: string;
      }) => identityApi.resetPassword(user, password),
      onSuccess: refresh,
    }),
  };
}
