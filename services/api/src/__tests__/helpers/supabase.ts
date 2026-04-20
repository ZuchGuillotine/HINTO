/**
 * Mock Supabase client factory for unit tests.
 *
 * Each mock method returns a chainable query builder that resolves
 * to { data, error } — matching the real Supabase JS client API.
 */

type SupabaseResult = { data: unknown; error: unknown };

interface MockQueryBuilder {
  select: jest.Mock;
  insert: jest.Mock;
  upsert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  // Terminal result — set this to control what the chain resolves to
  _result: SupabaseResult;
  _results: SupabaseResult[];
}

function createQueryBuilder(result?: SupabaseResult, results: SupabaseResult[] = []): MockQueryBuilder {
  const defaultResult: SupabaseResult = result ?? { data: null, error: null };

  const builder: MockQueryBuilder = {
    _result: defaultResult,
    _results: [...results],
    select: jest.fn(),
    insert: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    limit: jest.fn(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
  };

  // Each method returns the builder for chaining, except when used as a
  // thenable (the last call in a chain). We make every method return the
  // builder, and also make the builder thenable so `await` works.
  for (const method of ['select', 'insert', 'upsert', 'update', 'delete', 'eq', 'order', 'limit', 'single', 'maybeSingle'] as const) {
    builder[method].mockReturnValue(builder);
  }

  // Make the builder await-able (thenable)
  (builder as unknown as { then: Function }).then = function (
    resolve: (v: SupabaseResult) => void,
    reject?: (e: unknown) => void,
  ) {
    const result = builder._results.length > 0 ? builder._results.shift()! : builder._result;
    return Promise.resolve(result).then(resolve, reject);
  };

  return builder;
}

export interface MockSupabaseClient {
  from: jest.Mock;
  auth: {
    getUser: jest.Mock;
    refreshSession: jest.Mock;
    signInWithOtp: jest.Mock;
    verifyOtp: jest.Mock;
  };
  _builders: Map<string, MockQueryBuilder>;
  /**
   * Configure what a table query returns.
   * Call this before the route handler runs.
   */
  _mockTable(table: string, result: SupabaseResult): MockQueryBuilder;
  _mockTableSequence(table: string, results: SupabaseResult[]): MockQueryBuilder;
  /**
   * Get (or create) the builder for a table, so you can further customize
   * individual method return values.
   */
  _getBuilder(table: string): MockQueryBuilder;
}

export function createMockSupabaseClient(): MockSupabaseClient {
  const builders = new Map<string, MockQueryBuilder>();

  const client: MockSupabaseClient = {
    _builders: builders,

    from: jest.fn((table: string) => {
      if (!builders.has(table)) {
        builders.set(table, createQueryBuilder());
      }
      return builders.get(table)!;
    }),

    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: null },
        error: { message: 'No token' },
      }),
      refreshSession: jest.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'No refresh token' },
      }),
      signInWithOtp: jest.fn().mockResolvedValue({
        data: {},
        error: null,
      }),
      verifyOtp: jest.fn().mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid token' },
      }),
    },

    _mockTable(table: string, result: SupabaseResult): MockQueryBuilder {
      const builder = createQueryBuilder(result);
      builders.set(table, builder);
      return builder;
    },

    _mockTableSequence(table: string, results: SupabaseResult[]): MockQueryBuilder {
      const fallback = results[results.length - 1] ?? { data: null, error: null };
      const builder = createQueryBuilder(fallback, results);
      builders.set(table, builder);
      return builder;
    },

    _getBuilder(table: string): MockQueryBuilder {
      if (!builders.has(table)) {
        builders.set(table, createQueryBuilder());
      }
      return builders.get(table)!;
    },
  };

  return client;
}

/**
 * Configures the mock auth to return a valid user for the given token.
 */
export function mockAuthenticatedUser(
  client: MockSupabaseClient,
  opts: {
    userId?: string;
    email?: string;
  } = {},
) {
  const userId = opts.userId ?? 'test-user-id';
  const email = opts.email ?? 'test@example.com';

  client.auth.getUser.mockResolvedValue({
    data: {
      user: {
        id: userId,
        email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        created_at: '2026-01-01T00:00:00Z',
      },
    },
    error: null,
  });

  // Mock the profiles lookup that auth middleware does
  client._mockTable('profiles', {
    data: { id: userId },
    error: null,
  });
}
