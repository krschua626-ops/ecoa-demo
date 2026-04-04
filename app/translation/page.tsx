import { readFileSync } from 'fs';
import { join } from 'path';
import TranslationClient from '@/components/TranslationClient';
import guidelinesData from '@/data/guidelines.json';

export default function TranslationPage() {
  const sampleEnglish = JSON.parse(
    readFileSync(join(process.cwd(), 'data/sample-english.json'), 'utf8')
  );
  const sampleGerman = readFileSync(
    join(process.cwd(), 'data/sample-arabic.txt'), 'utf8'
  );

  return (
    <TranslationClient
      sampleEnglish={sampleEnglish}
      sampleGerman={sampleGerman}
      guidelines={guidelinesData.rules}
    />
  );
}
