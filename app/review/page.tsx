import ReviewClient from '@/components/ReviewClient';
import flagsData from '@/data/flags.json';
import guidelinesData from '@/data/guidelines.json';

export default function ReviewPage() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <ReviewClient flags={flagsData as any} guidelines={guidelinesData.rules as any} />;
}
