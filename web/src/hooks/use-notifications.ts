"use client";
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import { notificationsApi } from '@/lib/api/notifications';
import { useSocketEvent } from './use-socket';
import { useAuthStore } from '@/store/auth-store';
export function useNotifications(page = 1, limit = 20) {
  const queryClient = useQueryClient(); const companyId = useParams<{ companyId?: string }>()?.companyId;
  const isAuthed = useAuthStore(s => s.status === 'authenticated');
  const query = useQuery({ queryKey: ['notifications', companyId, page, limit], queryFn: () => notificationsApi.mine({ page, limit, companyId }), enabled: isAuthed });
  const unread = useQuery({ queryKey: ['notifications-unread', companyId], queryFn: () => notificationsApi.mine({ page: 1, limit: 1, unreadOnly: true, companyId }), enabled: isAuthed, select: data => data.total, staleTime: 30000 });
  const refresh = () => { void queryClient.invalidateQueries({ queryKey: ['notifications'] }); void queryClient.invalidateQueries({ queryKey: ['notifications-unread'] }); };
  useSocketEvent('notification.created', refresh);
  const markRead = useMutation({ mutationFn: (id: string) => notificationsApi.read(id), onSuccess: refresh });
  const markAllRead = useMutation({ mutationFn: () => notificationsApi.readAll(companyId), onSuccess: refresh });
  const remove = useMutation({ mutationFn: (id: string) => notificationsApi.remove(id), onSuccess: refresh });
  return { ...query, items: query.data?.items ?? [], total: query.data?.total ?? 0, totalPages: query.data?.totalPages ?? 1, unreadCount: unread.data ?? 0, markRead: markRead.mutate, markAllRead: markAllRead.mutate, remove: remove.mutate };
}
