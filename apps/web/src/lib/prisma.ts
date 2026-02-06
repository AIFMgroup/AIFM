// Mock Prisma client for builds without database
// In production, we use mock data instead of a real database

// Define a mock model type
type MockModel = {
  findMany: (...args: any[]) => Promise<any[]>;
  findFirst: (...args: any[]) => Promise<any>;
  findUnique: (...args: any[]) => Promise<any>;
  create: (...args: any[]) => Promise<any>;
  createMany: (...args: any[]) => Promise<any>;
  update: (...args: any[]) => Promise<any>;
  updateMany: (...args: any[]) => Promise<any>;
  upsert: (...args: any[]) => Promise<any>;
  delete: (...args: any[]) => Promise<any>;
  deleteMany: (...args: any[]) => Promise<any>;
  count: (...args: any[]) => Promise<number>;
  groupBy: (...args: any[]) => Promise<any[]>;
  aggregate: (...args: any[]) => Promise<any>;
};

// Define a minimal PrismaClient type for compatibility
type PrismaClient = {
  // All Prisma models used in the codebase
  aIFeedback: MockModel;
  aIKnowledgeBase: MockModel;
  aIModel: MockModel;
  aIModelExample: MockModel;
  aIModelPrompt: MockModel;
  account: MockModel;
  auditLog: MockModel;
  client: MockModel;
  complianceCheck: MockModel;
  dataFeed: MockModel;
  document: MockModel;
  documentQuestion: MockModel;
  investor: MockModel;
  ledgerEntry: MockModel;
  policy: MockModel;
  regulation: MockModel;
  report: MockModel;
  riskProfile: MockModel;
  session: MockModel;
  task: MockModel;
  user: MockModel;
  // Connection methods
  $connect: () => Promise<void>;
  $disconnect: () => Promise<void>;
  $transaction: <T>(fn: (tx: PrismaClient) => Promise<T>) => Promise<T>;
};

// Create a mock model that will fail gracefully
const createMockModel = (): MockModel => {
  const mockQuery = (...args: any[]) => {
    console.warn('Prisma query called but no database connected - using mock data');
    return Promise.resolve(null);
  };

  return {
    findMany: () => Promise.resolve([]),
    findFirst: mockQuery,
    findUnique: mockQuery,
    create: mockQuery,
    createMany: () => Promise.resolve({ count: 0 }),
    update: mockQuery,
    updateMany: () => Promise.resolve({ count: 0 }),
    upsert: mockQuery,
    delete: mockQuery,
    deleteMany: () => Promise.resolve({ count: 0 }),
    count: () => Promise.resolve(0),
    groupBy: () => Promise.resolve([]),
    aggregate: () => Promise.resolve({}),
  };
};

// Create a mock prisma client that will fail gracefully
const createMockPrismaClient = (): PrismaClient => {
  const mockModel = createMockModel();
  
  const client: PrismaClient = {
    aIFeedback: createMockModel(),
    aIKnowledgeBase: createMockModel(),
    aIModel: createMockModel(),
    aIModelExample: createMockModel(),
    aIModelPrompt: createMockModel(),
    account: createMockModel(),
    auditLog: createMockModel(),
    client: createMockModel(),
    complianceCheck: createMockModel(),
    dataFeed: createMockModel(),
    document: createMockModel(),
    documentQuestion: createMockModel(),
    investor: createMockModel(),
    ledgerEntry: createMockModel(),
    policy: createMockModel(),
    regulation: createMockModel(),
    report: createMockModel(),
    riskProfile: createMockModel(),
    session: createMockModel(),
    task: createMockModel(),
    user: createMockModel(),
    $connect: () => Promise.resolve(),
    $disconnect: () => Promise.resolve(),
    $transaction: async (fn) => fn(client),
  };
  
  return client;
};

declare global {
  var prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  global.prisma || createMockPrismaClient();

if (process.env.NODE_ENV !== 'production') global.prisma = prisma;
