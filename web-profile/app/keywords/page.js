'use client';

import { useMemo, useState } from 'react';

const stopwords = new Set([
  'the','and','for','with','that','this','from','your','you','are','our','will','have','has','was','were','their','they','them','but','not','all','any','can','could','would','should','may','might','must','been','being','into','over','under','about','above','below','each','other','more','most','some','such','than','too','very','here','there','what','which','when','where','why','how','who','whom','whose','also','etc','per','via','within','without','across','around','between','through','during','before','after','while','do','does','did','done','use','used','using','because','as','on','in','at','by','of','to','it','its','an','a','is','be','or'
]);

function extractKeywords(text) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .split(/[^a-z0-9+]+/i)
    .filter((w) => w && w.length > 2 && !stopwords.has(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w);
}

async function pdfToText(_file) {
  throw new Error("PDF extraction not available in this build. Please upload a TXT or paste text.");
}

async function fileToText(file) {
  if (!file) return '';
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    return pdfToText(file);
  }
  if (file.type.startsWith('text/') || file.name.toLowerCase().endsWith('.txt')) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result || '');
      reader.onerror = reject;
      reader.readAsText(file);
    });
  }
  throw new Error('Unsupported file type. Use PDF or TXT.');
}

export default function KeywordMatchPage() {
  const [resumeText, setResumeText] = useState('');
  const [jobText, setJobText] = useState('');
  const [status, setStatus] = useState('');

  const result = useMemo(() => {
    const jobKeywords = extractKeywords(jobText);
    const resumeWords = new Set(extractKeywords(resumeText));
    const matched = jobKeywords.filter((k) => resumeWords.has(k));
    const missing = jobKeywords.filter((k) => !resumeWords.has(k));
    return { jobKeywords, matched, missing };
  }, [resumeText, jobText]);

  const total = result.jobKeywords.length;
  const matchedCount = result.matched.length;
  const ratio = total ? matchedCount / total : 0;
  const strength = total === 0 ? 'N/A' : ratio >= 0.7 ? 'Strong' : ratio >= 0.4 ? 'Medium' : 'Weak';

  const handleFile = async (file, setter) => {
    if (!file) return;
    setStatus(`Reading ${file.name}...`);
    try {
      const text = await fileToText(file);
      setter(text);
      setStatus(`Loaded ${file.name}`);
    } catch (e) {
      setStatus(`Error: ${e.message || e.toString()}`);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Keyword Match</h1>
        <p className="text-sm text-gray-600">
          Load your resume (PDF/TXT) and a job description (paste or PDF). We&apos;ll show which job keywords appear in your resume.
        </p>
      </div>

      <div className="grid grid-cols-1 md-grid-cols-2 md:grid-cols-2 gap-4">
        <div className="card p-3" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Resume</label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => handleFile(e.target.files?.[0] || null, setResumeText)}
            />
          </div>
          <textarea
            value={resumeText}
            onChange={(e) => setResumeText(e.target.value)}
            rows={14}
            className="w-full mt-2 border border-gray-300 rounded px-3 py-2"
            placeholder="Paste resume text or load a PDF/TXT..."
          />
        </div>
        <div className="card p-3" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">Job description</label>
            <input
              type="file"
              accept=".pdf,.txt"
              onChange={(e) => handleFile(e.target.files?.[0] || null, setJobText)}
            />
          </div>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={14}
            className="w-full mt-2 border border-gray-300 rounded px-3 py-2"
            placeholder="Paste the job description or load a PDF/TXT..."
          />
        </div>
      </div>

      <div className="card p-3" style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8 }}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xl font-semibold">{matchedCount} / {total} keywords</div>
          <span className="text-sm text-gray-600">Match strength: {strength}</span>
          {status && <span className="text-sm text-gray-500">{status}</span>}
        </div>
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <div className="text-sm font-semibold mb-1">Matched</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {result.matched.length ? (
                result.matched.map((k) => (
                  <span key={k} className="px-2 py-1 rounded bg-green-100 text-green-800 border border-green-200">
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">None</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm font-semibold mb-1">Missing</div>
            <div className="flex flex-wrap gap-2 text-sm">
              {result.missing.length ? (
                result.missing.map((k) => (
                  <span key={k} className="px-2 py-1 rounded bg-gray-100 text-gray-700 border border-gray-200">
                    {k}
                  </span>
                ))
              ) : (
                <span className="text-gray-500">None</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
