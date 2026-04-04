import ValidationClient from '@/components/ValidationClient';
import validationData from '@/data/intake-validation.json';

export default function ValidationPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ValidationClient data={validationData as any} />;
}
