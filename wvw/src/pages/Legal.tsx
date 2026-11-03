/**
 * Legal notice (Impressum, § 5 DDG / § 18 MStV) for wvwhub.de.
 *
 * The operator's details are runtime settings (Moderation → Settings → Legal
 * notice → wvwConfig/settings.legal, published to wvwPublic/config) so no
 * personal address is committed to the public repo and it can change without
 * a deploy. The boilerplate below is translated like every other page.
 */
import { Link } from 'react-router-dom';
import { Notice, PageHeader, Skeleton } from '../components/ui';
import { useDocumentTitle, usePublicConfig } from '../lib/hooks';
import { isAdmin, useStore } from '../store';
import { msg, useT } from '../i18n';
import { Prose } from './Content';

const SECTIONS: [string, string[]][] = [
  [
    msg('Liability for content'),
    [
      msg('Raids, guild pages and other entries are posted by players. We check them only when we learn of a problem (report button, Feedback tab) and then remove unlawful content promptly. We can’t guarantee that schedules, team assignments or match data taken from the GW2 API are correct, complete or up to date.'),
    ],
  ],
  [
    msg('Liability for links'),
    [
      msg('Raid and guild pages can link to external sites (voice servers, guild websites, Discord). Their operators are solely responsible for their content; we had no knowledge of unlawful content when a link was added and remove such links as soon as we become aware of them.'),
    ],
  ],
  [
    msg('Copyright and trademarks'),
    [
      msg('WvW Hub is a non-commercial fan project and not affiliated with ArenaNet or NCSOFT. Guild Wars 2, its map art and all related marks are © ArenaNet, LLC / NCSOFT Corporation and used under ArenaNet’s content terms. Everything else on this site — code, texts and design — belongs to its operator unless stated otherwise.'),
    ],
  ],
  [msg('Contact'), [msg('The fastest way to reach the team is the [Feedback](/feedback) tab (verified members). Data protection: see the [privacy page](/privacy).')]],
];

export default function Legal() {
  const t = useT();
  useDocumentTitle(t('Legal notice'));
  const { data: config, loading } = usePublicConfig();
  const member = useStore((s) => s.member);
  const legal = config?.legal ?? null;

  return (
    <div className="prose-hub mx-auto max-w-3xl">
      <PageHeader title={t('Legal notice')} sub={t('Information according to § 5 DDG (German Digital Services Act).')} />
      {loading ? (
        <Skeleton h={160} />
      ) : legal ? (
        <section className="card card-pad not-prose mb-6 grid gap-3 text-sm">
          <div>
            <div className="label">{t('Operator')}</div>
            <p className="font-semibold">{legal.name}</p>
            <p className="whitespace-pre-line">{legal.address}</p>
          </div>
          <div>
            <div className="label">{t('Contact')}</div>
            <p>
              {t('Email')}: <a href={`mailto:${legal.email}`}>{legal.email}</a>
            </p>
            {legal.phone && (
              <p>
                {t('Phone')}: {legal.phone}
              </p>
            )}
          </div>
          <div>
            <div className="label">{t('Responsible for the content (§ 18 (2) MStV)')}</div>
            <p className="whitespace-pre-line">{legal.responsible || `${legal.name}\n${legal.address}`}</p>
          </div>
          {legal.extra && <p className="whitespace-pre-line">{legal.extra}</p>}
        </section>
      ) : (
        <div className="mb-6">
          <Notice tone="warn">
            {t('The operator details haven’t been filled in yet.')}{' '}
            {isAdmin(member) && (
              <Link to="/mod" className="underline">
                {t('Moderation → Settings → Legal notice')}
              </Link>
            )}
          </Notice>
        </div>
      )}
      <Prose sections={SECTIONS} />
    </div>
  );
}
