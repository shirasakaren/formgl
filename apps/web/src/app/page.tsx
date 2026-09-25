import { ENVIRONMENTS, type EnvironmentKey } from '@formgl/shared';
import { Experience } from '@/components/experience/Experience';
import { demoForm } from '@/lib/public/demo';

type Search = Promise<Record<string, string | string[] | undefined>>;

/** The landing page is a live demo letter. `?env=seaside|atelier|skies|lantern` previews the other worlds. */
export default async function Home({ searchParams }: { searchParams: Search }) {
  const sp = await searchParams;
  const env = ENVIRONMENTS.find((e) => e.key === sp.env)?.key as EnvironmentKey | undefined;
  return <Experience form={demoForm(env)} demo />;
}
