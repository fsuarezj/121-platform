export enum ProcessName {
  send = 'send',
  sms = 'sms',
  whatsapp = 'whatsapp',
}

export enum QueueNameMessageCallBack {
  status = 'messageStatusCallback',
  incomingMessage = 'incomingMessage',
}

export enum QueueNameCreateMessage {
  replyOnIncoming = 'replyOnIncoming',
  smallBulk = 'smallBulk',
  mediumBulk = 'mediumBulk',
  largeBulk = 'largeBulk',
  lowPriority = 'lowPriority',
}
