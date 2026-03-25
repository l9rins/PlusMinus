import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";

export function useAlerts() {
    const { getToken, isLoaded, isSignedIn, userId } = useAuth();
    const queryClient = useQueryClient();

    const fetchAlerts = async () => {
        if (!isLoaded || !isSignedIn || !userId) return [];
        const token = await getToken();
        if (!token) return [];
        
        const res = await fetch("/api/notify", {
            headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch alerts");
        const data = await res.json();
        return data.alerts || [];
    };

    const query = useQuery({
        queryKey: ["alerts", userId],
        queryFn: fetchAlerts,
        staleTime: 60000,
        enabled: isLoaded && isSignedIn && !!userId,
    });

    const createMutation = useMutation({
        mutationFn: async (alertData) => {
            const token = await getToken();
            const res = await fetch("/api/notify", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify(alertData),
            });
            if (!res.ok) throw new Error("Failed to create alert");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async (alertId) => {
            const token = await getToken();
            const res = await fetch(`/api/notify?alertId=${alertId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            if (!res.ok) throw new Error("Failed to delete alert");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["alerts", userId] });
        }
    });

    return {
        data: query.data || [],
        isLoading: query.isLoading,
        createAlert: createMutation.mutateAsync,
        isCreating: createMutation.isPending,
        deleteAlert: deleteMutation.mutateAsync,
        isDeleting: deleteMutation.isPending,
    };
}
