export const socketEvents = {
  join: 'game:join',
  leave: 'game:leave',
  bet: 'game:bet',
  action: 'game:action',
  state: 'game:state',
  error: 'game:error'
} as const;

export type SocketEventName = (typeof socketEvents)[keyof typeof socketEvents];
