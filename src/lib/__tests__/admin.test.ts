import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../auth', () => ({
  getIdToken: vi.fn(),
  refreshTokens: vi.fn(),
}));

function mockResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('admin client', () => {
  beforeEach(async () => {
    vi.resetModules();
    const { getIdToken, refreshTokens } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>).mockReset();
    (refreshTokens as ReturnType<typeof vi.fn>).mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('listPendingUsers — throws when not authenticated', async () => {
    const { getIdToken } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>).mockReturnValue(null);
    const { listPendingUsers } = await import('../admin');
    await expect(listPendingUsers()).rejects.toThrow(/not authenticated/);
  });

  it('listPendingUsers — sends bearer token + returns users array', async () => {
    const { getIdToken } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>).mockReturnValue('id-tok');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(200, { users: [{ sub: 'abc', email: 'a@b.co', status: 'CONFIRMED', groups: [], createdAt: '2026-01-01' }] }),
    );
    const { listPendingUsers } = await import('../admin');
    const result = await listPendingUsers();
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe('a@b.co');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/admin/users?filter=pending');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer id-tok' });
  });

  it('listPendingUsers — on 401 refreshes and retries once', async () => {
    const { getIdToken, refreshTokens } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('stale')
      .mockReturnValueOnce('fresh');
    (refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(mockResponse(200, { users: [] }));
    const { listPendingUsers } = await import('../admin');
    const result = await listPendingUsers();
    expect(result).toHaveLength(0);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(fetchSpy.mock.calls[1][1]).toMatchObject({
      headers: { Authorization: 'Bearer fresh' },
    });
  });

  it('approveUser — sends POST with correct body', async () => {
    const { getIdToken } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>).mockReturnValue('id-tok');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      mockResponse(200, { ok: true, user: { sub: 'abc', email: 'a@b.co', status: 'CONFIRMED', groups: ['members'], createdAt: '2026-01-01' } }),
    );
    const { approveUser } = await import('../admin');
    const result = await approveUser('abc');
    expect(result.ok).toBe(true);
    expect(result.user.groups).toContain('members');
    const [url, init] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain('/admin/users/abc/approve');
    expect((init as RequestInit).method).toBe('POST');
    expect(JSON.parse((init as RequestInit).body as string)).toMatchObject({ group: 'members' });
  });

  it('approveUser — on 401 refreshes and retries bearer', async () => {
    const { getIdToken, refreshTokens } = await import('../auth');
    (getIdToken as ReturnType<typeof vi.fn>)
      .mockReturnValueOnce('stale')
      .mockReturnValueOnce('fresh');
    (refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(mockResponse(401, {}))
      .mockResolvedValueOnce(
        mockResponse(200, { ok: true, user: { sub: 'abc', email: 'a@b.co', status: 'CONFIRMED', groups: ['members'], createdAt: '2026-01-01' } }),
      );
    const { approveUser } = await import('../admin');
    const result = await approveUser('abc', 'members');
    expect(result.ok).toBe(true);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
  });
});
