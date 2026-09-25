import { Experience } from '@/components/experience/Experience';
import { demoForm } from '@/lib/public/demo';

export default function Home() {
  return <Experience form={demoForm()} demo />;
}
