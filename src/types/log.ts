export type LogRecord = {
  _id: string;
  level: string;
  message: string;
  service: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  createdAt: string;
  updatedAt?: string;
};

export type LogsApiResponse = {
  success: boolean;
  data: LogRecord[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
};
