import { buildSharePayload } from '../share';
import { createTestConfig } from './helpers/config';

describe('buildSharePayload', () => {
  test('builds universal-link-ready voting share copy with rotating options', () => {
    const share = buildSharePayload(
      createTestConfig({
        webAppUrl: 'https://hnnt.app/',
        iosAppStoreUrl: 'https://apps.apple.com/app/hnnt/id123',
      }),
      {
        targetType: 'voting_session',
        publicPath: '/vote/ABC123',
        inviteToken: 'invite-token',
      },
    );

    expect(share.shareUrl).toBe('https://hnnt.app/vote/ABC123?i=invite-token');
    expect(share.appStoreUrl).toBe('https://apps.apple.com/app/hnnt/id123');
    expect(share.copyOptions.length).toBeGreaterThan(3);
    expect(share.copyOptions.map((option) => option.copyId)).toContain('honestly-cant');
    expect(share.copyOptions[0].fullText).toContain(share.shareUrl);
    expect(share.copyOptions[0].fullText).toContain('https://apps.apple.com/app/hnnt/id123');
  });
});
