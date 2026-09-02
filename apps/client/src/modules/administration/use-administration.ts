import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  administrationApi,
  type BusinessProfileInput,
} from "./administration-api";

export function useBusinessProfile(enabled = true) {
  return useQuery({
    queryKey: ["administration", "business-profile"],
    queryFn: administrationApi.profile,
    enabled,
  });
}

export function useUpdateBusinessProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: BusinessProfileInput) =>
      administrationApi.updateProfile(input),
    onSuccess: (profile) =>
      client.setQueryData(["administration", "business-profile"], profile),
  });
}

export function useBackups(enabled = true) {
  return useQuery({
    queryKey: ["administration", "backups"],
    queryFn: administrationApi.backups,
    enabled,
  });
}

export function useBackupPolicy(enabled = true) {
  return useQuery({
    queryKey: ["administration", "backup-policy"],
    queryFn: administrationApi.backupPolicy,
    enabled,
  });
}

export function useBackupMutations() {
  const client = useQueryClient();
  const refresh = () =>
    client.invalidateQueries({ queryKey: ["administration", "backups"] });
  return {
    create: useMutation({
      mutationFn: administrationApi.createBackup,
      onSuccess: refresh,
    }),
    verify: useMutation({
      mutationFn: administrationApi.verifyBackup,
      onSuccess: refresh,
    }),
    restore: useMutation({
      mutationFn: ({
        id,
        confirmation,
      }: {
        id: string;
        confirmation: string;
      }) => administrationApi.restoreBackup(id, confirmation),
      onSuccess: refresh,
    }),
    updatePolicy: useMutation({
      mutationFn: administrationApi.updateBackupPolicy,
      onSuccess: (policy) =>
        client.setQueryData(["administration", "backup-policy"], policy),
    }),
  };
}
