import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  partiesApi,
  type CreatePartyInput,
  type Party,
  type PartyStatus,
} from "./parties-api";
export function useParties(search: string, role: string) {
  return useQuery({
    queryKey: ["parties", search, role],
    queryFn: () => partiesApi.list(search, role),
  });
}
export function useCreateParty() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePartyInput) => partiesApi.create(input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["parties"] }),
  });
}
export function useUpdateParty() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<CreatePartyInput> & { version?: number };
    }) => partiesApi.update(id, input),
    onSuccess: () => client.invalidateQueries({ queryKey: ["parties"] }),
  });
}

export function useBatchImportParties() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (parties: CreatePartyInput[]) =>
      partiesApi.batchImport(parties),
    onSuccess: () => client.invalidateQueries({ queryKey: ["parties"] }),
  });
}

export function useSetPartyStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ party, status }: { party: Party; status: PartyStatus }) =>
      partiesApi.setStatus(party, status),
    onSuccess: () => client.invalidateQueries({ queryKey: ["parties"] }),
  });
}
