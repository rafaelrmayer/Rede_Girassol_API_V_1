import guide from '../support-guide.json';

// Only reviewed, unexpired editorial summaries. No user text or patient data is accepted.
export function supportGuide(today = new Date().toISOString().slice(0, 10)) {
  return {...guide, documents: guide.documents.filter(doc => doc.reviewed_on <= today && doc.review_due_on >= today)};
}
