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
export function useSetPartyStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ party, status }: { party: Party; status: PartyStatus }) =>
      partiesApi.setStatus(party, status),
    onSuccess: () => client.invalidateQueries({ queryKey: ["parties"] }),
  });
}
