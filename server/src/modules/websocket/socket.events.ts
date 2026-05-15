export const socketEvents = {
  join: 'game:join',
  leave: 'game:leave',
  bet: 'game:bet',
  action: 'game:action',
  state: 'game:state',
  error: 'game:error',
  pokerMediaStatus: 'poker:media-status',
  pokerMediaSnapshot: 'poker:media-snapshot',
  pokerMediaSignal: 'poker:media-signal'
} as const;

export type SocketEventName = (typeof socketEvents)[keyof typeof socketEvents];
